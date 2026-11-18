import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PackCard from "@/components/PackCard";
import FlowerDoodle from "@/components/FlowerDoodle";
import { getFeatured } from "@/lib/packs";
import { AGENT_GUIDES, AGENT_IDS } from "@/lib/agents";
import { JOBS, jobCounts } from "@/lib/jobs";

export default function Home() {
  const featured = getFeatured();
  const counts = jobCounts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const steps = [
    { t: "Say what you're making", d: "Pick a job in plain words - no skill names or jargon needed." },
    { t: "Inspect before you install", d: "Every pack shows its actual SKILL.md, the source, and the setup for your agent." },
    { t: "See what's proven", d: "Sample reports are marked as samples. Missing evidence stays visible." },
  ];
  return (
    <>
      <Nav />
      <main>
        <section className="hero-split">
          <div>
            <span className="kicker reveal-stamp">One place for agent skills</span>
            <h1 className="hero reveal-up">
              What does your
              <br />
              agent need to <span className="u">do</span><span className="hl2">?</span>
            </h1>
          </div>
          <div className="hero-right">
            <span className="tape1"></span>
            <p className="sub">
              Pick a job in plain words. Get a workflow with <b>the source, the setup, and the honest limits</b>
              {" "}attached. No fake rankings. No invented scores.
            </p>
            <div className="cta-row">
              <Link className="btn b1" href="#jobs">Start with your job</Link>
              <Link className="btn b2" href="/skills">Browse all {total}</Link>
            </div>
          </div>
        </section>
        <div className="jobs-head">
          <h2 className="jobs-title">Start with your job</h2>
          <FlowerDoodle className="fl-1" color="var(--red)" />
          <FlowerDoodle className="fl-2" color="var(--green)" />
          <FlowerDoodle className="fl-3" color="var(--gold)" />
        </div>
        <section className="job-grid" id="jobs" aria-label="Start with your job">
          {JOBS.map((j) => {
            const n = counts[j.id] ?? 0;
            return n > 0 ? (
              <Link key={j.id} className="job-card" href={`/skills?job=${j.id}`}>
                <b>{j.name}</b>
                <small>{j.blurb}</small>
                <span className="job-count">{n} {n === 1 ? "workflow" : "workflows"}</span>
                <span className="job-arrow" aria-hidden="true">→</span>
              </Link>
            ) : (
              <Link key={j.id} className="job-card job-empty" href={`/discover?q=${encodeURIComponent(j.name)}`}>
                <b>{j.name}</b>
                <small>{j.blurb}</small>
                <span className="job-count">Nothing vetted yet - try GitHub, unvetted</span>
                <span className="job-arrow" aria-hidden="true">↗</span>
              </Link>
            );
          })}
        </section>
        <div className="agent-row" aria-label="Agents with a documented skills path">
          <span className="cell lbl">Documented install paths</span>
          {AGENT_IDS.map((id) => (
            <span key={id} className="cell" title={AGENT_GUIDES[id].note}>{AGENT_GUIDES[id].name}</span>
          ))}
        </div>
        <section className="packs">
          {featured.map((p) => (
            <PackCard key={p.slug} pack={p} />
          ))}
        </section>
        <section className="journey">
          {steps.map((s, i) => (
            <div className="step" key={s.t}>
              <span className="s-num">{i + 1}</span>
              <b>{s.t}</b>
              <p>{s.d}</p>
            </div>
          ))}
        </section>
      </main>
      <Footer label="Home" />
    </>
  );
}
