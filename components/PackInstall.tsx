"use client";
import { useState } from "react";
import InstallCommand from "./InstallCommand";
import { AGENT_GUIDES, AGENT_IDS, AgentId, FIT_LABEL } from "@/lib/agents";
export default function PackInstall({slug, version}: {slug: string; version: string}) {
  const [agent, setAgent] = useState<AgentId | "download">("download");
  const guide = agent === "download" ? null : AGENT_GUIDES[agent];
  const site = typeof window !== "undefined" ? window.location.origin : "https://packproof.ajaymathuriya.com";
  const folder = guide?.path ? guide.path.replace("<name>", slug) : `.packs/${slug}`;
  const command = `mkdir -p ${folder} && curl -fSL "${site}/api/packs/${slug}/download?version=${encodeURIComponent(version)}" -o ${folder}/SKILL.md`;
  return <div className="pack-install-guide">
    <label>Save for <select value={agent} onChange={e=>setAgent(e.target.value as AgentId | "download")}><option value="download">Download only</option>{AGENT_IDS.map(id=><option key={id} value={id}>{AGENT_GUIDES[id].name} - {FIT_LABEL[AGENT_GUIDES[id].fit]}</option>)}</select></label>
    {guide && !guide.path
      ? <p>{guide.name}: {guide.note} Use Download only and place the file where your own setup expects it.{guide.source ? <> <a href={guide.source} target="_blank" rel="noopener noreferrer">Official docs ↗</a></> : null}</p>
      : <InstallCommand text={command} />}
    {guide?.path ? <p>{guide.name} project folder. {guide.source ? <a href={guide.source} target="_blank" rel="noopener noreferrer">Official setup ↗</a> : null} Documented install path only - runtime behavior has not been tested by PackProof.</p> : null}
    <p>macOS / Linux shell command. On Windows, use the download button and save as SKILL.md in the chosen folder. Review the file first; adding instructions can change your agent&apos;s behavior.</p>
  </div>;
}
