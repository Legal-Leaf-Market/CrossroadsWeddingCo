import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBooksWorkspace, sameOrigin } from "@/lib/auth";
import { decideClaim } from "@/lib/expenses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const body = z.object({ action: z.enum(["approve", "reject", "void", "payout_approve", "payout_veto", "payout_escalate"]), note: z.string().trim().max(1000).default("") });

// One decision on one claim: the report (approve, reject, void) or its payout
// (approve, veto, escalate). Who may do what is decide() in
// lib/expense-logic.ts, applied in lib/expenses.ts, so no other door skips it.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  const { id } = await ctx.params;
  try {
    const res = await decideClaim(ws.tenant.id, { email: ws.user.email, fullName: ws.user.fullName }, id, parsed.data.action, parsed.data.note);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    console.error("[expenses] decide failed", err);
    return NextResponse.json({ error: "That didn't save." }, { status: 500, headers: NO_STORE });
  }
}
