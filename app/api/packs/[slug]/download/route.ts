import { NextResponse } from "next/server";
import { getPack } from "@/lib/packs";
import { SKILL_FILES } from "@/lib/skill-files";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const p = getPack(params.slug);
  if (!p) {
    return NextResponse.json({ error: `no pack named "${params.slug}"` }, { status: 404 });
  }
  const file = SKILL_FILES[p.slug];
  if (!p.published || !file) {
    return NextResponse.json(
      {
        error: `${p.slug} is not published yet`,
        status: p.status,
        detail: "This pack is still in testing. The file ships when its evidence report does.",
      },
      { status: 409 }
    );
  }
  return new Response(file.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "X-Pack-Version": p.version,
    },
  });
}
