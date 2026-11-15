// Live GitHub discovery: new skill-convention repos and star-ranked
// category shelves, fetched server-side from the GitHub Search API.
//
// Honesty rules baked into the data this module returns:
// - Coverage is "repos matching agent-skill conventions" (SKILL.md mentions,
//   agent-skills / claude-skill topics), NOT every repo on GitHub.
// - Star counts travel with an explicit "popularity, not tested quality"
//   note; PackProof-tested packs live in the registry, not here.
// - Every response carries refreshedAt so pages can show data age.
//
// External repo metadata (names, descriptions) is untrusted content: it is
// rendered as plain text only and never executed or installed by this site.
//
// Rate limits: unauthenticated GitHub search allows 10 req/min. A full
// refresh uses 6 searches, so results are cached server-side for 6 hours.
// Setting PACKPROOF_GITHUB_TOKEN (any read-only token; not required) raises
// the search allowance to 30 req/min - leave unset unless the user approves
// attaching a token to the deployment.

const SEARCH_URL = "https://api.github.com/search/repositories";
const TIMEOUT_MS = 8000;
export const DISCOVERY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface DiscoveredRepo {
  fullName: string;
  url: string;
  description: string | null;
  stars: number;
  createdAt: string;
  pushedAt: string;
  license: string | null;
  language: string | null;
}

export interface DiscoveryResult {
  refreshedAt: string;
  cache: "miss" | "hit" | "stale";
  fresh: DiscoveredRepo[];
  topByCategory: { category: string; query: string; repos: DiscoveredRepo[] }[];
  errors: string[];
}

interface CacheEntry {
  at: number;
  data: DiscoveryResult;
}
let cache: CacheEntry | null = null;

function sevenDaysAgo(): string {
  const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function searchRepos(
  q: string,
  sort: "stars" | "updated",
  perPage: number
): Promise<DiscoveredRepo[]> {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&sort=${sort}&order=desc&per_page=${perPage}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "packproof-discovery",
  };
  // Optional, off by default. A token here is for read-only public search
  // only; it never appears in responses or logs.
  const token = process.env.PACKPROOF_GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // Never let the platform cache this at the HTTP layer - freshness is
    // owned by the 6h cache above so the displayed age is honest.
    cache: "no-store",
  });
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
  }));
}

// Queries that define "agent-skill conventions" for coverage. New repos must
// mention SKILL.md or carry the community topics; category shelves search
// within the agent-skills topic.
const FRESH_QUERIES = (since: string) => [
  `SKILL.md created:>${since}`,
  `topic:agent-skills created:>${since}`,
  `topic:claude-skill created:>${since}`,
];

const CATEGORY_QUERIES: { category: string; query: string }[] = [
  { category: "Research", query: "topic:agent-skills research" },
  { category: "UI/UX", query: "topic:agent-skills frontend" },
  { category: "Backend", query: "topic:agent-skills backend" },
];

async function buildDiscovery(): Promise<DiscoveryResult> {
  const errors: string[] = [];
  const since = sevenDaysAgo();

  const freshSets = await Promise.all(
    FRESH_QUERIES(since).map((q) =>
      searchRepos(q, "updated", 10).catch((e: Error) => {
        errors.push(e.message);
        return [] as DiscoveredRepo[];
      })
    )
  );
  const seen = new Set<string>();
  const fresh = freshSets
    .flat()
    .filter((r) => (seen.has(r.fullName) ? false : (seen.add(r.fullName), true)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);

  const topByCategory = await Promise.all(
    CATEGORY_QUERIES.map(async ({ category, query }) => ({
      category,
      query,
      repos: await searchRepos(query, "stars", 6).catch((e: Error) => {
        errors.push(e.message);
        return [] as DiscoveredRepo[];
      }),
    }))
  );

  return {
    refreshedAt: new Date().toISOString(),
    cache: "miss",
    fresh,
    topByCategory,
    errors,
  };
}

export async function getDiscovery(): Promise<DiscoveryResult> {
  const now = Date.now();
  if (cache && now - cache.at < DISCOVERY_CACHE_TTL_MS) {
    return { ...cache.data, cache: "hit" };
  }
  try {
    const data = await buildDiscovery();
    // Empty across the board means GitHub is unreachable or limiting us;
    // keep serving the previous snapshot rather than caching a blank page.
    const empty = data.fresh.length === 0 && data.topByCategory.every((c) => c.repos.length === 0);
    if (empty && cache) return { ...cache.data, cache: "stale", errors: data.errors };
    if (!empty) cache = { at: now, data };
    return data;
  } catch (e) {
    if (cache) return { ...cache.data, cache: "stale", errors: [(e as Error).message] };
    return {
      refreshedAt: new Date().toISOString(),
      cache: "miss",
      fresh: [],
      topByCategory: CATEGORY_QUERIES.map((c) => ({ ...c, repos: [] })),
      errors: [(e as Error).message],
    };
  }
}
