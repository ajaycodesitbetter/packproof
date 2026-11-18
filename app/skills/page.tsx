import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SkillsBrowser from "@/components/SkillsBrowser";
import { getAllPacks } from "@/lib/packs";
import { normalizeJobParam } from "@/lib/jobs";
export const metadata: Metadata = {title: "Skill field guide - PackProof", description: "Find agent workflows by task. Source-linked picks, setup guides and clear evidence labels for Claude Code, Codex and Antigravity."};
export default async function SkillsPage({searchParams}: {searchParams: Promise<{task?: string; job?: string; q?: string}>}) {
  const sp = await searchParams;
  const initialJob = normalizeJobParam(sp.job, sp.task);
  const initialQuery = (sp.q ?? "").slice(0, 120);
  const packs = getAllPacks().map(({slug,name,summary,tagline,category})=>({slug,name,summary,tagline,category}));
  return <><Nav active="skills" /><main>
    <section className="field-guide-head">
      <div><span className="kicker">The workflow field guide</span><h1>Less hunting.<br /><span>More making.</span></h1><p>Start with what you want to do. Find a useful workflow, check the source, and know what you&apos;re installing.</p></div>
      <div className="field-index" aria-label="How this guide works"><span className="ptape" /><b>Know before you add</b><ol><li><span>01</span>Does it fit your task?</li><li><span>02</span>What does your agent need?</li><li><span>03</span>What has actually been tested?</li></ol><small>Curated starting points. No paid placements.<br />No invented quality scores.</small></div>
    </section>
    <SkillsBrowser packs={packs} initialJob={initialJob} initialQuery={initialQuery} />
    <p className="skill-nonaffiliation">Independent guide. Not affiliated with Anthropic, OpenAI or Google. Product names belong to their owners.</p>
  </main><Footer label="Skill field guide" /></>;
}
