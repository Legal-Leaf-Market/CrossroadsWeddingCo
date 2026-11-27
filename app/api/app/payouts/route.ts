import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBooksWorkspace, sameOrigin } from "@/lib/auth";
import { createRequest } from "@/lib/payouts";
import { MAX_REQUEST_CENTS, PAYOUT_KINDS } from "@/lib/payout-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const body = z.object({
  kind: z.enum(PAYOUT_KINDS),
  crewMemberId: z.string().uuid().nullable().default(null),
  payeeName: z.string().trim().max(160).default(""),
  amountCents: z.number().int().positive().max(MAX_REQUEST_CENTS),
  purpose: z.string().trim().max(1000),
  categoryId: z.string().uuid().nullable().default(null),
});

// Open a cash payout request (the preparer only; lib/payout-logic.ts).
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  try {
    const res = await createRequest(ws.tenant.id, { email: ws.user.email }, parsed.data);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status, headers: NO_STORE });
    return NextResponse.json({ ok: true, id: res.id }, { headers: NO_STORE });
  } catch (err) {
    console.error("[payouts] request failed", err);
    return NextResponse.json({ error: "That didn't save." }, { status: 500, headers: NO_STORE });
  }
}
