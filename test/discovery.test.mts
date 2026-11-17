// Behavioral tests for lib/discovery.ts with a mocked fetch. No network.
// Run: npx tsx test/discovery.test.mts
// Covers: singleflight, cache hit, stale-serve on empty/failed refresh,
// LRU bound, AND-term relevance, scope routing, SKILL.md badge truth,
// failure handling - plus cross-instance coordination: a shared global
// quota window, refresh lease (only one instance refreshes), chunked
// refresh continuation, lease takeover after expiry, failure cooldown,
// and claim consumption on upstream failure.

process.env.PACKPROOF_STORE = ""; // in-memory only for these tests
// The default service's own tests want the previous unchunked behavior;
// coordination limits are exercised explicitly per section below.
process.env.PACKPROOF_DISCOVERY_CAP_PER_MIN = "10000";
process.env.PACKPROOF_DISCOVERY_CHUNK = "100";

import {
  getDiscovery,
  searchDiscovery,
  matchesAllTerms,
  DiscoveryService,
  DiscoveredRepo,
} from "../lib/discovery";
import { MemoryCoordStore } from "../lib/discovery-coord";

let pass = 0;
let fail = 0;
function assert(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`pass: ${name}`);
  } else {
    fail++;
    console.error(`FAIL: ${name}`, detail ?? "");
  }
}

// ---- mock fetch ------------------------------------------------------------
let calls: string[] = [];
let mode: "normal" | "empty" | "fail" = "normal";
let repoCounter = 0;

function repo(partial: Partial<DiscoveredRepo> & { fullName: string }): DiscoveredRepo {
  return {
    fullName: partial.fullName,
    url: `https://github.com/${partial.fullName}`,
    description: partial.description ?? null,
    stars: partial.stars ?? 0,
    createdAt: partial.createdAt ?? "2026-11-15T10:00:00Z",
    pushedAt: partial.pushedAt ?? "2026-11-15T11:00:00Z",
    license: partial.license ?? "MIT",
    language: partial.language ?? "TypeScript",
    topics: partial.topics ?? [],
    skillFileFound: false,
  };
}

(globalThis as { fetch: unknown }).fetch = async (url: string | URL) => {
  const u = String(url);
  calls.push(u);
  if (u.startsWith("https://raw.githubusercontent.com/")) {
    return new Response(null, { status: u.includes("hasskill") ? 200 : 404 });
  }
  if (mode === "fail") return new Response("boom", { status: 500 });
  const q = new URL(u).searchParams.get("q") ?? "";
  let rawItems: DiscoveredRepo[] = [];
  if (mode !== "empty") {
    if (q.includes("alpha beta")) {
      rawItems = [
        repo({ fullName: "a/alpha-beta-hasskill", description: "alpha beta thing", stars: 5 }),
        repo({ fullName: "a/alpha-only", description: "alpha without the other term", stars: 50 }),
      ];
    } else if (/^q\d/.test(q) || q.includes("query") || q.includes("flaky")) {
      rawItems = [repo({ fullName: `r/${q.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`, description: q })];
    } else {
      rawItems = [repo({ fullName: `gen/repo-${repoCounter++}`, stars: 10, description: q })];
    }
  }
  // Serialize in the real API's snake_case shape, not our normalized shape.
  const items = rawItems.map((r) => ({
    full_name: r.fullName,
    html_url: r.url,
    description: r.description,
    stargazers_count: r.stars,
    created_at: r.createdAt,
    pushed_at: r.pushedAt,
    license: r.license ? { spdx_id: r.license } : null,
    language: r.language,
    topics: r.topics,
  }));
  return new Response(JSON.stringify({ items }), { status: 200 });
};

function searchCallCount(): number {
  return calls.filter((c) => c.includes("api.github.com")).length;
}

// 1. Cold build is a miss; immediate second call is a hit with no new API calls.
let d = await getDiscovery();
assert("cold build is a miss", d.cache === "miss", d.cache);
const afterFirst = searchCallCount();
assert("first build spends API calls", afterFirst > 0, afterFirst);
assert("first build is a complete snapshot", d.topByCategory.every((c) => c.repos.length > 0), d.topByCategory.map((c) => c.repos.length));
d = await getDiscovery();
assert("second call is a cache hit", d.cache === "hit", d.cache);
assert("cache hit spends zero API calls", searchCallCount() === afterFirst, searchCallCount());

// 2. Singleflight: 20 concurrent identical searches share one upstream burst.
calls = [];
await Promise.all(Array.from({ length: 20 }, () => searchDiscovery("same query")));
assert(
  "singleflight: 20 concurrent identical searches = 3 upstream calls (not 60)",
  searchCallCount() === 3,
  searchCallCount()
);

// 3. AND-term relevance: keeps only repos matching every term.
const s = await searchDiscovery("alpha beta");
assert(
  "AND filter keeps all-term matches",
  s.repos.length > 0 && s.repos.every((r) => matchesAllTerms(r, ["alpha", "beta"])),
  s.repos.map((r) => r.fullName)
);
assert(
  "OR-leak repo (alpha-only) filtered out",
  !s.repos.some((r) => r.fullName === "a/alpha-only"),
  s.repos.map((r) => r.fullName)
);

// 4. SKILL.md badge reflects the raw file actually loading.
assert(
  "skillFileFound true only when SKILL.md loads",
  s.repos.find((r) => r.fullName === "a/alpha-beta-hasskill")?.skillFileFound === true,
  s.repos
);

// 5. Scope routing: scope=all issues exactly one unwrapped query.
calls = [];
const sa = await searchDiscovery("plain repo search", "all");
assert("scope=all uses one unwrapped GitHub query", searchCallCount() === 1, searchCallCount());
assert("scope carried in result", sa.scope === "all", sa.scope);

// 6. LRU bound at 100 keys: 120 distinct queries evict the oldest.
for (let i = 0; i < 120; i++) await searchDiscovery(`q${i}`);
calls = [];
await searchDiscovery("q119");
assert("most recent query survives eviction", searchCallCount() === 0, searchCallCount());
await searchDiscovery("q0");
assert("oldest query evicted and refetched", searchCallCount() === 3, searchCallCount());

// 7. Failure does not poison the cache.
mode = "fail";
const sf = await searchDiscovery("flaky query");
assert("upstream failure surfaces as failed=true", sf.failed === true, sf);
mode = "normal";
const ss = await searchDiscovery("flaky query");
assert("next attempt after failure succeeds", ss.failed === false && ss.repos.length > 0, ss.failed);

// 8. Empty refresh serves the last good snapshot (stale), never blanks it.
process.env.PACKPROOF_DISCOVERY_TTL_MS = "1"; // everything is instantly stale now
mode = "empty";
const dStale = await getDiscovery();
assert(
  "empty refresh falls back to last good snapshot",
  dStale.cache === "stale" && dStale.fresh.length > 0,
  { cache: dStale.cache, fresh: dStale.fresh.length }
);
mode = "normal";
delete process.env.PACKPROOF_DISCOVERY_TTL_MS;

// 9. Failed refresh enters cooldown: last good served with zero new calls.
process.env.PACKPROOF_DISCOVERY_TTL_MS = "1";
mode = "fail";
calls = [];
const dFail = await getDiscovery();
assert("failed refresh still serves last good", dFail.cache === "stale" && dFail.fresh.length > 0, {
  cache: dFail.cache,
  fresh: dFail.fresh.length,
});
assert(
  "cooldown after failure spends zero upstream calls",
  searchCallCount() === 0,
  searchCallCount()
);
mode = "normal";
delete process.env.PACKPROOF_DISCOVERY_TTL_MS;

// ---------------------------------------------------------------------------
// Cross-instance coordination (two services, one shared coord store)
// ---------------------------------------------------------------------------

// 10. Global quota window is shared across instances.
{
  process.env.PACKPROOF_DISCOVERY_CAP_PER_MIN = "4";
  const coord = new MemoryCoordStore();
  let fakeNow = 1_800_000_000_000;
  const clock = () => fakeNow;
  const svcA = new DiscoveryService(coord, clock);
  const svcB = new DiscoveryService(coord, clock);
  calls = [];
  const r1 = await svcA.searchDiscovery("g1"); // 3 claims + 3 fetches
  assert("instance A search succeeds within budget", r1.failed === false && r1.repos.length > 0, r1);
  const r2 = await svcB.searchDiscovery("g2"); // 4th claim ok, 5th denied
  assert("instance B blocked when shared window is spent", r2.failed === true, r2);
  assert("quota denial explains itself", /quota/i.test(r2.error ?? ""), r2.error);
  assert("denied search spent no upstream fetch", searchCallCount() === 3, searchCallCount());
  fakeNow += 61_000; // next window
  const r3 = await svcB.searchDiscovery("g2");
  assert("search recovers in the next window", r3.failed === false && r3.repos.length > 0, r3.failed);
  process.env.PACKPROOF_DISCOVERY_CAP_PER_MIN = "10000";
}

// 11. Refresh lease: only one instance refreshes; others spend nothing.
{
  process.env.PACKPROOF_DISCOVERY_CHUNK = "2";
  const coord = new MemoryCoordStore();
  let fakeNow = 1_800_100_000_000;
  const clock = () => fakeNow;
  const svcA = new DiscoveryService(coord, clock);
  const svcB = new DiscoveryService(coord, clock);
  calls = [];
  const p1 = await svcA.getDiscovery(); // cold: chunk of 2, partial
  assert("chunked cold start returns partial honestly", p1.cache === "miss", p1.cache);
  assert("first chunk spent exactly 2 upstream calls", searchCallCount() === 2, searchCallCount());
  const beforeB = searchCallCount();
  const pb = await svcB.getDiscovery(); // lease held by A
  assert("second instance does not duplicate the refresh", searchCallCount() === beforeB, searchCallCount());
  assert("second instance serves an honest empty state", pb.freshFailed === true && pb.topByCategory.every((c) => c.failed), pb);
  // A continues; 5 invocations total (2+2+2+2+1) complete the 9-query plan.
  let done = p1;
  for (let i = 0; i < 4; i++) done = await svcA.getDiscovery();
  assert("refresh completes after chunked continuation", done.topByCategory.every((c) => c.repos.length > 0), done.topByCategory.map((c) => c.repos.length));
  assert("full refresh spent exactly 9 upstream calls", searchCallCount() === 9, searchCallCount());
  process.env.PACKPROOF_DISCOVERY_CHUNK = "100";
}

// 12. Lease takeover: an expired lease lets another instance RESUME the
// refresh from persisted progress, not restart it.
{
  process.env.PACKPROOF_DISCOVERY_CHUNK = "2";
  const coord = new MemoryCoordStore();
  let fakeNow = 1_800_200_000_000;
  const clock = () => fakeNow;
  const svcA = new DiscoveryService(coord, clock);
  const svcB = new DiscoveryService(coord, clock);
  calls = [];
  await svcA.getDiscovery(); // 2 queries done, lease held until +120s
  assert("instance A ran first chunk", searchCallCount() === 2, searchCallCount());
  fakeNow += 121_000; // lease expires (and the quota window rolls over)
  let done = await svcB.getDiscovery();
  for (let i = 0; i < 3; i++) done = await svcB.getDiscovery();
  assert("takeover completes the snapshot", done.topByCategory.every((c) => c.repos.length > 0), done.topByCategory.map((c) => c.repos.length));
  assert("takeover resumed from progress (9 total, not a restart)", searchCallCount() === 9, searchCallCount());
  process.env.PACKPROOF_DISCOVERY_CHUNK = "100";
}

// 13. Claims are consumed even when the upstream call then fails
// (conservative on a shared budget), and a fully empty refresh cools down.
{
  process.env.PACKPROOF_DISCOVERY_CAP_PER_MIN = "3";
  const coord = new MemoryCoordStore();
  const svc = new DiscoveryService(coord);
  mode = "fail";
  calls = [];
  const rf = await svc.searchDiscovery("d1");
  assert("failed upstream still consumed its claims", searchCallCount() === 3, searchCallCount());
  assert("failure surfaces", rf.failed === true, rf);
  mode = "normal";
  process.env.PACKPROOF_DISCOVERY_CAP_PER_MIN = "10000";
}
{
  const coord = new MemoryCoordStore();
  const svc = new DiscoveryService(coord);
  mode = "empty";
  calls = [];
  const e1 = await svc.getDiscovery(); // completes, all-empty, cools down
  assert("empty refresh yields honest all-failed shape", e1.freshFailed === true && e1.topByCategory.every((c) => c.failed), e1);
  const spent = searchCallCount();
  assert("empty refresh spent its chunk", spent === 9, spent);
  calls = [];
  const e2 = await svc.getDiscovery();
  assert("cooldown blocks immediate re-refresh (zero calls)", searchCallCount() === 0, searchCallCount());
  assert("cooldown state stays honest", e2.freshFailed === true, e2);
  mode = "normal";
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
