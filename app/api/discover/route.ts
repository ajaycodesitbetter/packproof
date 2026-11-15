import { NextResponse } from "next/server";
import { getDiscovery } from "@/lib/discovery";

// Live GitHub discovery: fresh skill-convention repos + star-ranked
// category shelves. Cached 6h server-side; see lib/discovery.ts for the
// coverage and ranking honesty rules carried in the payload.
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getDiscovery();
  return NextResponse.json(data);
}
