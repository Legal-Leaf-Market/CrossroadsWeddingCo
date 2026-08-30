import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { weddings } from "@/lib/db/schema";
import { buildContract, CONTRACT_VERSION, servicesFromAddons } from "@/lib/contract";
import { getWeddingByToken } from "@/lib/hub";
import { formatEventDate } from "@/lib/hub-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  acceptedName: z
    .string("Type your name to accept")
    .trim()
    .min(2, "Type your full name to accept")
    .max(255),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Accepting twice is a no-op, not an overwrite: the first acceptance is the
  // one that happened, and re-signing must never quietly restate the terms.
  if (wedding.contractAcceptedAt) {
    return NextResponse.json(
      { error: "This agreement is already accepted." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

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

  const services = servicesFromAddons(wedding.addons, wedding.packageType);
  const acceptedAt = new Date();
  // Freeze the terms as accepted. Later edits to the wedding row (a venue
  // change, a re-quote) can never rewrite what this couple agreed to.
  const snapshot = {
    version: CONTRACT_VERSION,
    acceptedName: parsed.data.acceptedName,
    acceptedAt: acceptedAt.toISOString(),
    coupleNames: wedding.coupleNames,
    eventDate: wedding.eventDate,
    venueName: wedding.venueName,
    venueAddress: wedding.venueAddress,
    services,
    totalUsd: Number(wedding.totalAmount),
    depositUsd: Number(wedding.depositAmount),
    sections: buildContract({
      coupleNames: wedding.coupleNames,
      eventDate: formatEventDate(wedding.eventDate),
      venueName: wedding.venueName,
      venueAddress: wedding.venueAddress,
      services,
      totalUsd: Number(wedding.totalAmount),
      depositUsd: Number(wedding.depositAmount),
    }),
  };

  await db
    .update(weddings)
    .set({
      contractVersion: CONTRACT_VERSION,
      contractAcceptedAt: acceptedAt,
      contractAcceptedName: parsed.data.acceptedName,
      contractSnapshot: snapshot,
      updatedAt: acceptedAt,
    })
    .where(eq(weddings.id, wedding.id));

  return NextResponse.json(
    { ok: true, acceptedAt: acceptedAt.toISOString(), acceptedName: parsed.data.acceptedName },
    { headers: { "Cache-Control": "no-store" } },
  );
}
