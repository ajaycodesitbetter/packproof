import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getDiscovery, searchDiscovery, DiscoveredRepo } from "@/lib/discovery";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "date unknown";
  return new Date(t).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function RepoCard({ repo, badge }: { repo: DiscoveredRepo; badge: string }) {
  return (
    <a href={repo.url} target="_blank" rel="noopener noreferrer" className="pack repo">
      <span className="ptape"></span>
      <div className="p-top">
        <span className="repo-lang">{repo.language ?? "repo"}</span>
        <span className="status">{badge}</span>
      </div>
      <h3>{repo.fullName}</h3>
      <div className="ver">
        {repo.stars.toLocaleString()} stars
        {repo.license ? ` · ${repo.license}` : ""}
        {repo.skillFileFound ? " · SKILL.md found" : " · convention match"}
      </div>
      <p className="task">{repo.description ?? "No description on GitHub."}</p>
      <div className="runs">
        created {fmtDate(repo.createdAt)} · last push {fmtDate(repo.pushedAt)}
      </div>
    </a>
  );
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const data = await getDiscovery();
  const search = q ? await searchDiscovery(q) : null;

  return (
    <>
      <Nav active="discover" />
      <main>
        <section className="phead">
          <span className="ptape"></span>
          <h1>Discover on GitHub</h1>
          <div className="ver">
            live from the GitHub Search API · refreshed {fmtDate(data.refreshedAt)}
            {data.cache === "stale" ? " · showing last good snapshot" : ""}
          </div>
          <p className="task">
            Repositories matching agent-skill conventions (a SKILL.md file or the agent-skills /
            claude-skill topics) - not every repo on GitHub. Star counts are a popularity signal,
            not tested quality; PackProof-tested packs live in <a href="/packs">the registry</a>.
            &quot;SKILL.md found&quot; means the file actually loaded from the repo root.
            Data is cached about 6 hours between refreshes.
          </p>
        </section>

        <div className="toolbar">
          <form action="/discover" method="get">
            <input
              type="search"
              name="q"
              placeholder="Search GitHub for skill repos, e.g. design review"
              defaultValue={q}
              aria-label="Search GitHub for skill repos"
            />
            <button type="submit">Search</button>
          </form>
        </div>

        {search && (
          <section>
            <div className="dsec-head">
              <h2>GitHub matches for &quot;{search.q}&quot;</h2>
              <span className="dsec-note">constrained to skill conventions · stars = popularity, not quality</span>
            </div>
            {search.repos.length > 0 ? (
              <section className="packs">
                {search.repos.map((r) => (
                  <RepoCard key={r.fullName} repo={r} badge="search" />
                ))}
              </section>
            ) : (
              <p className="empty-note">
                {search.failed
                  ? `GitHub search is unavailable right now${search.error ? ` (${search.error})` : ""}. Try again later.`
                  : "No skill-convention repos match that yet. Try a broader term."}
              </p>
            )}
          </section>
        )}

        <section>
          <div className="dsec-head">
            <h2>Fresh this week</h2>
            <span className="dsec-note">newly created, newest first</span>
          </div>
          {data.fresh.length > 0 ? (
            <section className="packs">
              {data.fresh.map((r) => (
                <RepoCard key={r.fullName} repo={r} badge="new" />
              ))}
            </section>
          ) : (
            <p className="empty-note">
              {data.freshFailed
                ? "GitHub is rate-limiting us right now - try again later."
                : "No fresh repos matched this week."}
            </p>
          )}
        </section>

        {data.topByCategory.map((c) => (
          <section key={c.category}>
            <div className="dsec-head">
              <h2>{c.category}: most-starred</h2>
              <span className="dsec-note">popularity signal, not tested quality</span>
            </div>
            {c.repos.length > 0 ? (
              <section className="packs">
                {c.repos.map((r) => (
                  <RepoCard key={r.fullName} repo={r} badge={c.category} />
                ))}
              </section>
            ) : (
              <p className="empty-note">
                {c.failed ? "This shelf could not load (GitHub limit). Try again later." : "Nothing matched this shelf yet."}
              </p>
            )}
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
