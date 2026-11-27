import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBooksWorkspace, sameOrigin } from "@/lib/auth";
import { linkPayoutRequests } from "@/lib/payouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const body = z.object({
  requestIds: z.array(z.string().uuid()).min(1).max(100),
  bankTransactionId: z.string().uuid().nullable(),
});

// Match approved payout requests to the bank line that paid them (or unmatch with null).
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  try {
    const res = await linkPayoutRequests(ws.tenant.id, { email: ws.user.email }, parsed.data.requestIds, parsed.data.bankTransactionId);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    console.error("[payouts] link failed", err);
    return NextResponse.json({ error: "That didn't save." }, { status: 500, headers: NO_STORE });
  }
}
