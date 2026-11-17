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
    { t: "Install the file", d: "Download the pack file, drop it in your agent's skills folder - pinned version, no surprises." },
    { t: "Read the proof", d: "Before/after runs and the failures, published with every release." },
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
              Small workflow packs for your coding agent. The deal: every release ships{" "}
              <b>pinned versions, before-and-after runs, and the failures</b> - so you can check
              the proof before anything touches your project.
            </p>
            <div className="cta-row">
              <Link className="btn b1" href="/packs">Browse packs</Link>
              <Link className="btn b2" href="/method">Methodology</Link>
            </div>
          </div>
        </section>
        <div className="agent-row">
          <span className="cell lbl">Your agent</span>
          {AGENTS.map((a, i) => (
            <span key={a} className={`cell${i === 0 ? " on" : ""}`}>{a}</span>
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
