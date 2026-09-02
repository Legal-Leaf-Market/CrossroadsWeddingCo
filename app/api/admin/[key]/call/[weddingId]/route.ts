import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminKeyMatches, getAdminWedding } from "@/lib/admin";
import { createCallSession, isCallsConfigured } from "@/lib/calls";
import { TEAM_NAMES } from "@/lib/hub-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Who the couple sees on the tile. Validated against the shared roster for the
// same reason the message sender is: an unrecognised name must not quietly
// become someone else.
const postSchema = z.object({
  senderName: z.enum(TEAM_NAMES).default(TEAM_NAMES[0]),
});

/**
 * Mints a team member's seat in a couple's call, with owner controls the couple
 * does not get. Admin-key gated, and a wrong key 404s rather than 403s so the
 * endpoint does not confirm it exists.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string; weddingId: string }> }) {
  const { key, weddingId } = await ctx.params;
  if (!adminKeyMatches(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  if (!isCallsConfigured()) {
    return NextResponse.json({ error: "Calls are not set up yet." }, { status: 501, headers: NO_STORE });
  }

  const wedding = await getAdminWedding(weddingId);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });

  let parsed: z.infer<typeof postSchema>;
  try {
    parsed = postSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  }

  const session = await createCallSession(wedding.id, parsed.senderName, true);
  if (!session) {
    return NextResponse.json(
      { error: "Could not start the call. Please try again." },
      { status: 502, headers: NO_STORE },
    );
  }

  return NextResponse.json(session, { headers: NO_STORE });
}
