import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getDiscovery, DiscoveredRepo } from "@/lib/discovery";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
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
      </div>
      <p className="task">{repo.description ?? "No description on GitHub."}</p>
      <div className="runs">
        created {fmtDate(repo.createdAt)} · last push {fmtDate(repo.pushedAt)}
      </div>
    </a>
  );
}

export default async function DiscoverPage() {
  const data = await getDiscovery();
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
            Data is cached about 6 hours between refreshes.
          </p>
        </section>

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
              No fresh repos right now{data.errors.length ? " - GitHub is rate-limiting us; try again later." : "."}
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
              <p className="empty-note">Nothing loaded for this shelf yet.</p>
            )}
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
