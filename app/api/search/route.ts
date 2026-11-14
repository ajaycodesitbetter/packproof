import { NextRequest, NextResponse } from "next/server";
import { searchPacks } from "@/lib/packs";
import { STATUS_LABEL } from "@/lib/types";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ q, results: [] });
  }
  const results = searchPacks(q)
    .slice(0, 8)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      status: STATUS_LABEL[p.status],
      published: p.published,
      link: `/packs/${p.slug}`,
    }));
  return NextResponse.json({ q, results });
}
