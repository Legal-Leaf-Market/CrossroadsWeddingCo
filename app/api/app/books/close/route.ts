import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBooksWorkspace, sameOrigin } from "@/lib/auth";
import { closeStep } from "@/lib/books/close";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

const ACTIONS = [
  "prepare", "withdraw", "approve", "veto", "escalate", "tiebreak_close", "tiebreak_keep_open",
  "request_reopen", "approve_reopen", "veto_reopen", "escalate_reopen", "tiebreak_reopen", "tiebreak_keep_closed",
] as const;

const schema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}-01$/),
  action: z.enum(ACTIONS),
  note: z.string().trim().max(2000).default(""),
  acknowledged: z.array(z.string().max(40)).max(20).default([]),
});

// One step of the month-end close. Who may take it is decided by the
// signed-in person's seat (finance_roles), never by anything in the request.
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  try {
    const r = await closeStep({
      tenantId: ws.tenant.id,
      periodStart: parsed.data.period,
      action: parsed.data.action,
      actorEmail: ws.user.email,
      note: parsed.data.note,
      acknowledged: parsed.data.acknowledged,
    });
    if (!r.ok) return NextResponse.json({ error: r.error, blockers: r.blockers ?? [] }, { status: r.status, headers: NO_STORE });
    return NextResponse.json({ ok: true, status: r.status }, { headers: NO_STORE });
  } catch (err) {
    console.error("[close] step failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "That didn't go through." }, { status: 500, headers: NO_STORE });
  }
}
