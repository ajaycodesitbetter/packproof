import { NextResponse } from "next/server";
import { getByCategory, getCategories } from "@/lib/packs";

export async function GET() {
  const cats = getCategories().map((c) => {
    const packs = getByCategory(c.name);
    return {
      name: c.name,
      count: c.count,
      published: packs.filter((p) => p.published).length,
      in_testing: packs.filter((p) => !p.published).length,
      packs: packs.map((p) => p.slug),
      link: `/categories/${encodeURIComponent(c.name)}`,
    };
  });
  return NextResponse.json({ count: cats.length, categories: cats });
}
