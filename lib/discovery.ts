// Live GitHub discovery: new skill-convention repos, star-ranked category
// shelves, and user-query search, fetched server-side from the GitHub
// Search API.
//
// Honesty rules baked into the data this module returns:
// - Coverage is "repos matching agent-skill conventions" (a SKILL.md file
//   or the agent-skills / claude-skill topics), NOT every repo on GitHub.
// - Star counts travel with an explicit "popularity, not tested quality"
//   note; PackProof-tested packs live in the registry, not here.
// - Every response carries refreshedAt so pages can show data age.
// - Repos get a skillFileFound badge only after the raw SKILL.md at the
//   repo root actually loads; a topic/keyword match alone is not called an
//   installable skill.
//
// External repo metadata (names, descriptions) is untrusted content: it is
// rendered as plain text only and never executed or installed by this site.
//
// Rate limits: unauthenticated GitHub search allows 10 requests/minute per
// source IP, and on a shared serverless egress IP that quota is NOT
// guaranteed to be ours. Mitigations, in order: per-query failure isolation
// (one failed shelf never blanks the page), a 6h cache, persistence of the
// latest good snapshot in the libSQL store when configured (survives cold
// starts and shares across instances), and stale-serve on failure. Setting
// PACKPROOF_GITHUB_TOKEN (any read-only token; off by default) raises the
// allowance to 30 req/min - attach only with the user's approval.

const SEARCH_URL = "https://api.github.com/search/repositories";
const TIMEOUT_MS = 8000;
export const DISCOVERY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface DiscoveredRepo {
  fullName: string;
  url: string;
  description: string | null;
  stars: number;
  createdAt: string; // GitHub API ISO timestamp, passed through unmodified
  pushedAt: string;
  license: string | null;
  language: string | null;
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
  topByCategory: CategoryShelf[];
}

export interface DiscoverySearchResult {
  q: string;
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

// ---------------------------------------------------------------------------
// Queries: what "agent-skill conventions" means for coverage
// ---------------------------------------------------------------------------

function sevenDaysAgo(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const FRESH_QUERIES = (since: string) => [
  `SKILL.md created:>${since}`,
  `topic:agent-skills created:>${since}`,
  `topic:claude-skill created:>${since}`,
];

const CATEGORY_QUERIES: { category: string; queries: string[] }[] = [
  {
    category: "Research",
    queries: ["topic:agent-skills research", "SKILL.md research agent"],
  },
  {
    category: "UI/UX",
    queries: ["topic:agent-skills frontend", "SKILL.md ui design agent"],
  },
  {
    category: "Backend",
    queries: ["topic:agent-skills backend", "SKILL.md backend database"],
  },
];

// User searches are constrained to the same skill conventions so the box
// answers "find skill repos about X", not "search all of GitHub".
const USER_QUERY_WRAPPERS = (q: string) => [
  `${q} SKILL.md`,
  `${q} topic:agent-skills`,
  `${q} topic:claude-skill`,
];

// ---------------------------------------------------------------------------
// Cache: in-memory per instance, persisted in libSQL when configured so a
// cold start on another instance still serves the last good snapshot.
// ---------------------------------------------------------------------------

interface SnapshotEntry {
  at: number;
  data: DiscoveryResult;
}
let memSnapshot: SnapshotEntry | null = null;
const memQueryCache = new Map<string, { at: number; data: DiscoverySearchResult }>();

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
      sql: "SELECT payload, fetched_at FROM discovery_cache WHERE key = 'latest'",
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
      sql: `INSERT INTO discovery_cache (key, payload, fetched_at) VALUES ('latest', ?, ?)
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
    mergeDedupe(
      freshResults.map((r) => (r.status === "fulfilled" ? r.value : []))
    )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12)
  );

  const topByCategory: CategoryShelf[] = await Promise.all(
    CATEGORY_QUERIES.map(async ({ category, queries }) => {
      const results = await Promise.allSettled(
        queries.map((q) => searchRepos(q, "stars", 8))
      );
      const merged = mergeDedupe(
        results.map((r) => (r.status === "fulfilled" ? r.value : []))
      )
        .sort((a, b) => b.stars - a.stars)
        .slice(0, 8);
      return {
        category,
        repos: await verifySkillFiles(merged),
        failed: results.every((r) => r.status === "rejected"),
      };
    })
  );

  return {
    refreshedAt: new Date().toISOString(),
    cache: "miss",
    fresh,
    freshFailed,
    topByCategory,
  };
}

function snapshotEmpty(d: DiscoveryResult): boolean {
  return d.fresh.length === 0 && d.topByCategory.every((c) => c.repos.length === 0);
}

export async function getDiscovery(): Promise<DiscoveryResult> {
  const now = Date.now();
  if (memSnapshot && now - memSnapshot.at < DISCOVERY_CACHE_TTL_MS) {
    return { ...memSnapshot.data, cache: "hit" };
  }
  // Cold start: try the persisted snapshot before spending GitHub quota.
  if (!memSnapshot) {
    const persisted = await loadPersistedSnapshot();
    if (persisted && now - persisted.at < DISCOVERY_CACHE_TTL_MS) {
      memSnapshot = persisted;
      return { ...persisted.data, cache: "hit" };
    }
  }
  const data = await buildSnapshot();
  if (snapshotEmpty(data)) {
    // GitHub unreachable or limiting us: keep serving the last good snapshot.
    const fallback = memSnapshot ?? (await loadPersistedSnapshot());
    if (fallback) return { ...fallback.data, cache: "stale" };
    return data;
  }
  const entry = { at: now, data };
  memSnapshot = entry;
  await persistSnapshot(entry);
  return data;
}

// ---------------------------------------------------------------------------
// User-query search
// ---------------------------------------------------------------------------

export async function searchDiscovery(rawQ: string): Promise<DiscoverySearchResult> {
  const q = rawQ.trim().slice(0, 120);
  const now = Date.now();
  if (!q) return { q, refreshedAt: new Date(now).toISOString(), repos: [], failed: false };

  const key = q.toLowerCase();
  const hit = memQueryCache.get(key);
  if (hit && now - hit.at < DISCOVERY_CACHE_TTL_MS) return hit.data;

  const results = await Promise.allSettled(
    USER_QUERY_WRAPPERS(q).map((wrapped) => searchRepos(wrapped, undefined, 10))
  );
  const failed = results.every((r) => r.status === "rejected");
  const firstError =
    results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;

  if (failed && hit) return { ...hit.data, refreshedAt: hit.data.refreshedAt };

  const repos = await verifySkillFiles(
    mergeDedupe(results.map((r) => (r.status === "fulfilled" ? r.value : [])))
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 12)
  );
  const data: DiscoverySearchResult = {
    q,
    refreshedAt: new Date(now).toISOString(),
    repos,
    failed,
    error: failed ? firstError?.reason?.message ?? "GitHub search failed" : undefined,
  };
  if (!failed) memQueryCache.set(key, { at: now, data });
  return data;
}
