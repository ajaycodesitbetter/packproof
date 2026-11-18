"use client";
import { useState } from "react";
import Link from "next/link";
import { AGENT_GUIDES, AgentId, SKILL_PICKS, TASKS, Task } from "@/lib/skill-catalog";

interface OwnPack { slug: string; name: string; summary: string; category: string; }
const packTask = (category: string): Task => category === "Backend" ? "Code & testing" : category === "UI/UX" ? "Design & UI" : "Research & writing";
export default function SkillsBrowser({ packs, initialTask = "All tasks" }: { packs: OwnPack[]; initialTask?: Task }) {
  const [agent, setAgent] = useState<AgentId | "all">("all");
  const [task, setTask] = useState<Task>(initialTask);
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState("all");
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (text: string) => terms.every(t => text.toLowerCase().includes(t));
  const own = origin === "upstream" ? [] : packs.filter(p => (task === "All tasks" || packTask(p.category) === task) && matches(`${p.name} ${p.summary} ${p.category}`));
  const external = origin === "packproof" ? [] : SKILL_PICKS.filter(p => (task === "All tasks" || p.task === task) && (agent === "all" || p.agents.includes(agent)) && matches(`${p.name} ${p.summary} ${p.maker} ${p.task} ${p.subtask}`));
  const count = own.length + external.length;
  return <>
    <section className="skill-workbench" aria-label="Find a skill">
      <div className="agent-tabs" aria-label="Filter by documented agent support">
        <button aria-pressed={agent === "all"} onClick={() => setAgent("all")}>Any agent</button>
        {(Object.keys(AGENT_GUIDES) as AgentId[]).map(id => <button key={id} aria-pressed={agent === id} onClick={() => setAgent(id)}><span aria-hidden="true">{AGENT_GUIDES[id].mark}</span>{AGENT_GUIDES[id].name}</button>)}
      </div>
      <div className="skill-filters">
        <label>What are you making?<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try captions, browser testing, API..." /></label>
        <label>Task<select value={task} onChange={e => setTask(e.target.value as Task)}>{TASKS.map(t => <option key={t}>{t}</option>)}</select></label>
        <label>Source<select value={origin} onChange={e => setOrigin(e.target.value)}><option value="all">All sources</option><option value="upstream">Upstream shortlist</option><option value="packproof">PackProof packs</option></select></label>
      </div>
      {agent !== "all" ? <aside className="agent-guide">
        <div><b>{AGENT_GUIDES[agent].name}: project skill location</b><code>{AGENT_GUIDES[agent].path}</code></div>
        <p>{AGENT_GUIDES[agent].note} <a href={AGENT_GUIDES[agent].source} target="_blank" rel="noopener noreferrer">Official setup ↗</a></p>
        <p>PackProof packs use the shared SKILL.md format; agent execution is not verified. Upstream results below are limited to their documented agent, not guessed portability.</p>
      </aside> : <p className="skill-filter-note">Choose an agent for its setup guide. Upstream skills without documented agent support appear only under Any agent.</p>}
    </section>
    <div className="skill-result-line"><h2>Find your next workflow</h2><span role="status" aria-live="polite">{count} {count === 1 ? "match" : "matches"}</span></div>
    {count === 0 && <div className="skill-empty"><h3>No matching workflow yet.</h3><p>Try a broader task or choose Any agent. We leave gaps visible instead of inventing recommendations.</p><button onClick={() => { setAgent("all");setTask("All tasks");setQuery("");setOrigin("all"); }}>Reset filters</button></div>}
    <section className="skill-grid" aria-label="Skill results">
      {external.map(p => <article className="skill-note" key={p.id}>
        <div className={`skill-visual visual-${p.task === "Video & motion" ? "video" : p.task === "Design & UI" ? "design" : p.task === "Documents" ? "docs" : "code"}`} aria-hidden="true"><span>{p.subtask}</span>{p.task === "Video & motion" ? <svg className={`video-cue cue-${p.id}`} viewBox="0 0 280 70" fill="none" aria-hidden="true">
          {p.id === "remotion" ? <><rect x="3" y="5" width="94" height="57" rx="2"/><path d="M43 21L63 34L43 47Z"/><path d="M113 14H274M113 34H225M113 54H252"/><rect className="cue-block" x="131" y="8" width="30" height="12"/><rect className="cue-block" x="190" y="28" width="24" height="12"/><rect className="cue-block" x="155" y="48" width="45" height="12"/></> : p.id === "captions" ? <><rect x="3" y="5" width="112" height="57" rx="2"/><path d="M36 25H50M36 25V42H50M68 25H82M68 25V42H82M131 17H261M131 32H235"/><rect className="cue-block" x="131" y="45" width="32" height="12"/><rect x="170" y="45" width="47" height="12"/><rect x="224" y="45" width="50" height="12"/></> : <><rect x="3" y="5" width="89" height="57" rx="2"/><path d="M16 18H35M16 18V32M79 48H60M79 48V34M112 35H125L132 20L140 52L148 27L156 43L166 14L175 56L183 27L193 40L203 33H275M113 61H174M199 61H275"/></>}
        </svg> : <><i></i><i></i><i></i></>}</div>
        <div className="skill-note-body"><div className="skill-byline">{p.maker} · {p.kind === "collection" ? "official collection" : "upstream skill"}</div><h3>{p.name}</h3><p>{p.summary}</p>
        <div className="skill-evidence">Source checked · not run-tested</div>
        <details><summary>Fit, requirements & license</summary><p><b>Good for:</b> {p.useFor}</p><p>{p.caution}</p><p><b>License:</b> {p.license}</p><p>Metadata checked 17 Nov 2026. This is an editorial starting point, not a safety certificate or a best-in-class ranking.</p></details>
        <a className="skill-source-link" href={p.source} target="_blank" rel="noopener noreferrer">Inspect upstream source <span aria-hidden="true">↗</span></a></div>
      </article>)}
      {own.map(p => <article className="skill-note own-skill" key={p.slug}>
        <div className={`skill-visual visual-${p.category === "UI/UX" ? "design" : p.category === "Research" ? "docs" : "code"}`} aria-hidden="true"><span>{packTask(p.category)}</span><i></i><i></i><i></i></div>
        <div className="skill-note-body"><div className="skill-byline">PackProof · workflow document</div><h3>{p.name}</h3><p>{p.summary}</p><div className="skill-evidence sample-evidence">Unvalidated · sample evidence only</div><details><summary>Before you install</summary><p>Real downloadable instructions, not a benchmark-proven improvement. Review the file, choose your agent&apos;s skill folder and keep normal permission prompts enabled.</p><p>Shared SKILL.md format. No cross-agent execution tests have been completed.</p></details><Link className="skill-source-link" href={`/packs/${p.slug}`}>Preview pack & download <span aria-hidden="true">→</span></Link></div>
      </article>)}
    </section>
    <section className="skill-gap-note"><h2>A short list, with the missing pieces left in.</h2><p>Video editing starts with programmatic video, captions and media handling. We have not vetted a general timeline editor, color-grading workflow or audio-cleanup skill yet. More names would not make those gaps disappear.</p><p>No third-party files are mirrored or auto-installed here. Links open their original source for review.</p></section>
  </>;
}
