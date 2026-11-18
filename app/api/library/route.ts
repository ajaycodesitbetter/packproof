import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getLibrary, setInLibrary } from "@/lib/library";
import { getPack } from "@/lib/packs";
import { createLibraryHandlers } from "@/lib/library-http";

const handlers = createLibraryHandlers({
  identity: async () => (await auth())?.user?.id ?? null,
  getLibrary,
  setInLibrary,
  knownSlug: (slug) => !!getPack(slug),
  reportFailure: (operation) => console.error(JSON.stringify({ event: "library_store_unavailable", operation })),
});
export async function GET() { return handlers.GET(); }
export async function POST(req: NextRequest) { return handlers.POST(req); }
