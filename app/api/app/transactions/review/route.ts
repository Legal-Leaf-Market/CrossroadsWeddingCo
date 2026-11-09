import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBooksWorkspace, sameOrigin } from "@/lib/auth";
import { matchLine } from "@/lib/books/matching";
import { applyReview, createRule } from "@/lib/books/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

const ids = z.array(z.string().max(40)).min(1).max(500);
const note = z.string().max(1000).optional();
const rule = z
  .object({
    matchField: z.enum(["merchant", "description"]),
    matchType: z.enum(["equals", "contains"]),
    pattern: z.string().min(1).max(200),
    direction: z.enum(["any", "in", "out"]),
  })
  .optional();

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("categorize"), ids, categoryId: z.string().max(40), note, rule }),
  z.object({ action: z.literal("exclude"), ids, note, rule }),
  z.object({ action: z.literal("reopen"), ids }),
  z.object({ action: z.literal("note"), ids, note: z.string().max(1000) }),
  z.object({
    action: z.literal("match"),
    ids: z.array(z.string().max(40)).length(1),
    bookingId: z.string().max(40),
    kind: z.enum(["deposit", "balance"]),
    categoryId: z.string().max(40).optional(),
  }),
]);

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400, headers: NO_STORE });
  const input = parsed.data;
  try {
    if (input.action === "match") {
      const m = await matchLine(ws.tenant.id, ws.user.id, {
        transactionId: input.ids[0],
        bookingId: input.bookingId,
        kind: input.kind,
        categoryId: input.categoryId,
      });
      if (!m.ok) return NextResponse.json({ error: m.error }, { status: m.status, headers: NO_STORE });
      return NextResponse.json({ ok: true, updated: 1 }, { headers: NO_STORE });
    }
    const result = await applyReview(ws.tenant.id, ws.user.id, input);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    // "Always do this": the person's own decision is saved first, so a refused
    // rule never costs the sort they just made. The rule then sorts the rest.
    let ruleNote: string | undefined;
    let sorted = 0;
    if ((input.action === "categorize" || input.action === "exclude") && input.rule) {
      const r = await createRule(ws.tenant.id, ws.user.id, {
        ...input.rule,
        action: input.action,
        categoryId: input.action === "categorize" ? input.categoryId : null,
      });
      if (r.ok) sorted = r.sorted;
      else ruleNote = r.error;
    }
    return NextResponse.json({ ok: true, updated: result.updated, ruleSorted: sorted, ruleError: ruleNote }, { headers: NO_STORE });
  } catch (err) {
    console.error("[books] review failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't save that. Try again in a minute." }, { status: 500, headers: NO_STORE });
  }
}
