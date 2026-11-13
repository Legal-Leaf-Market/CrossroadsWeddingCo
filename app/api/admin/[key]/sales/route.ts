import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminKeyMatches } from "@/lib/admin";
import { createAccount, createSalesOrder } from "@/lib/sales";
import { CRM_KINDS } from "@/lib/sales-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner-only: a sales order from the pipeline (or straight from the playbook).
// Creates the account too when a new one is named. Admin-key gated, 404 on any
// mismatch, like every admin route.
const NO_STORE = { "Cache-Control": "no-store" };
const amount = z.number().nonnegative().max(1_000_000);
const uuidOrNull = z.union([z.string().uuid(), z.literal(""), z.null()]).optional().transform((v) => v || null);
const schema = z.object({
  accountId: uuidOrNull,
  newAccount: z
    .object({ name: z.string().trim().min(2).max(160), kind: z.enum(CRM_KINDS), managerCrewId: uuidOrNull })
    .nullable()
    .optional(),
  type: z.enum(["wedding", "corporate"]),
  clientNames: z.string().trim().min(2, "Enter the client or couple").max(255),
  email: z.union([z.literal(""), z.string().trim().email("Check the email address").max(255)]).optional().default(""),
  phone: z.string().trim().max(50).optional().default(""),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the event date"),
  venueName: z.string().trim().min(2, "Enter the venue").max(255),
  venueAddress: z.string().trim().max(500).optional().default(""),
  totalUsd: amount,
  depositUsd: amount,
  depositReceived: z.boolean(),
  closerCrewId: uuidOrNull,
  playbookLeadId: z.union([z.string().regex(/^[a-z0-9-]{1,100}$/), z.literal(""), z.null()]).optional().transform((v) => v || null),
  notes: z.string().trim().max(4000).optional().default(""),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!adminKeyMatches(key)) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form" }, { status: 400, headers: NO_STORE });
  const d = parsed.data;
  let accountId = d.accountId;
  if (!accountId && d.newAccount) {
    const a = await createAccount({
      name: d.newAccount.name,
      kind: d.newAccount.kind,
      managerCrewId: d.newAccount.managerCrewId,
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      notes: "",
      playbookLeadId: d.playbookLeadId,
    });
    if (!a.ok) return NextResponse.json({ error: a.error }, { status: 400, headers: NO_STORE });
    accountId = a.id;
  }
  const r = await createSalesOrder({ ...d, accountId });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400, headers: NO_STORE });
  return NextResponse.json({ ok: true, id: r.id }, { headers: NO_STORE });
}
