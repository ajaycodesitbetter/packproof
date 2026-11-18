import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getAllPacks, getPack, pct, fmtDate, idleRunCount, attemptedSolved, attemptedTotal } from "@/lib/packs";
import { VERDICT_LABEL, Verdict } from "@/lib/types";

// Only registry slugs exist; reject unknown routes before streaming a 200 shell.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPacks()
    .filter((p) => p.evidence && p.status === "evidence-complete")
    .map((p) => ({ slug: p.slug }));
}

const VD_CLASS: Record<Verdict, string> = {
  improved: "imp",
  regression: "reg",
  "no-change": "same",
  "correctly-idle": "idle",
  pending: "pend",
};

function Ticks({ ticks }: { ticks?: string[] }) {
  if (!ticks) return null;
  return (
    <span className="ticks">
      {ticks.map((t, i) =>
        t === "idle" ? (
          <span key={i} className="idl" title="correctly idle (pack not run)">
            –
          </span>
        ) : (
          <span key={i} className={t === "pass" ? "ok" : "no"}>
            {t === "pass" ? "✓" : "✗"}
          </span>
        )
      )}
    </span>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pack = getPack(slug);
  if (!pack || !pack.evidence || pack.status !== "evidence-complete") notFound();
  const e = pack.evidence;
  const basePct = pct(e.baseSolved, e.baseTotal);
  const attSolved = attemptedSolved(e);
  const attTotal = attemptedTotal(e);
  const packPct = pct(attSolved, attTotal);
  const idleRuns = idleRunCount(e);

  return (
    <>
      <Nav active="packs" />
      <main>
        <div className="crumb">
          <Link href="/packs">Packs</Link> / {pack.category} /{" "}
          <Link href={`/packs/${pack.slug}`}>{pack.slug}</Link> / <b>release report v{pack.version}</b>
        </div>
        <section className="phead">
          <span className="ptape"></span>
          <h1>Release report</h1>
          <div className="ver">
            {pack.slug} v{pack.version} · {fmtDate(pack.released)} · agent: {e.agent} · report{" "}
            {e.reportId} (sample)
          </div>
          <p className="task">
            {e.taskCount} tasks × {e.reps} repetitions × 2 conditions = {e.runs} runs. Same tasks,
            same model, same repo. The pack is the only difference. This is a staged demo report
            showing the format - the numbers are not from live runs.
          </p>
        </section>

        <div className="bigmeter">
          <span className="ptape"></span>
          <span className="sample-stamp">Sample data</span>
          <h2>Tasks passed, baseline vs pack</h2>
          <div className="row">
            <span className="who">BASE</span>
            <div className="bar">
              <i className="b1" style={{ width: `${basePct}%` }}></i>
            </div>
            <span className="val">
              {e.baseSolved}/{e.baseTotal} · {basePct}%
            </span>
          </div>
          <div className="row">
            <span className="who">PACK</span>
            <div className="bar">
              <i className="b2" style={{ width: `${packPct}%` }}></i>
            </div>
            <span className="val">
              {attSolved}/{attTotal} attempted · {packPct}%{idleRuns > 0 ? ` · ${idleRuns} correctly idle` : ""}
            </span>
          </div>
          <div className="sumchips">
            <span className="vd imp">{e.improved} improved</span>
            <span className="vd reg">
              {e.regressions} regression{e.regressions === 1 ? "" : "s"}
            </span>
            <span className="vd same">{e.noChange} no change</span>
            <span className="vd idle">{e.correctlyIdle} correctly idle</span>
          </div>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <span className="ptape"></span>
          <span className="sample-stamp">Sample data</span>
          <h2>Every run, no cherry-picking</h2>
          <div className="twrap">
          <table className="ttasks">
            <thead>
              <tr>
                <th>Task</th>
                <th>Baseline reps</th>
                <th>Pack reps</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {e.tasks.map((t) => (
                <tr key={t.task}>
                  <td className="mono">{t.task}</td>
                  <td>
                    <Ticks ticks={t.baseTicks} />{" "}
                    <span className="num">
                      {t.baseSolved}/{t.reps}
                    </span>
                  </td>
                  <td>
                    <Ticks ticks={t.packTicks} />{" "}
                    <span className="num">
                      {t.verdict === "correctly-idle" ? `${t.reps} idle` : `${t.packSolved}/${t.reps}`}
                    </span>
                  </td>
                  <td>
                    <span className={`vd ${VD_CLASS[t.verdict]}`}>{VERDICT_LABEL[t.verdict]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="grid2">
          <div className="callout" style={{ marginTop: 0 }}>
            <b>Kept failures</b> - {e.keptFailures}
          </div>
          <div className="card" style={{ marginTop: 0 }}>
            <h2>How to reproduce</h2>
            <div className="note-card" style={{ marginTop: 8 }}>
              {e.reproduce} This report is staged sample data for the concept stage - the structure
              is final, the numbers are not from live runs.
            </div>
          </div>
        </div>
      </main>
      <Footer label="Release report" />
    </>
  );
}
