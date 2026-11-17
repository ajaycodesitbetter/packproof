import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology - PackProof",
  description:
    "The rules every release report follows: same tasks, same model, repetitions, regressions kept in the report.",
};

export default function MethodPage() {
  return (
    <>
      <Nav active="method" />
      <main>
        <div className="crumb">
          <b>Methodology</b>
        </div>
        <section className="phead">
          <span className="ptape"></span>
          <h1>How a pack earns its proof</h1>
          <div className="ver">The rules every release report follows</div>
        </section>
        <div className="prose">
          <h2>
            <span className="tick">1.</span>Same tasks, same model, same repo
          </h2>
          <p>
            A release report runs each task twice: once with the agent alone (baseline), once with
            the pack installed. The only difference between the two halves is the pack file. Task
            set, model version, seeds and the repo snapshot are pinned in the report so anyone can
            rerun it.
          </p>
          <h2>
            <span className="tick">2.</span>Repetitions, not anecdotes
          </h2>
          <p>
            Every task runs three times per condition. Agents are nondeterministic; a single lucky
            run proves nothing. The report shows every repetition - the ticks, not just the totals.
          </p>
          <h2>
            <span className="tick">3.</span>Regressions stay in the report
          </h2>
          <p>
            A pack that improves five tasks and breaks one is a pack that breaks one. Regressions
            and no-change results are printed next to the wins, with a named fix version. A release
            that hides a failure does not ship.
          </p>
          <h2>
            <span className="tick">4.</span>Not measured means not measured
          </h2>
          <p>
            Packs still in testing show an empty, dashed meter - never a partial score. A status of
            &quot;partial&quot; means exactly which half of the runs is done. Nothing rounds up.
          </p>
          <h2>
            <span className="tick">5.</span>What a pack is
          </h2>
          <p>
            A pack is a small workflow document your agent reads - rules, order of operations, hard
            boundaries. It is not a plugin, not a binary, and it never runs code on your machine.
            Installing is downloading one file into your agent&apos;s skills folder; removing is
            deleting it.
          </p>
          <ul>
            <li>Reads your repo and the diff you ask about</li>
            <li>Writes only inside the pack&apos;s own folder</li>
            <li>No account, no telemetry, no network at run time</li>
          </ul>
          <p style={{ marginTop: 22 }}>
            <em>
              Concept stage note: the registry currently ships staged sample evidence so the report
              format can be reviewed. Live benchmark runs are the next milestone.
            </em>
          </p>
        </div>
      </main>
      <Footer label="Methodology" />
    </>
  );
}
