"use client";
import { useState } from "react";
import InstallCommand from "./InstallCommand";
import { AGENT_GUIDES, AgentId } from "@/lib/skill-catalog";
export default function PackInstall({slug, version}: {slug: string; version: string}) {
  const [agent, setAgent] = useState<AgentId | "download">("download");
  const folder = agent === "download" ? `.packs/${slug}` : `${agent === "claude" ? ".claude" : ".agents"}/skills/${slug}`;
  const command = `mkdir -p ${folder} && curl -fSL "$SITE/api/packs/${slug}/download?version=${encodeURIComponent(version)}" -o ${folder}/SKILL.md`;
  return <div className="pack-install-guide">
    <label>Save for <select value={agent} onChange={e=>setAgent(e.target.value as AgentId | "download")}><option value="download">Download only</option>{(Object.keys(AGENT_GUIDES) as AgentId[]).map(id=><option key={id} value={id}>{AGENT_GUIDES[id].name}</option>)}</select></label>
    <InstallCommand text={command} />
    <p>{agent === "download" ? "Stores a review copy in .packs. This does not automatically install it in an agent." : <>{AGENT_GUIDES[agent].name} project folder. <a href={AGENT_GUIDES[agent].source} target="_blank" rel="noopener noreferrer">Official setup ↗</a> Runtime behavior has not been tested by PackProof.</>}</p>
    <p>macOS / Linux shell command. On Windows, use the download button and save as SKILL.md in the chosen folder. Review the file first; adding instructions can change your agent&apos;s behavior.</p>
  </div>;
}
