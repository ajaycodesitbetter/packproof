// Live GitHub discovery: new repos (skill-convention and general),
// star-ranked category shelves, and user-query search, fetched server-side
// from the GitHub Search API.
//
// Honesty rules baked into the data this module returns:
// - Coverage is either "repos matching agent-skill conventions" (a SKILL.md
//   file or the agent-skills / claude-skill topics) or, when the user picks
//   the "all repos" scope, GitHub's own unfiltered results. Neither is
//   every repo on GitHub, and the pages say so.
// - Star counts travel with an explicit "popularity, not tested quality"
//   note.
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
// guaranteed to be ours. Mitigations: per-query failure isolation, a 6h
// cache, persistence of the latest good shelf snapshot in the libSQL store
// when configured (survives cold starts and shares across instances),
// singleflight so concurrent visitors share one refresh, a bounded query
// cache (LRU, 100 entries), and stale-serve on failure. Setting
// PACKPROOF_GITHUB_TOKEN (any read-only token; off by default) raises the
// allowance to 30 req/min - attach only with the user's approval.

const SEARCH_URL = "https://api.github.com/search/repositories";
const TIMEOUT_MS = 8000;
export const DISCOVERY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// TTL is read dynamically so tests (and ops) can shorten it via env without
// a rebuild. Default stays 6 hours.
function ttlMs(): number {
  const v = Number(process.env.PACKPROOF_DISCOVERY_TTL_MS);
  return Number.isFinite(v) && v > 0 ? v : DISCOVERY_CACHE_TTL_MS;
}
const QUERY_CACHE_MAX = 100; // bounded cardinality: LRU eviction past this

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

// ---------------------------------------------------------------------------
// Cache: in-memory per instance, persisted in libSQL when configured so a
// cold start on another instance still serves the last good snapshot.
// Singleflight: concurrent requests share one in-flight build instead of
// each spending quota. Query cache is LRU-bounded at QUERY_CACHE_MAX keys.
// ---------------------------------------------------------------------------

interface SnapshotEntry {
  at: number;
  data: DiscoveryResult;
}
let memSnapshot: SnapshotEntry | null = null;
const memQueryCache = new Map<string, { at: number; data: DiscoverySearchResult }>();
const inflight = new Map<string, Promise<unknown>>();

function singleflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => {
    if (inflight.get(key) === p) inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}

function queryCacheSet(key: string, val: { at: number; data: DiscoverySearchResult }): void {
  if (memQueryCache.has(key)) memQueryCache.delete(key);
  memQueryCache.set(key, val);
  while (memQueryCache.size > QUERY_CACHE_MAX) {
    const oldest = memQueryCache.keys().next().value;
    if (oldest === undefined) break;
    memQueryCache.delete(oldest);
  }
}

interface LibSqlLike {
  execute(q: { sql: string; args: import("@libsql/client").InArgs }): Promise<{ rows: Array<Record<string, unknown>> }>;
}
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

// ---------------------------------------------------------------------------
// Shelves snapshot
// ---------------------------------------------------------------------------

async function buildSnapshot(): Promise<DiscoveryResult> {
  const since = sevenDaysAgo();

  const freshResults = await Promise.allSettled(
    FRESH_QUERIES(since).map((q) => searchRepos(q, "updated", 10))
  );
  const freshFailed = freshResults.every((r) => r.status === "rejected");
  const fresh = await verifySkillFiles(
    mergeDedupe(freshResults.map((r) => (r.status === "fulfilled" ? r.value : [])))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12)
  );

  const notableResult = await Promise.allSettled([
    searchRepos(FRESH_NOTABLE_QUERY(since), "stars", 8),
  ]);
  const freshNotableFailed = notableResult[0].status === "rejected";
  const freshNotable =
    notableResult[0].status === "fulfilled" ? notableResult[0].value : [];

  const topByCategory: CategoryShelf[] = await Promise.all(
    CATEGORY_QUERIES.map(async ({ category, query }) => {
      const result = await Promise.allSettled([searchRepos(query, "stars", 8)]);
      const repos =
        result[0].status === "fulfilled" ? await verifySkillFiles(result[0].value) : [];
      return { category, repos, failed: result[0].status === "rejected" };
    })
  );

  return {
    refreshedAt: new Date().toISOString(),
    cache: "miss",
    fresh,
    freshFailed,
    freshNotable,
    freshNotableFailed,
    topByCategory,
  };
}

function snapshotEmpty(d: DiscoveryResult): boolean {
  return (
    d.fresh.length === 0 &&
    d.freshNotable.length === 0 &&
    d.topByCategory.every((c) => c.repos.length === 0)
  );
}

export async function getDiscovery(): Promise<DiscoveryResult> {
  const now = Date.now();
  if (memSnapshot && now - memSnapshot.at < ttlMs()) {
    return { ...memSnapshot.data, cache: "hit" };
  }
  return singleflight("snapshot", async () => {
    // Re-check inside the singleflight: another request may have filled it.
    const recheck = Date.now();
    if (memSnapshot && recheck - memSnapshot.at < ttlMs()) {
      return { ...memSnapshot.data, cache: "hit" as const };
    }
    // Cold start: try the persisted snapshot before spending GitHub quota.
    if (!memSnapshot) {
      const persisted = await loadPersistedSnapshot();
      if (persisted && recheck - persisted.at < ttlMs()) {
        memSnapshot = persisted;
        return { ...persisted.data, cache: "hit" as const };
      }
    }
    const data = await buildSnapshot();
    if (snapshotEmpty(data)) {
      // GitHub unreachable or limiting us: keep serving the last good snapshot.
      const fallback = memSnapshot ?? (await loadPersistedSnapshot());
      if (fallback) return { ...fallback.data, cache: "stale" as const };
      return data;
    }
    const entry = { at: Date.now(), data };
    memSnapshot = entry;
    await persistSnapshot(entry);
    return data;
  });
}

// ---------------------------------------------------------------------------
// User-query search
// ---------------------------------------------------------------------------

export async function searchDiscovery(
  rawQ: string,
  rawScope?: string
): Promise<DiscoverySearchResult> {
  const q = rawQ.trim().slice(0, 120);
  const scope: "skills" | "all" = rawScope === "all" ? "all" : "skills";
  const now = Date.now();
  if (!q) return { q, scope, refreshedAt: new Date(now).toISOString(), repos: [], failed: false };

  const key = `${scope}:${q.toLowerCase()}`;
  const hit = memQueryCache.get(key);
  if (hit && now - hit.at < ttlMs()) return hit.data;

  return singleflight(`q:${key}`, async () => {
    const recheck = memQueryCache.get(key);
    if (recheck && Date.now() - recheck.at < ttlMs()) return recheck.data;

    let repos: DiscoveredRepo[];
    if (scope === "all") {
      // Unfiltered GitHub search, GitHub's own relevance ranking.
      const result = await Promise.allSettled([searchRepos(q, undefined, 12)]);
      if (result[0].status === "rejected") {
        if (hit) return { ...hit.data };
        return {
          q,
          scope,
          refreshedAt: new Date().toISOString(),
          repos: [],
          failed: true,
          error: result[0].reason?.message ?? "GitHub search failed",
        };
      }
      repos = await verifySkillFiles(result[0].value);
    } else {
      const results = await Promise.allSettled(
        USER_QUERY_WRAPPERS(q).map((wrapped) => searchRepos(wrapped, undefined, 10))
      );
      const failed = results.every((r) => r.status === "rejected");
      if (failed) {
        if (hit) return { ...hit.data };
        const firstError = results.find((r) => r.status === "rejected") as
          | PromiseRejectedResult
          | undefined;
        return {
          q,
          scope,
          refreshedAt: new Date().toISOString(),
          repos: [],
          failed: true,
          error: firstError?.reason?.message ?? "GitHub search failed",
        };
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
      refreshedAt: new Date().toISOString(),
      repos,
      failed: false,
    };
    queryCacheSet(key, { at: Date.now(), data });
    return data;
  });
}
