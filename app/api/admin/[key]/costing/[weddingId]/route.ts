import { NextResponse, type NextRequest } from "next/server";
import { adminKeyMatches } from "@/lib/admin";
import { getEventPlan, saveEventPlan } from "@/lib/costing";
import { planBody } from "@/lib/costing-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Replace one event's labor and material plan, then answer with the fresh
// costing so the editor's totals come from the same arithmetic as the page.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ key: string; weddingId: string }> }) {
  const { key, weddingId } = await ctx.params;
  if (!adminKeyMatches(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  const parsed = planBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400, headers: NO_STORE });
  }
  try {
    const ok = await saveEventPlan(weddingId, parsed.data.lines);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
    const plan = await getEventPlan(weddingId);
    return NextResponse.json({ ok: true, costing: plan?.costing ?? null }, { headers: NO_STORE });
  } catch (err) {
    console.error("[costing] saveEventPlan failed", err);
    return NextResponse.json({ error: "That didn't save." }, { status: 500, headers: NO_STORE });
  }
}
