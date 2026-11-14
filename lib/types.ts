export type Category = "Backend" | "Research" | "UI/UX";

export type PackStatus = "evidence-complete" | "partial" | "testing";

export type Verdict =
  | "improved"
  | "regression"
  | "no-change"
  | "correctly-idle"
  | "pending";

export interface TaskRow {
  task: string;
  baseSolved: number;
  packSolved: number | null;
  reps: number;
  baseTicks?: string[];
  packTicks?: string[];
  verdict: Verdict;
}

export interface Evidence {
  runs: number;
  taskCount: number;
  reps: number;
  agent: string;
  reportId: string;
  baseSolved: number;
  baseTotal: number;
  packSolved: number | null;
  packTotal: number;
  improved: number;
  regressions: number;
  noChange: number;
  correctlyIdle: number;
  tasks: TaskRow[];
  keptFailures: string;
  reproduce: string;
}

export interface VersionEntry {
  version: string;
  date: string;
  note: string;
}

export interface Pack {
  slug: string;
  name: string;
  category: Category;
  version: string;
  released: string;
  license: string;
  icon: "shield" | "branch" | "layout" | "doc" | "flask" | "gauge" | "env" | "a11y" | "type" | "scan";
  status: PackStatus;
  published: boolean;
  tagline: string;
  summary: string;
  agents: string[];
  evidence?: Evidence;
  changelog: VersionEntry[];
  doesNot?: string[];
  reportDue?: string;
}

export const STATUS_LABEL: Record<PackStatus, string> = {
  "evidence-complete": "Sample report",
  partial: "Sample partial",
  testing: "In testing",
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  improved: "Improved",
  regression: "Regression",
  "no-change": "No change",
  "correctly-idle": "Correctly idle",
  pending: "Pending",
};
