import { NextRequest, NextResponse } from "next/server";
import { getDiscovery, searchDiscovery } from "@/lib/discovery";

// Live GitHub discovery. Without ?q: fresh skill-convention repos +
// star-ranked category shelves (6h cache). With ?q: GitHub-wide search
// constrained to skill conventions. See lib/discovery.ts for the coverage
// and ranking honesty rules carried in the payload.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q");
  if (q !== null) {
    return NextResponse.json(await searchDiscovery(q));
  }
  return NextResponse.json(await getDiscovery());
}
