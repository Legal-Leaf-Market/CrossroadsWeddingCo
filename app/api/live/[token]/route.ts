import { NextResponse, type NextRequest } from "next/server";
import { getLiveBlocks, getWeddingByShareToken } from "@/lib/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Poll target for the zero-auth vendor view: the share token grants exactly
// this read and nothing else.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const wedding = await getWeddingByShareToken(token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(
    {
      coupleNames: wedding.coupleNames,
      venueName: wedding.venueName,
      eventDate: wedding.eventDate,
      blocks: await getLiveBlocks(wedding.id),
    },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}
