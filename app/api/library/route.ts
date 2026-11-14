import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getLibrary, toggleInLibrary } from "@/lib/library";
import { getPack } from "@/lib/packs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const slugs = await getLibrary(session.user.id);
  return NextResponse.json({ slugs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  let slug: string | undefined;
  try {
    slug = (await req.json()).slug;
  } catch {
    return NextResponse.json({ error: "expected JSON body { slug }" }, { status: 400 });
  }
  if (!slug || !getPack(slug)) {
    return NextResponse.json({ error: "unknown pack slug" }, { status: 404 });
  }
  const slugs = await toggleInLibrary(session.user.id, slug);
  return NextResponse.json({ slugs, saved: slugs.includes(slug) });
}
