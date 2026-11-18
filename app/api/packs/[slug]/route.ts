import { NextResponse } from "next/server";
import { getPack } from "@/lib/packs";
import { STATUS_LABEL, VERDICT_LABEL } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPack(slug);
  if (!p) {
    return NextResponse.json({ error: `no pack named "${slug}"` }, { status: 404 });
  }
  return NextResponse.json({
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
    summary: p.summary,
    agents: p.agents,
    changelog: p.changelog,
    does_not: p.doesNot ?? [],
    evidence: p.evidence
      ? {
          ...p.evidence,
          tasks: p.evidence.tasks.map((t) => ({
            ...t,
            verdict_label: VERDICT_LABEL[t.verdict],
          })),
        }
      : null,
    links: {
      pack: `/packs/${p.slug}`,
      download: p.published ? `/api/packs/${p.slug}/download?version=${encodeURIComponent(p.version)}` : null,
      report: p.status === "evidence-complete" ? `/reports/${p.slug}` : null,
    },
    sample_data: true,
  });
}
