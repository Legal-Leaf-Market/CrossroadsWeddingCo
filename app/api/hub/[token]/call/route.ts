import { NextResponse, type NextRequest } from "next/server";
import { createCallSession, isCallsConfigured } from "@/lib/calls";
import { getWeddingByToken } from "@/lib/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Mints the couple's seat in their own call. POST rather than GET because it
 * has a side effect: it creates the Daily room the first time anyone asks.
 *
 * The hub token is the only credential. Whoever holds the couple's hub link can
 * join their call, which is the same trust boundary as the rest of the portal,
 * and the room itself is private so the URL alone admits nobody.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  // 501, not 404: the caller asked for something real that is not switched on
  // yet. The hub never renders the control without the key, so reaching this is
  // a key that vanished between page load and click, not a normal path.
  if (!isCallsConfigured()) {
    return NextResponse.json({ error: "Calls are not set up yet." }, { status: 501, headers: NO_STORE });
  }

  const wedding = await getWeddingByToken(token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });

  const session = await createCallSession(wedding.id, wedding.coupleNames, false);
  if (!session) {
    return NextResponse.json(
      { error: "Could not start the call. Please try again." },
      { status: 502, headers: NO_STORE },
    );
  }

  return NextResponse.json(session, { headers: NO_STORE });
}
