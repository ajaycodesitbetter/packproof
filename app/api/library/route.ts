import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getLibrary, setInLibrary } from "@/lib/library";
import { getPack } from "@/lib/packs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  let slugs: string[];
  try {
    slugs = await getLibrary(session.user.id);
  } catch {
    // SaveButton already looks for this exact string to show its
    // "library unavailable" state - a store failure must stay JSON,
    // not become an unhandled 500 HTML error page.
    return NextResponse.json({ error: "library unavailable" }, { status: 503 });
  }
  return NextResponse.json({ slugs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  let slug: string | undefined;
  let saved: unknown;
  try {
    const body = await req.json();
    slug = body.slug;
    saved = body.saved;
  } catch {
    return NextResponse.json({ error: "expected JSON body { slug, saved }" }, { status: 400 });
  }
  if (!slug || !getPack(slug)) {
    return NextResponse.json({ error: "unknown pack slug" }, { status: 404 });
  }
  // Desired-state write: the client says what the end state should be, so
  // retries and double-clicks are idempotent and there is no read-then-toggle.
  if (typeof saved !== "boolean") {
    return NextResponse.json({ error: "expected boolean 'saved'" }, { status: 400 });
  }
  let slugs: string[];
  try {
    slugs = await setInLibrary(session.user.id, slug, saved);
  } catch {
    return NextResponse.json({ error: "library unavailable" }, { status: 503 });
  }
  return NextResponse.json({ slugs, saved });
}
