import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminKeyMatches, getAdminWeddingRow } from "@/lib/admin";
import {
  countersignOfficiantAgreement,
  saveOfficiantAgreement,
  setOfficiantPayment,
} from "@/lib/service-agreements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The owner side of the officiating agreement: set it up (or edit it until the
// couple accepts), sign for Compass Events once, and mark the two payments.
// Admin-key gated, 404 on any mismatch, house weddings only.
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    officiantName: z.string().trim().min(2, "Name the officiant").max(120),
    credential: z.string().trim().max(300).default(""),
    rehearsal: z.string().trim().max(300).default(""),
    notes: z.string().trim().max(1000).default(""),
    feeUsd: z.coerce.number().min(0).max(100000),
    depositUsd: z.coerce.number().min(0).max(100000),
    balanceDueHours: z.coerce.number().int().min(0).max(24 * 60),
  }),
  z.object({
    action: z.literal("countersign"),
    name: z.string("Type your full name to sign").trim().min(2, "Type your full name to sign").max(255),
    title: z.string().trim().max(255).default(""),
    agreed: z.literal(true, "Tick the box to confirm you are signing"),
  }),
  z.object({
    action: z.literal("payment"),
    part: z.enum(["deposit", "balance"]),
    paid: z.boolean(),
  }),
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string; weddingId: string }> }) {
  const { key, weddingId } = await ctx.params;
  const headers = { "Cache-Control": "no-store" };
  if (!adminKeyMatches(key)) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  const wedding = await getAdminWeddingRow(weddingId);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404, headers });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
  }
  // The countersign form posts without an action; it is the only one that does.
  if (raw && typeof raw === "object" && !("action" in raw)) raw = { ...raw, action: "countersign" };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400, headers });
  const body = parsed.data;

  if (body.action === "save") {
    if (body.depositUsd > body.feeUsd) {
      return NextResponse.json({ error: "The deposit can't be more than the fee." }, { status: 400, headers });
    }
    const r = await saveOfficiantAgreement(wedding.id, body);
    if (r === "locked") {
      return NextResponse.json(
        { error: "The couple already accepted this agreement, so its terms can't change." },
        { status: 409, headers },
      );
    }
    return NextResponse.json({ ok: true, result: r }, { headers });
  }

  if (body.action === "countersign") {
    const r = await countersignOfficiantAgreement(wedding.id, body.name, body.title);
    if (r === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404, headers });
    if (r === "not_accepted") {
      return NextResponse.json(
        { error: "The couple hasn't accepted this agreement yet, so there is nothing to countersign." },
        { status: 409, headers },
      );
    }
    if (r === "already_signed") {
      return NextResponse.json({ error: "Already signed for Compass Events. Refresh to see it." }, { status: 409, headers });
    }
    return NextResponse.json({ ok: true }, { headers });
  }

  const ok = await setOfficiantPayment(wedding.id, body.part, body.paid);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  return NextResponse.json({ ok: true }, { headers });
}
