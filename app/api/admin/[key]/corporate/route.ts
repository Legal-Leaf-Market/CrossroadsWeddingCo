import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminKeyMatches, createCorporateBooking } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner-only: record a corporate event booked by phone or on an intro call, so
// it gets a booking card and an invoice. Admin-key gated, 404 on any mismatch.
const amount = z.number().nonnegative().max(1_000_000);
const schema = z.object({
  company: z.string().trim().min(2, "Enter the company or client name").max(255),
  contactName: z.string().trim().max(200).optional(),
  email: z.union([z.literal(""), z.string().trim().email("Check the email address").max(255)]).optional(),
  phone: z.string().trim().max(50).optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the event date"),
  venueName: z.string().trim().min(2, "Enter the venue").max(255),
  venueAddress: z.string().trim().max(500).optional(),
  totalUsd: amount,
  depositUsd: amount,
  depositReceived: z.boolean(),
  notes: z.string().trim().max(4000).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!adminKeyMatches(key)) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  try {
    const id = await createCorporateBooking(parsed.data);
    return NextResponse.json({ ok: true, id }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[admin/corporate] insert failed:", (err as Error).message);
    return NextResponse.json({ error: "Couldn't save the booking. Try again." }, { status: 500 });
  }
}
