// Single source of truth for agent support across the whole site.
// Every path claim below was verified against the official documentation at
// the listed source URL on 2026-11-18 (read in a real browser; the docs are
// JS-rendered). Fit states:
//  - "documented": official docs describe a project skills path. This is an
//    install-path claim only - not a runtime compatibility test. PackProof has
//    not tested runtime behavior with ANY agent; measured evidence lives on
//    each pack's evidence record, separate from this list.
//  - "community-reported": a real, linkable user report exists. Unused today.
//  - "unknown": no official documentation found. Download only.
export type AgentId = "claude" | "codex" | "antigravity" | "cursor" | "windsurf";
export type AgentFit = "documented" | "community-reported" | "unknown";

export interface AgentGuide {
  id: AgentId;
  name: string;
  mark: string;
  path: string | null; // verified project skills path; <name> is the pack slug
  source: string | null; // official docs URL backing the path claim
  note: string;
  fit: AgentFit;
}

export const AGENT_GUIDES: Record<AgentId, AgentGuide> = {
  claude: {
    id: "claude",
    name: "Claude Code",
    mark: "C",
    path: ".claude/skills/<name>/SKILL.md",
    source: "https://code.claude.com/docs/en/skills",
    note: "Project-local skills. Personal (~/.claude/skills) and enterprise locations also exist; Claude web uploads use a different flow.",
    fit: "documented",
  },
  codex: {
    id: "codex",
    name: "Codex",
    mark: ">_",
    path: ".agents/skills/<name>/SKILL.md",
    source: "https://developers.openai.com/codex/skills",
    note: "Codex scans .agents/skills from the working directory up to the repository root. User, admin and system locations also exist.",
    fit: "documented",
  },
  antigravity: {
    id: "antigravity",
    name: "Antigravity",
    mark: "A",
    path: ".agents/skills/<name>/SKILL.md",
    source: "https://antigravity.google/docs/skills",
    note: "Default is .agents/skills; the older .agent/skills folder stays supported. Reload skills after adding.",
    fit: "documented",
  },
  cursor: {
    id: "cursor",
    name: "Cursor",
    mark: "\u25B8",
    path: ".cursor/skills/<name>/SKILL.md",
    source: "https://cursor.com/docs/skills",
    note: "Project skills live in .cursor/skills (Cursor also reads .agents/skills and Claude/Codex folders). User-level: ~/.cursor/skills.",
    fit: "documented",
  },
  windsurf: {
    id: "windsurf",
    name: "Windsurf",
    mark: "~",
    path: ".agents/skills/<name>/SKILL.md",
    source: "https://docs.devin.ai/desktop/devin-local/customizations",
    note: "Windsurf (now documented under Devin) reads .agents/skills and the legacy .windsurf/skills. Global: ~/.agents/skills.",
    fit: "documented",
  },
};

export const AGENT_IDS = Object.keys(AGENT_GUIDES) as AgentId[];

export const FIT_LABEL: Record<AgentFit, string> = {
  documented: "Documented install path",
  "community-reported": "Community reported",
  unknown: "Unknown",
};
