import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getAllPacks, getPack, fmtDate } from "@/lib/packs";

// Only registry slugs exist; reject unknown routes before streaming a 200 shell.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPacks()
    .filter((p) => p.evidence && p.status === "evidence-complete")
    .map((p) => ({ slug: p.slug }));
}

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pack = getPack(slug);
  if (!pack || !pack.evidence || pack.status !== "evidence-complete") notFound();
  const e = pack.evidence;

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

        <div className="card">
          <span className="ptape"></span>
          <span className="sample-stamp">Sample data</span>
          <h2>What a real report will show</h2>
          <p className="task">
            When real runs exist, this page compares baseline vs pack task by task - same tasks,
            same model, same repo, the pack as the only difference - and keeps failures visible
            instead of cherry-picking. No baseline bars, score columns or verdict labels are shown
            here, because every number on this page is staged.
          </p>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <span className="ptape"></span>
          <span className="sample-stamp">Sample data</span>
          <h2>The staged task matrix</h2>
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
