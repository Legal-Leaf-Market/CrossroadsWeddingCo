import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminKeyMatches, getAdminWedding, updateAdminLeadSource, updateAdminWedding } from "@/lib/admin";
import { LEAD_SOURCE_VALUES } from "@/lib/lead-sources";

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
  // Which add-ons this wedding actually carries. Drives the service agreement,
  // so a stale entry puts a service the couple is not getting into their
  // contract; the owner needs to be able to correct it.
  addons: z
    .array(
      z.object({
        type: z.enum(["acoustic_set", "bar_service"]),
        fee: z.number().nonnegative().nullable().optional(),
        minFee: z.number().nonnegative().optional(),
      }),
    )
    .max(4)
    .optional(),
  // A folder slug under public/wedding-art/. Constrained so this can never
  // become a path into somewhere else.
  artTheme: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and dashes.")
    .optional(),
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
  // Where the couple found us (lib/lead-sources.ts). Empty clears it back to
  // "not answered". Saved on its own: attribution never touches the money,
  // the agreement or the books.
  leadSource: z
    .string()
    .max(40)
    .refine((v) => v === "" || (LEAD_SOURCE_VALUES as readonly string[]).includes(v), "Pick a source from the list.")
    .optional(),
  leadSourceDetail: z.string().trim().max(200, "Keep it under 200 characters").optional(),
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
  const { leadSource, leadSourceDetail, ...d } = parsed.data;

  if (leadSource !== undefined || leadSourceDetail !== undefined) {
    await updateAdminLeadSource(weddingId, {
      ...(leadSource !== undefined ? { leadSource: leadSource || null } : {}),
      ...(leadSourceDetail !== undefined ? { leadSourceDetail: leadSourceDetail || null } : {}),
    });
  }

  // A source-only save stops here, so it can never reissue an agreement or
  // repost the books.
  if (Object.keys(d).length === 0) {
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }

  await updateAdminWedding(weddingId, {
    ...d,
    // Empty string clears the bespoke arrangement back to standard terms.
    ...(d.customTerms !== undefined ? { customTerms: d.customTerms.trim() || null } : {}),
    ...(d.artTheme !== undefined ? { artTheme: d.artTheme || null } : {}),
    ...(d.addons !== undefined ? { addons: d.addons } : {}),
  });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
