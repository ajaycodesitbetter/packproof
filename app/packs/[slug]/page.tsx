import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CopyButton from "@/components/CopyButton";
import SaveButton from "@/components/SaveButton";
import { Icon } from "@/components/Icons";
import { getAllPacks, getPack, pct, fmtDate } from "@/lib/packs";
import { STATUS_LABEL, VERDICT_LABEL, Verdict } from "@/lib/types";

export function generateStaticParams() {
  return getAllPacks().map((p) => ({ slug: p.slug }));
}

const VD_CLASS: Record<Verdict, string> = {
  improved: "imp",
  regression: "reg",
  "no-change": "same",
  "correctly-idle": "idle",
  pending: "pend",
};

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
                {pack.agents.join(" · ")}
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
              <a className="btn-dl" href={`/api/packs/${pack.slug}/download`}>
                Download SKILL.md
              </a>
              <CopyButton
                text={`mkdir -p .packs/${pack.slug} && curl -sL "$SITE/api/packs/${pack.slug}/download" -o .packs/${pack.slug}/SKILL.md`}
                label="copy install cmd"
              />
              <span className="note">
                pinned version · no account needed · drop the file in your agent&apos;s skills folder
              </span>
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

        {e && (
          <div className="stats" style={{ position: "relative" }}>
          <span className="sample-stamp">Sample data</span>
            <div className="stat">
              <div className="v">{e.runs}</div>
              <div className="l">runs · {e.taskCount} tasks × {e.reps} reps × 2</div>
            </div>
            <div className="stat">
              <div className="v">
                {e.baseSolved}/{e.baseTotal}
              </div>
              <div className="l">baseline ({pct(e.baseSolved, e.baseTotal)}%)</div>
            </div>
            <div className="stat">
              <div className="v">{e.packSolved !== null ? `${e.packSolved}/${e.packTotal}` : "-"}</div>
              <div className="l">
                {e.packSolved !== null ? `with pack (${pct(e.packSolved, e.packTotal)}%)` : "with pack - in progress"}
              </div>
            </div>
            <div className="stat">
              <div className="v">{e.regressions}</div>
              <div className="l">regression{e.regressions === 1 ? "" : "s"} kept in report</div>
            </div>
          </div>
        )}

        <div className="grid2">
          {e && (
            <div className="card">
              <span className="ptape"></span>
              <span className="sample-stamp">Sample data</span>
              <h2>Tasks</h2>
              <table className="ttasks">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Baseline</th>
                    <th>With pack</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {e.tasks.map((t) => (
                    <tr key={t.task}>
                      <td className="mono">{t.task}</td>
                      <td className="num">
                        {t.baseSolved}/{t.reps}
                      </td>
                      <td className="num">{t.packSolved !== null ? `${t.packSolved}/${t.reps}` : "-"}</td>
                      <td>
                        <span className={`vd ${VD_CLASS[t.verdict]}`}>{VERDICT_LABEL[t.verdict]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pack.status === "evidence-complete" && (
                <p className="note-card" style={{ marginTop: 12 }}>
                  Full run log: <Link href={`/reports/${pack.slug}`} style={{ color: "#b4432f" }}>release report {e.reportId}</Link> (sample data).
                </p>
              )}
            </div>
          )}
          <div className="card">
            <h2>Versions</h2>
            <div className="vlist">
              {pack.changelog.map((c) => (
                <div key={c.version}>
                  <span className="vh">{c.version}</span> · {fmtDate(c.date)} - {c.note}
                </div>
              ))}
            </div>
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
            <b>{pack.status === "partial" ? "Status" : "Kept failure"}</b> - {e.keptFailures}
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
