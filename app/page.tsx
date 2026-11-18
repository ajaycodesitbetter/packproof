import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PackCard from "@/components/PackCard";
import { getCategories, getFeatured } from "@/lib/packs";
import { AGENTS } from "@/lib/packs-data";

export default function Home() {
  const featured = getFeatured();
  const cats = getCategories();
  const total = cats.reduce((n, c) => n + c.count, 0);
  const steps = [
    { t: "Pick a task", d: "Workflow packs across research, UI/UX and backend." },
    { t: "Inspect the file", d: "Read the instructions and requirements before adding them to your agent." },
    { t: "Check the evidence", d: "Sample reports are marked. No real benchmark results are claimed yet." },
  ];
  return (
    <>
      <Nav />
      <main>
        <section className="hero-split">
          <div>
            <span className="kicker">Skill packs · proof-first by design</span>
            <h1 className="hero">
              Skills that
              <br />
              <span className="u">show</span> <span className="hl2">their</span>
              <br />
              work.
            </h1>
          </div>
          <div className="hero-right">
            <span className="tape1"></span>
            <p className="sub">
              Useful workflows for your agent, with <b>the source, the setup, and the limits</b>
              {" "}in one place. Find a starting point. Check it before it touches your project.
            </p>
            <div className="cta-row">
              <Link className="btn b1" href="/skills">Find a skill</Link>
              <Link className="btn b2" href="/packs">PackProof packs</Link>
            </div>
          </div>
        </section>
        <section className="home-task-paths" aria-label="Start with a task">
          <Link href="/skills?task=Code%20%26%20testing"><span className="path-graphic code-path" aria-hidden="true">+ test<br />- guess</span><b>Ship better code</b><small>Reviews, tests & debugging</small><span aria-hidden="true">→</span></Link>
          <Link href="/skills?task=Design%20%26%20UI"><span className="path-graphic design-path" aria-hidden="true"><i /><i /><i /></span><b>Make it feel right</b><small>Interfaces & visual details</small><span aria-hidden="true">→</span></Link>
          <Link href="/skills?task=Video%20%26%20motion"><span className="path-graphic video-path" aria-hidden="true">▶<i /><i /></span><b>Tell it in motion</b><small>Video, captions & media</small><span aria-hidden="true">→</span></Link>
        </section>
        <div className="agent-row">
          <span className="cell lbl">SKILL.md workflows</span>
          {AGENTS.map((a) => (
            <span key={a} className="cell">{a}</span>
          ))}
        </div>
        <div className="catrow" id="categories">
          <span className="catlbl">Browse</span>
          <Link className="chip on" href="/packs">
            All <i>{total}</i>
          </Link>
          {cats.map((c) => (
            <Link key={c.name} className="chip" href={`/categories/${encodeURIComponent(c.name)}`}>
              {c.name} <i>{c.count}</i>
            </Link>
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
