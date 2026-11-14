import { NextRequest, NextResponse } from "next/server";
import { getAllPacks, normalizeCategory, searchPacks } from "@/lib/packs";
import { STATUS_LABEL } from "@/lib/types";

function shape(p: ReturnType<typeof getAllPacks>[number]) {
  return {
    slug: p.slug,
    name: p.name,
    category: p.category,
    version: p.version,
    released: p.released,
    license: p.license,
    status: p.status,
    status_label: STATUS_LABEL[p.status],
    published: p.published,
    tagline: p.tagline,
    agents: p.agents,
    evidence: p.evidence
      ? {
          runs: p.evidence.runs,
          base: { solved: p.evidence.baseSolved, total: p.evidence.baseTotal },
          pack:
            p.evidence.packSolved === null
              ? null
              : { solved: p.evidence.packSolved, total: p.evidence.packTotal },
          improved: p.evidence.improved,
          regressions: p.evidence.regressions,
        }
      : null,
    links: {
      pack: `/packs/${p.slug}`,
      download: p.published ? `/api/packs/${p.slug}/download` : null,
      report:
        p.status === "evidence-complete" ? `/reports/${p.slug}` : null,
    },
    sample_data: true,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const categoryRaw = searchParams.get("category");

  let packs = getAllPacks();
  if (categoryRaw) {
    const cat = normalizeCategory(categoryRaw);
    if (!cat) {
      return NextResponse.json(
        { error: `unknown category "${categoryRaw}"`, valid: ["Research", "UI/UX", "Backend"] },
        { status: 400 }
      );
    }
    packs = packs.filter((p) => p.category === cat);
  }
  if (q) {
    const hits = new Set(searchPacks(q).map((p) => p.slug));
    packs = packs.filter((p) => hits.has(p.slug));
  }

  return NextResponse.json({
    count: packs.length,
    filters: { q: q || null, category: categoryRaw || null },
    packs: packs.map(shape),
    note: "Concept-stage registry: versions, counts and evidence are staged sample data.",
  });
}
