// Live GitHub discovery: new repos (skill-convention and general),
// star-ranked category shelves, and user-query search, fetched server-side
// from the GitHub Search API.
//
// Honesty rules baked into the data this module returns:
// - Coverage is either "repos matching agent-skill conventions" (a SKILL.md
//   file or the agent-skills / claude-skill topics) or, when the user picks
//   the "all repos" scope, GitHub's own unfiltered results. Neither is
//   every repo on GitHub, and the pages say so.
// - Star counts travel with an explicit "popularity, not tested quality,
//   not a curated top list" note. Most-starred retrieval is not curation.
// - Every response carries refreshedAt so pages can show data age.
// - Repos get a skillFileFound badge only after the raw SKILL.md at the
//   repo root actually loads; a topic/keyword match alone is not called an
//   installable skill.
// - Skill-scope user searches must match EVERY query term across name,
//   description and topics (GitHub's loose any-term matching leaks
//   unrelated repos otherwise).
//
// External repo metadata (names, descriptions) is untrusted content: it is
// rendered as plain text only and never executed or installed by this site.
//
// Rate limits: unauthenticated GitHub search allows 10 requests/minute per
// source IP, and on a shared serverless egress IP that quota is NOT
// guaranteed to be ours. Mitigations:
// - A global quota ledger (CoordStore, shared via libSQL when configured)
//   caps upstream calls across ALL instances at PACKPROOF_DISCOVERY_CAP_PER_MIN
//   (default 8/min, margin under the 10/min shared-IP limit).
// - Refreshes run through a global lease so only one instance refreshes at
//   a time, and proceed in chunks (PACKPROOF_DISCOVERY_CHUNK, default 4
//   calls per request) with progress persisted in the ledger, so one
//   request can never spend the whole budget and a crashed refresh resumes
//   where it stopped instead of restarting.
// - A failed or empty refresh keeps serving the last good snapshot and
//   backs off for a cooldown window instead of hammering upstream.
// - Per-query failure isolation, 6h cache, persisted last-good snapshot in
//   the libSQL store (survives cold starts), per-process singleflight and
//   an LRU-bounded (100) query cache.
// Setting PACKPROOF_GITHUB_TOKEN (any read-only token; off by default)
// raises the allowance to 30 req/min - attach only with the user's approval.

import {
  CoordStore,
  LibSqlLike,
  MemoryCoordStore,
  LibSqlCoordStore,
  PartialQueryResult,
} from "./discovery-coord";

const SEARCH_URL = "https://api.github.com/search/repositories";
const TIMEOUT_MS = 8000;
export const DISCOVERY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const QUERY_CACHE_MAX = 100; // bounded cardinality: LRU eviction past this
const WINDOW_MS = 60_000; // quota ledger window
const FAIL_COOLDOWN_MS = 60_000; // backoff after a fully failed/empty refresh

// All policy knobs read dynamically so tests (and ops) can change them via
// env without a rebuild.
function ttlMs(): number {
  const v = Number(process.env.PACKPROOF_DISCOVERY_TTL_MS);
  return Number.isFinite(v) && v > 0 ? v : DISCOVERY_CACHE_TTL_MS;
}
function capPerMin(): number {
  const v = Number(process.env.PACKPROOF_DISCOVERY_CAP_PER_MIN);
  return Number.isFinite(v) && v > 0 ? v : 8;
}
function chunkSize(): number {
  const v = Number(process.env.PACKPROOF_DISCOVERY_CHUNK);
  return Number.isFinite(v) && v > 0 ? v : 4;
}
function leaseMs(): number {
  const v = Number(process.env.PACKPROOF_DISCOVERY_LEASE_MS);
  return Number.isFinite(v) && v > 0 ? v : 120_000;
}

export interface DiscoveredRepo {
  fullName: string;
  url: string;
  description: string | null;
  stars: number;
  createdAt: string; // GitHub API ISO timestamp, passed through unmodified
  pushedAt: string;
  license: string | null;
  language: string | null;
  topics: string[];
  skillFileFound: boolean; // true only when <repo>/SKILL.md actually loaded
}

export interface CategoryShelf {
  category: string;
  repos: DiscoveredRepo[];
  failed: boolean;
}

export interface DiscoveryResult {
  refreshedAt: string;
  cache: "miss" | "hit" | "stale";
  fresh: DiscoveredRepo[];
  freshFailed: boolean;
  freshNotable: DiscoveredRepo[];
  freshNotableFailed: boolean;
  topByCategory: CategoryShelf[];
}

export interface DiscoverySearchResult {
  q: string;
  scope: "skills" | "all";
  refreshedAt: string;
  repos: DiscoveredRepo[];
  failed: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// GitHub calls
// ---------------------------------------------------------------------------

async function githubFetch(url: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "packproof-discovery",
  };
  // Optional, off by default. A token here is for read-only public search
  // only; it never appears in responses or logs.
  const token = process.env.PACKPROOF_GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // Freshness is owned by the cache below so the displayed age is honest.
    cache: "no-store",
  });
}

async function searchRepos(
  q: string,
  sort: "stars" | "updated" | undefined,
  perPage: number
): Promise<DiscoveredRepo[]> {
  const sortParam = sort ? `&sort=${sort}&order=desc` : "";
  const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}${sortParam}&per_page=${perPage}`;
  const res = await githubFetch(url);
  if (!res.ok) {
    const reset = res.headers.get("x-ratelimit-reset");
    throw new Error(
      res.status === 403 || res.status === 429
        ? `GitHub rate limit reached${reset ? ` (resets ${new Date(Number(reset) * 1000).toISOString()})` : ""}`
        : `GitHub search failed with HTTP ${res.status}`
    );
  }
  const json = (await res.json()) as {
    items?: Array<{
      full_name: string;
      html_url: string;
      description: string | null;
      stargazers_count: number;
      created_at: string;
      pushed_at: string;
      license: { spdx_id: string } | null;
      language: string | null;
      topics?: string[];
    }>;
  };
  return (json.items ?? []).map((r) => ({
    fullName: r.full_name,
    url: r.html_url,
    description: r.description,
    stars: r.stargazers_count,
    createdAt: r.created_at,
    pushedAt: r.pushed_at,
    license: r.license?.spdx_id ?? null,
    language: r.language,
    topics: r.topics ?? [],
    skillFileFound: false,
  }));
}

// A repo only earns the "skill file found" badge when its root SKILL.md
// actually loads over raw.githubusercontent.com (no API quota involved).
// Anything else stays an honest "convention match".
async function verifySkillFiles(repos: DiscoveredRepo[]): Promise<DiscoveredRepo[]> {
  return Promise.all(
    repos.map(async (r) => {
      try {
        const res = await fetch(
          `https://raw.githubusercontent.com/${r.fullName}/HEAD/SKILL.md`,
          { method: "HEAD", signal: AbortSignal.timeout(5000), cache: "no-store" }
        );
        return { ...r, skillFileFound: res.ok };
      } catch {
        return r;
      }
    })
  );
}

function mergeDedupe(sets: DiscoveredRepo[][]): DiscoveredRepo[] {
  const seen = new Set<string>();
  return sets
    .flat()
    .filter((r) => (seen.has(r.fullName) ? false : (seen.add(r.fullName), true)));
}

// Every term must appear somewhere in the repo's public metadata. GitHub's
// default matching is loose (any term, any field), which leaks unrelated
// repos into multi-word searches.
export function matchesAllTerms(repo: DiscoveredRepo, terms: string[]): boolean {
  const hay = `${repo.fullName} ${repo.description ?? ""} ${repo.topics.join(" ")}`.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

// ---------------------------------------------------------------------------
// Queries: what "agent-skill conventions" means for coverage
// ---------------------------------------------------------------------------

function sevenDaysAgo(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Two fresh queries (not three) keep a full refresh at 9 search calls,
// under the 10/min unauthenticated cap with margin; claude-skill repos
// overwhelmingly also carry SKILL.md or the agent-skills topic.
const FRESH_QUERIES = (since: string) => [
  `SKILL.md created:>${since}`,
  `topic:agent-skills created:>${since}`,
];

// New repos regardless of topic, with a small star floor so the shelf is
// signal rather than chronological noise.
const FRESH_NOTABLE_QUERY = (since: string) => `created:>${since} stars:>20`;

const CATEGORY_QUERIES: { category: string; query: string }[] = [
  { category: "Research", query: "topic:agent-skills research" },
  { category: "UI/UX", query: "topic:agent-skills frontend" },
  { category: "Backend", query: "topic:agent-skills backend" },
  { category: "DevOps & Infra", query: "topic:agent-skills devops" },
  { category: "Content & Docs", query: "topic:agent-skills documentation" },
  { category: "Data & ML", query: "topic:agent-skills data" },
];

// Skill-scope user searches are constrained to the same conventions so the
// box answers "find skill repos about X".
const USER_QUERY_WRAPPERS = (q: string) => [
  `${q} SKILL.md`,
  `${q} topic:agent-skills`,
  `${q} topic:claude-skill`,
];

// One refresh = 9 search calls (2 fresh + 1 notable + 6 categories), run
// through the global quota gate in chunks.
interface QuerySpec {
  q: string;
  sort?: "stars" | "updated";
  perPage: number;
}
function refreshPlan(since: string): QuerySpec[] {
  return [
    ...FRESH_QUERIES(since).map((q) => ({ q, sort: "updated" as const, perPage: 10 })),
    { q: FRESH_NOTABLE_QUERY(since), sort: "stars" as const, perPage: 8 },
    ...CATEGORY_QUERIES.map((c) => ({ q: c.query, sort: "stars" as const, perPage: 8 })),
  ];
}

// ---------------------------------------------------------------------------
// libSQL client (snapshot persistence + shared coordination store)
// ---------------------------------------------------------------------------

let libsqlClient: Promise<LibSqlLike> | null = null;

function useLibSql(): boolean {
  return process.env.PACKPROOF_STORE === "libsql" && !!process.env.TURSO_DATABASE_URL;
}

async function getLibSql(): Promise<LibSqlLike> {
  if (libsqlClient) return libsqlClient;
  const pending: Promise<LibSqlLike> = (async () => {
    const url = process.env.TURSO_DATABASE_URL!;
    const mod = url.startsWith("file:")
      ? await import("@libsql/client")
      : await import("@libsql/client/web");
    return mod.createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  })();
  libsqlClient = pending;
  pending.catch(() => {
    if (libsqlClient === pending) libsqlClient = null;
  });
  return pending;
}

interface SnapshotEntry {
  at: number;
  data: DiscoveryResult;
}

async function loadPersistedSnapshot(): Promise<SnapshotEntry | null> {
  if (!useLibSql()) return null;
  try {
    const db = await getLibSql();
    const res = await db.execute({
      sql: "SELECT payload, fetched_at FROM discovery_cache WHERE key = 'latest-v3'",
      args: [],
    });
    const row = res.rows[0];
    if (!row) return null;
    return {
      at: Date.parse(String(row.fetched_at)) || 0,
      data: JSON.parse(String(row.payload)) as DiscoveryResult,
    };
  } catch {
    return null; // table may not exist yet; in-memory cache still works
  }
}

async function persistSnapshot(entry: SnapshotEntry): Promise<void> {
  if (!useLibSql()) return;
  try {
    const db = await getLibSql();
    await db.execute({
      sql: `INSERT INTO discovery_cache (key, payload, fetched_at) VALUES ('latest-v3', ?, ?)
            ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
      args: [JSON.stringify(entry.data), new Date(entry.at).toISOString()],
    });
  } catch {
    // Persistence is best-effort; the in-memory cache already served the request.
  }
}

// Default coordination store: shared libSQL ledger when configured, else one
// process-wide memory store (correct for a single local instance).
let defaultCoord: CoordStore | null = null;
function defaultCoordStore(): CoordStore {
  if (defaultCoord) return defaultCoord;
  defaultCoord = useLibSql()
    ? new LibSqlCoordStore(getLibSql)
    : new MemoryCoordStore();
  return defaultCoord;
}

// ---------------------------------------------------------------------------
// DiscoveryService: one per serverless instance. Memory state (snapshot,
// query cache, singleflight) is per instance; quota and refresh
// coordination go through the injected CoordStore, which is shared across
// instances when libSQL is configured.
// ---------------------------------------------------------------------------

let instanceCounter = 0;

export class DiscoveryService {
  private memSnapshot: SnapshotEntry | null = null;
  private memQueryCache = new Map<string, { at: number; data: DiscoverySearchResult }>();
  private inflight = new Map<string, Promise<unknown>>();
  private ownerId = `inst-${++instanceCounter}-${Math.random().toString(36).slice(2, 8)}`;

  constructor(
    private coord: CoordStore = defaultCoordStore(),
    private clock: () => number = Date.now
  ) {}

  private singleflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;
    const p = fn().finally(() => {
      if (this.inflight.get(key) === p) this.inflight.delete(key);
    });
    this.inflight.set(key, p);
    return p;
  }

  private queryCacheSet(key: string, val: { at: number; data: DiscoverySearchResult }): void {
    if (this.memQueryCache.has(key)) this.memQueryCache.delete(key);
    this.memQueryCache.set(key, val);
    while (this.memQueryCache.size > QUERY_CACHE_MAX) {
      const oldest = this.memQueryCache.keys().next().value;
      if (oldest === undefined) break;
      this.memQueryCache.delete(oldest);
    }
  }

  // Assemble a snapshot from per-query results. Missing indexes (a chunk
  // that never ran) count as failed so a partially built page stays honest.
  private async assemble(results: PartialQueryResult[]): Promise<DiscoveryResult> {
    const byIndex = new Map<number, PartialQueryResult>(results.map((r) => [r.index, r]));
    const at = (i: number): PartialQueryResult | undefined => byIndex.get(i);
    const reposAt = (i: number): DiscoveredRepo[] =>
      (at(i)?.repos as DiscoveredRepo[] | undefined) ?? [];

    const freshParts = [at(0), at(1)];
    const freshFailed = freshParts.every((p) => !p?.ok);
    const fresh = await verifySkillFiles(
      mergeDedupe([reposAt(0), reposAt(1)])
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 12)
    );

    const notable = at(2);
    const freshNotable = notable?.ok ? reposAt(2) : [];
    const freshNotableFailed = !notable?.ok;

    const topByCategory: CategoryShelf[] = await Promise.all(
      CATEGORY_QUERIES.map(async ({ category }, ci) => {
        const part = at(3 + ci);
        const repos = part?.ok ? await verifySkillFiles(reposAt(3 + ci)) : [];
        return { category, repos, failed: !part?.ok };
      })
    );

    // A repo that fits several shelves appears once, in the first shelf the
    // page shows: fresh this week, then new-and-notable, then categories.
    // Seeing the same repo twice on one page reads as a bug, not abundance.
    const seen = new Set<string>();
    const firstShelfWins = (list: DiscoveredRepo[]): DiscoveredRepo[] =>
      list.filter((r) => {
        const key = r.fullName.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const freshDeduped = firstShelfWins(fresh);
    const freshNotableDeduped = firstShelfWins(freshNotable);
    const topDeduped = topByCategory.map((s) => ({ ...s, repos: firstShelfWins(s.repos) }));

    return {
      refreshedAt: new Date(this.clock()).toISOString(),
      cache: "miss",
      fresh: freshDeduped,
      freshFailed,
      freshNotable: freshNotableDeduped,
      freshNotableFailed,
      topByCategory: topDeduped,
    };
  }

  // Run one chunk of the global refresh. Returns:
  // - { complete: true, data } when the plan finished this invocation
  //   (data is null when the finished snapshot is empty/failed: caller
  //   should serve last-good; the lease already backs off)
  // - { complete: false, data } when progress remains (data is a partial
  //   assembly for cold-start display, or null when another instance holds
  //   the lease and we did nothing)
  private async runRefreshChunk(): Promise<{ complete: boolean; data: DiscoveryResult | null }> {
    const now = this.clock();
    if (!(await this.coord.acquireLease(now, leaseMs(), this.ownerId))) {
      return { complete: false, data: null };
    }
    const { next, results } = await this.coord.loadProgress();
    const plan = refreshPlan(sevenDaysAgo());
    const acc: PartialQueryResult[] = [...results];
    let i = next;
    let calls = 0;
    while (i < plan.length && calls < chunkSize()) {
      // Every upstream call claims a global window slot first. A consumed
      // slot is never rolled back, even when the query then fails:
      // conservative beats optimistic on a shared budget.
      if (!(await this.coord.claimCall(this.clock(), WINDOW_MS, capPerMin()))) break;
      calls++;
      const spec = plan[i];
      try {
        const repos = await searchRepos(spec.q, spec.sort, spec.perPage);
        acc.push({ index: i, ok: true, repos });
      } catch {
        acc.push({ index: i, ok: false, repos: [] });
      }
      i++;
    }
    if (i >= plan.length) {
      const data = await this.assemble(acc);
      if (snapshotEmpty(data)) {
        // All queries failed or returned nothing: do not persist, keep the
        // last good snapshot serving, and back off before trying again.
        await this.coord.finishRefresh(this.clock() + FAIL_COOLDOWN_MS);
        return { complete: true, data: null };
      }
      await this.coord.finishRefresh(0);
      return { complete: true, data };
    }
    // Progress persists with the lease so the next request (this or another
    // instance) continues where we stopped.
    await this.coord.saveProgress(i, acc, this.clock() + leaseMs());
    const partial = acc.some((r) => r.ok) ? await this.assemble(acc) : null;
    return { complete: false, data: partial };
  }

  async getDiscovery(): Promise<DiscoveryResult> {
    const now = this.clock();
    if (this.memSnapshot && now - this.memSnapshot.at < ttlMs()) {
      return { ...this.memSnapshot.data, cache: "hit" };
    }
    return this.singleflight("snapshot", async () => {
      // Re-check inside the singleflight: another request may have filled it.
      const recheck = this.clock();
      if (this.memSnapshot && recheck - this.memSnapshot.at < ttlMs()) {
        return { ...this.memSnapshot.data, cache: "hit" as const };
      }
      // Cold start: try the persisted snapshot before spending GitHub quota.
      let persisted: SnapshotEntry | null = null;
      if (!this.memSnapshot) {
        persisted = await loadPersistedSnapshot();
        if (persisted && recheck - persisted.at < ttlMs()) {
          this.memSnapshot = persisted;
          return { ...persisted.data, cache: "hit" as const };
        }
      }
      const lastGood = this.memSnapshot ?? persisted;
      const outcome = await this.runRefreshChunk();
      if (outcome.complete && outcome.data) {
        const entry = { at: this.clock(), data: outcome.data };
        this.memSnapshot = entry;
        await persistSnapshot(entry);
        return outcome.data;
      }
      // Incomplete refresh or failed/empty completion: last good wins when
      // it exists; otherwise show the partial (cold start, clearly flagged
      // per-shelf) or a fully failed shape the page renders honestly.
      if (lastGood) return { ...lastGood.data, cache: "stale" as const };
      if (outcome.data) return outcome.data;
      return {
        refreshedAt: new Date(this.clock()).toISOString(),
        cache: "miss",
        fresh: [],
        freshFailed: true,
        freshNotable: [],
        freshNotableFailed: true,
        topByCategory: CATEGORY_QUERIES.map((c) => ({
          category: c.category,
          repos: [],
          failed: true,
        })),
      };
    });
  }

  async searchDiscovery(rawQ: string, rawScope?: string): Promise<DiscoverySearchResult> {
    const q = rawQ.trim().slice(0, 120);
    const scope: "skills" | "all" = rawScope === "all" ? "all" : "skills";
    const now = this.clock();
    if (!q) return { q, scope, refreshedAt: new Date(now).toISOString(), repos: [], failed: false };

    const key = `${scope}:${q.toLowerCase()}`;
    const hit = this.memQueryCache.get(key);
    if (hit && now - hit.at < ttlMs()) return hit.data;

    return this.singleflight(`q:${key}`, async () => {
      const recheck = this.memQueryCache.get(key);
      if (recheck && this.clock() - recheck.at < ttlMs()) return recheck.data;

      const queries = scope === "all" ? [q] : USER_QUERY_WRAPPERS(q);
      // Claim global budget for every upstream call before spending any.
      for (let c = 0; c < queries.length; c++) {
        if (!(await this.coord.claimCall(this.clock(), WINDOW_MS, capPerMin()))) {
          if (hit) return { ...hit.data };
          return {
            q,
            scope,
            refreshedAt: new Date(this.clock()).toISOString(),
            repos: [],
            failed: true,
            error:
              "Shared GitHub search quota is busy right now (this site caps itself to stay inside the free unauthenticated limit). Try again in a minute.",
          };
        }
      }

      const failedResult = (msg: string): DiscoverySearchResult => ({
        q,
        scope,
        refreshedAt: new Date(this.clock()).toISOString(),
        repos: [],
        failed: true,
        error: msg,
      });

      let repos: DiscoveredRepo[];
      if (scope === "all") {
        // Unfiltered GitHub search, GitHub's own relevance ranking.
        const result = await Promise.allSettled([searchRepos(q, undefined, 12)]);
        if (result[0].status === "rejected") {
          if (hit) return { ...hit.data };
          return failedResult(result[0].reason?.message ?? "GitHub search failed");
        }
        repos = await verifySkillFiles(result[0].value);
      } else {
        const results = await Promise.allSettled(
          queries.map((wrapped) => searchRepos(wrapped, undefined, 10))
        );
        const failed = results.every((r) => r.status === "rejected");
        if (failed) {
          if (hit) return { ...hit.data };
          const firstError = results.find((r) => r.status === "rejected") as
            | PromiseRejectedResult
            | undefined;
          return failedResult(firstError?.reason?.message ?? "GitHub search failed");
        }
        const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
        repos = await verifySkillFiles(
          mergeDedupe(results.map((r) => (r.status === "fulfilled" ? r.value : [])))
            .filter((r) => matchesAllTerms(r, terms))
            .sort((a, b) => b.stars - a.stars)
            .slice(0, 12)
        );
      }

      const data: DiscoverySearchResult = {
        q,
        scope,
        refreshedAt: new Date(this.clock()).toISOString(),
        repos,
        failed: false,
      };
      this.queryCacheSet(key, { at: this.clock(), data });
      return data;
    });
  }
}

function snapshotEmpty(d: DiscoveryResult): boolean {
  return (
    d.fresh.length === 0 &&
    d.freshNotable.length === 0 &&
    d.topByCategory.every((c) => c.repos.length === 0)
  );
}

// Default per-process service used by the routes.
const defaultService = new DiscoveryService();

export function getDiscovery(): Promise<DiscoveryResult> {
  return defaultService.getDiscovery();
}

export function searchDiscovery(rawQ: string, rawScope?: string): Promise<DiscoverySearchResult> {
  return defaultService.searchDiscovery(rawQ, rawScope);
}
