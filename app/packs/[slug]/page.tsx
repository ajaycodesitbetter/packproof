import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PackInstall from "@/components/PackInstall";
import SkillPreview from "@/components/SkillPreview";
import { AGENT_GUIDES, AGENT_IDS, FIT_LABEL } from "@/lib/agents";
import SaveButton from "@/components/SaveButton";
import { Icon } from "@/components/Icons";
import { getAllPacks, getPack, fmtDate } from "@/lib/packs";
import { STATUS_LABEL } from "@/lib/types";

// Only registry slugs exist; reject unknown routes before streaming a 200 shell.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPacks().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pack = getPack(slug);
  if (!pack) return {};
  return {
    title: `${pack.name} - PackProof`,
    description: pack.tagline,
  };
}

export default async function PackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pack = getPack(slug);
  if (!pack) notFound();
  const e = pack.evidence;
  const st = pack.status === "evidence-complete" ? "ok" : pack.status === "partial" ? "part" : "test";

  return (
    <>
      <Nav active="packs" />
      <main>
        <div className="crumb">
          <Link href="/packs">Packs</Link> /{" "}
          <Link href={`/categories/${encodeURIComponent(pack.category)}`}>{pack.category}</Link> /{" "}
          <b>{pack.slug}</b>
        </div>
        <section className="phead">
          <span className="ptape"></span>
          <div className="ph-top">
            <span className="ph-icon">
              <Icon name={pack.icon} />
            </span>
            <div>
              <h1>{pack.name}</h1>
              <div className="ver">
                v{pack.version} · {fmtDate(pack.released)} · {pack.license} · {pack.category}
              </div>
              <p className="task">{pack.summary}</p>
            </div>
            <div className={`ph-side st-${st}`}>
              <span className="status big">{STATUS_LABEL[pack.status]}</span>
              <div className="ver" style={{ marginTop: 10 }}>
                {AGENT_IDS.map((id) => AGENT_GUIDES[id].name).join(" · ")}
              </div>
              <div className="ver" style={{ marginTop: 4 }}>
                {FIT_LABEL.documented} - runtime behavior not tested by PackProof
              </div>
              <div style={{ marginTop: 12 }}>
                <SaveButton slug={pack.slug} />
              </div>
            </div>
          </div>
        </section>

        <div className="install">
          <span className="ptape"></span>
          {pack.published ? (
            <>
              <span className="cmd">{pack.slug} v{pack.version}</span>
              <a className="btn-dl" href={`/api/packs/${pack.slug}/download?version=${encodeURIComponent(pack.version)}`}>
                Download SKILL.md
              </a>
              <span className="note">
                version-checked download · no account needed · inspect before adding
              </span>
              <PackInstall slug={pack.slug} version={pack.version} />
            </>
          ) : (
            <>
              <span className="cmd">{pack.slug} v{pack.version}</span>
              <span className="note">
                not published yet - this pack is still in testing. The file ships when its evidence
                does.
              </span>
            </>
          )}
        </div>

        {pack.published && <SkillPreview slug={pack.slug} />}

        {e && (
          <div className="stats" style={{ position: "relative" }}>
          <span className="sample-stamp" style={{ top: -14, right: 6 }}>Sample data</span>
            <div className="stat">
              <div className="v">{e.runs}</div>
              <div className="l">sample rows - not real evaluation results</div>
            </div>
            <div className="stat">
              <div className="v">{e.taskCount}</div>
              <div className="l">tasks in the staged matrix</div>
            </div>
            <div className="stat">
              <div className="v">{e.reps}</div>
              <div className="l">reps per cell, staged</div>
            </div>
            <div className="stat">
              <div className="v txt">{STATUS_LABEL[pack.status]}</div>
              <div className="l">evidence status</div>
            </div>
          </div>
        )}

        <div className="grid2">
          {e && (
            <div className="card">
              <span className="ptape"></span>
              <span className="sample-stamp">Sample data</span>
              <h2>Tasks</h2>
              <div className="twrap">
              <table className="ttasks">
                <thead>
                  <tr>
                    <th>Task in the staged matrix</th>
                    <th>Reps</th>
                    <th>Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {e.tasks.map((t) => (
                    <tr key={t.task}>
                      <td className="mono">{t.task}</td>
                      <td className="num">{t.reps}</td>
                      <td className="num">staged</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="note-card" style={{ marginTop: 10 }}>
                Sample rows, not real evaluation results - so no baseline/with-pack scores or
                verdict labels are shown.
              </p>
              </div>
              {pack.status === "evidence-complete" && (
                <p className="note-card" style={{ marginTop: 12 }}>
                  Full run log: <Link href={`/reports/${pack.slug}`} style={{ color: "#b4432f" }}>release report {e.reportId}</Link> (sample data).
                </p>
              )}
            </div>
          )}
          <div className="card">
            <h2>Versions <span className="vh-sample">sample history</span></h2>
            <div className="vlist">
              {pack.changelog.map((c) => (
                <div key={c.version}>
                  <span className="vh">{c.version}</span> · {fmtDate(c.date)} - {c.note}
                </div>
              ))}
            </div>
            <p className="vh-note">
              Illustrative entries, not a record of real releases - they show how version history
              will read once packs ship real versions.
            </p>
            {pack.doesNot && (
              <>
                <h2 style={{ marginTop: 18 }}>What it does not do</h2>
                <div className="note-card" style={{ marginTop: 8 }}>
                  {pack.doesNot.map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {e?.keptFailures && (
          <div className="callout">
            <b>{pack.status === "partial" ? "Status" : "Staged example scenario"}</b> - {e.keptFailures}
          </div>
        )}
        {!e && pack.reportDue && (
          <div className="callout">
            <b>In testing</b> - {pack.reportDue}. No runs on record yet; nothing is claimed until the
            evidence report ships.
          </div>
        )}
      </main>
      <Footer label="Pack detail" />
    </>
  );
}
