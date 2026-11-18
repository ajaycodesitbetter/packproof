// One job vocabulary for the whole site: homepage grid, skills filter and
// pack pages all use these names. Legacy task names map in, never out, so old
// /skills?task=... links keep working.
import { TASKS, type Task } from "./skill-catalog";
import { PACKS } from "./packs-data";
import { SKILL_PICKS } from "./skill-catalog";

export interface Job {
  id: string;
  name: string;
  blurb: string;
}

export const JOBS: Job[] = [
  { id: "build-app", name: "Build an app", blurb: "Setup and config plumbing - a full app kit is not vetted yet" },
  { id: "design-ui", name: "Design & UI", blurb: "Interfaces, reviews and visual detail" },
  { id: "video", name: "Video & motion", blurb: "Programmatic video, captions and media" },
  { id: "review-secure", name: "Review code", blurb: "Structured review passes before you ship" },
  { id: "security", name: "Security review", blurb: "Audits and hardening" },
  { id: "test-debug", name: "Test & debug", blurb: "Failing tests first, flaky hunts, regressions" },
  { id: "research-write", name: "Research & write", blurb: "Briefs, scans and sourced writeups" },
  { id: "documents", name: "Documents", blurb: "PDF and document workflows" },
  { id: "data-ml", name: "Data & ML", blurb: "Data handling and model workflows" },
];

const PACK_JOB: Record<string, string> = {
  "api-change-safety-net": "test-debug",
  "flaky-test-hunter": "test-debug",
  "migration-dry-run": "test-debug",
  "env-config-doctor": "build-app",
  "pr-review-pass": "review-secure",
  "design-review-sweep": "design-ui",
  "empty-state-audit": "design-ui",
  "copy-tone-pass": "design-ui",
  "a11y-quick-scan": "design-ui",
  "research-brief": "research-write",
  "competitor-scan": "research-write",
  "paper-trail": "research-write",
};

const TASK_JOB: Record<string, string> = {
  "Code & testing": "test-debug",
  "Design & UI": "design-ui",
  "Research & writing": "research-write",
  "Video & motion": "video",
  Documents: "documents",
};

export const packJob = (slug: string): string => PACK_JOB[slug] ?? "build-app";
export const taskJob = (task: Task): string => TASK_JOB[task] ?? "research-write";

// Accept both ?job= and legacy ?task= and normalize to a job id (or "all").
export function normalizeJobParam(job?: string, task?: string): string {
  if (job && (job === "all" || JOBS.some((j) => j.id === job))) return job;
  if (task && (TASKS as readonly string[]).includes(task)) return taskJob(task as Task);
  return "all";
}

export function jobCounts(): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(JOBS.map((j) => [j.id, 0]));
  for (const p of PACKS) counts[packJob(p.slug)] += 1;
  for (const s of SKILL_PICKS) counts[taskJob(s.task)] += 1;
  return counts;
}
