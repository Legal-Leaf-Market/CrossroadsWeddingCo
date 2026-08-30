import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminKeyMatches, getAdminWedding, updateAdminWedding } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner-only write for the fields no couple-facing surface can set: the money,
// the paid flags, the booking status, and a bespoke arrangement that replaces
// the agreement's cost section. Admin-key gated, 404 on any mismatch.
const schema = z.object({
  totalAmount: z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/, "Use a plain number like 300 or 1250.50").optional(),
  depositAmount: z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/, "Use a plain number like 300 or 1250.50").optional(),
  isDepositPaid: z.boolean().optional(),
  isBalancePaid: z.boolean().optional(),
  customTerms: z.string().max(5000, "Keep the arrangement under 5,000 characters").optional(),
  status: z
    .enum([
      "inquiry",
      "deposit_paid",
      "talent_assigned",
      "planning_locked",
      "in_progress",
      "completed",
      "cancelled",
    ])
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ key: string; weddingId: string }> },
) {
  const { key, weddingId } = await ctx.params;
  if (!adminKeyMatches(key)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const wedding = await getAdminWedding(weddingId);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  await updateAdminWedding(weddingId, {
    ...d,
    // Empty string clears the bespoke arrangement back to standard terms.
    ...(d.customTerms !== undefined ? { customTerms: d.customTerms.trim() || null } : {}),
  });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
