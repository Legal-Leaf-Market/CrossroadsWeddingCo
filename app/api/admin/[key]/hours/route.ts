import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminKeyMatches } from "@/lib/admin";
import { cancelAppointment, getOfficeHours, setOfficeHours } from "@/lib/booking-server";
import { findScheduler } from "@/lib/schedulers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// A day is at most 24 hours, and a block that ends before it starts is a typo
// rather than an overnight shift: nobody takes intro calls from 11pm to 1am,
// and accepting it would silently produce a block with no slots in it.
const blockSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((b) => b.endMinute > b.startMinute, { message: "An end time has to come after its start" });

const putSchema = z.object({
  person: z.string().trim().max(40),
  // Replace-all, matching every other editor in this product. A week of office
  // hours is small enough to send whole, and a whole-week PUT cannot leave the
  // saved week half-updated the way a series of per-block calls can.
  blocks: z.array(blockSchema).max(40),
});

const deleteSchema = z.object({ appointmentId: z.string().uuid() });

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!adminKeyMatches(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  const person = findScheduler(req.nextUrl.searchParams.get("person"));
  if (!person) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json({ hours: await getOfficeHours(person.slug) }, { headers: NO_STORE });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!adminKeyMatches(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400, headers: NO_STORE },
    );
  }
  const person = findScheduler(parsed.data.person);
  if (!person) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  await setOfficeHours(person.slug, parsed.data.blocks);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

/**
 * Cancel a booked call. Soft, like archiving a wedding: the row keeps its
 * record and the partial unique index stops counting it, so the slot opens
 * back up without anything being lost.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!adminKeyMatches(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  }
  await cancelAppointment(parsed.data.appointmentId);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
