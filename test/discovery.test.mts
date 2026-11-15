// Behavioral tests for lib/discovery.ts with a mocked fetch.
// Run: npx tsx test/discovery.test.mts
// Covers: singleflight, cache hit, stale-serve on empty refresh, LRU bound,
// AND-term relevance, scope routing, SKILL.md badge truth, failure handling.

process.env.PACKPROOF_STORE = ""; // in-memory cache only for these tests

import {
  getDiscovery,
  searchDiscovery,
  matchesAllTerms,
  DiscoveredRepo,
} from "../lib/discovery";

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

// 9. After a real failure refresh, stale snapshot still served.
process.env.PACKPROOF_DISCOVERY_TTL_MS = "1";
mode = "fail";
const dFail = await getDiscovery();
assert("failed refresh still serves last good", dFail.cache === "stale" && dFail.fresh.length > 0, {
  cache: dFail.cache,
  fresh: dFail.fresh.length,
});
mode = "normal";
delete process.env.PACKPROOF_DISCOVERY_TTL_MS;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
