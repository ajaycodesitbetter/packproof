import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FlowerDoodle from "@/components/FlowerDoodle";
import { AGENT_GUIDES, AGENT_IDS } from "@/lib/agents";
import { JOBS, jobCounts } from "@/lib/jobs";

const STARTERS = [
  { use: "Design an interface that feels intentional", name: "Frontend design", maker: "Anthropic", badge: "Upstream - source checked", href: "/skills?job=design-ui" },
  { use: "Catch regressions before you change an API", name: "API Change Safety Net", maker: "PackProof", badge: "Pack - sample report", href: "/packs/api-change-safety-net" },
  { use: "Review a small PR in three passes", name: "PR Review Pass", maker: "PackProof", badge: "Pack - sample partial", href: "/packs/pr-review-pass" },
  { use: "Add captions to a programmatic video", name: "Caption workflow", maker: "Remotion", badge: "Upstream - source checked", href: "/skills?job=video" },
  { use: "Extract and combine PDF documents", name: "PDF processing", maker: "Anthropic", badge: "Upstream - source checked", href: "/skills?job=documents" },
  { use: "Turn a loose question into a sourced brief", name: "Research Brief", maker: "PackProof", badge: "Pack - not evaluated", href: "/packs/research-brief" },
];

export default function Home() {
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
        <div className="jobs-head">
          <h2 className="jobs-title">Good starting points</h2>
        </div>
        <section className="starter-grid" aria-label="Good starting points">
          {STARTERS.map((s) => (
            <Link key={s.name} className="starter-card" href={s.href}>
              <b>{s.use}</b>
              <span className="starter-name">{s.name} · {s.maker}</span>
              <span className="starter-badge">{s.badge}</span>
            </Link>
          ))}
        </section>
        <p className="starter-more"><Link href="/skills">See all {total} workflows in the field guide →</Link> or <Link href="/packs">browse PackProof packs</Link>.</p>
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
