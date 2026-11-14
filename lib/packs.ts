import { PACKS } from "./packs-data";
import { Category, Pack } from "./types";

export function getAllPacks(): Pack[] {
  return PACKS;
}

export function getPack(slug: string): Pack | undefined {
  return PACKS.find((p) => p.slug === slug);
}

export function getFeatured(): Pack[] {
  return PACKS.filter((p) => p.published);
}

export interface CategoryCount {
  name: Category;
  count: number;
}

export function getCategories(): CategoryCount[] {
  const counts = new Map<Category, number>();
  for (const p of PACKS) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  const order: Category[] = ["Research", "UI/UX", "Backend"];
  return order
    .filter((c) => counts.has(c))
    .map((c) => ({ name: c, count: counts.get(c) ?? 0 }));
}

export function getByCategory(category: Category): Pack[] {
  return PACKS.filter((p) => p.category === category);
}

export function normalizeCategory(raw: string): Category | undefined {
  const needle = raw.toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, Category> = {
    research: "Research",
    uiux: "UI/UX",
    backend: "Backend",
  };
  return map[needle];
}

export function searchPacks(query: string): Pack[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  return PACKS.map((p) => {
    const hay = [p.name, p.slug, p.category, p.tagline, p.summary, p.status]
      .join(" ")
      .toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (p.name.toLowerCase().includes(t)) score += 5;
      else if (p.slug.includes(t)) score += 4;
      else if (p.category.toLowerCase().includes(t)) score += 3;
      else if (hay.includes(t)) score += 1;
      else return null;
    }
    return { pack: p, score };
  })
    .filter((r): r is { pack: Pack; score: number } => r !== null)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.pack);
}

export interface ChangelogEntry {
  slug: string;
  packName: string;
  version: string;
  date: string;
  note: string;
}

export function getChangelog(): ChangelogEntry[] {
  return PACKS.flatMap((p) =>
    p.changelog.map((c) => ({
      slug: p.slug,
      packName: p.name,
      version: c.version,
      date: c.date,
      note: c.note,
    }))
  ).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function pct(solved: number, total: number): number {
  return Math.round((solved / total) * 100);
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}

// Idle-aware scoring: "correctly idle" runs are not attempts and must never
// be counted as wins. Headline scores count attempted runs only.
export function idleRunCount(e: { tasks: { packTicks?: string[] }[] }): number {
  return e.tasks.reduce(
    (n, t) => n + (t.packTicks ?? []).filter((x) => x === "idle").length,
    0
  );
}
export function attemptedSolved(e: { packSolved: number | null; tasks: { packTicks?: string[] }[] }): number {
  if (e.packSolved === null) return 0;
  return e.packSolved - idleRunCount(e);
}
export function attemptedTotal(e: { packTotal: number; tasks: { packTicks?: string[] }[] }): number {
  return e.packTotal - idleRunCount(e);
}
