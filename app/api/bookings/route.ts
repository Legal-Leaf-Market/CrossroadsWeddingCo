import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leads, weddings } from "@/lib/db/schema";
import { sendBookingEmails } from "@/lib/email";
import { parsePlaylistId } from "@/lib/spotify";
import { ACOUSTIC_ADDON_USD, BARTENDER_MIN_USD, DJ_DAY_RATE_USD } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(json: unknown, status = 200) {
  return NextResponse.json(json, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

const bookingSchema = z.object({
  coupleNames: z.string().trim().min(2).max(255),
  email: z.email().max(255),
  phone: z.string().trim().max(50).optional().default(""),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  venueName: z.string().trim().min(2).max(255),
  venueAddress: z.string().trim().max(2000).optional().default(""),
  addons: z.array(z.enum(["acoustic", "bartender"])).max(2).optional().default([]),
  spotifyPlaylistUrl: z.string().trim().max(500).optional().default(""),
  notes: z.string().trim().max(5000).optional().default(""),
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return noStore({ error: "Invalid request" }, 400);
  }

  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return noStore({ error: `${issue.path.join(".")}: ${issue.message}` }, 400);
  }
  const data = parsed.data;

  const eventDate = new Date(`${data.eventDate}T12:00:00Z`);
  if (Number.isNaN(eventDate.getTime())) {
    return noStore({ error: "That date doesn't look right" }, 400);
  }
  const today = new Date().toISOString().slice(0, 10);
  if (data.eventDate < today) {
    return noStore({ error: "That date is in the past" }, 400);
  }

  if (data.spotifyPlaylistUrl && !parsePlaylistId(data.spotifyPlaylistUrl)) {
    return noStore(
      { error: "That Spotify link doesn't look like a playlist — use Share → Copy link on the playlist itself" },
      400,
    );
  }

  const hasAcoustic = data.addons.includes("acoustic");
  const hasBartender = data.addons.includes("bartender");
  // Acoustic is a published flat $400; bartending is an interest flag with a
  // $400 floor, quoted for real on the intro call (CLAUDE.md §9.2).
  const totalUsd = DJ_DAY_RATE_USD + (hasAcoustic ? ACOUSTIC_ADDON_USD : 0);
  const addonsJson = [
    ...(hasAcoustic ? [{ type: "acoustic_set", fee: ACOUSTIC_ADDON_USD }] : []),
    ...(hasBartender ? [{ type: "bar_service", fee: null, minFee: BARTENDER_MIN_USD }] : []),
  ];

  const accessToken = randomBytes(24).toString("hex");
  const reference = accessToken.slice(0, 8).toUpperCase();

  let stored: "weddings" | "leads";
  try {
    await db.insert(weddings).values({
      accessToken,
      coupleNames: data.coupleNames,
      contactEmail: data.email,
      contactPhone: data.phone || null,
      eventDate: data.eventDate,
      venueName: data.venueName,
      venueAddress: data.venueAddress || null,
      packageType: hasAcoustic ? "hybrid_acoustic" : "standard_dj_mc",
      addons: addonsJson,
      spotifyPlaylistUrl: data.spotifyPlaylistUrl || null,
      totalAmount: totalUsd.toFixed(2),
      notes: data.notes || null,
    });
    stored = "weddings";
  } catch (err) {
    // Schema not applied yet (or transient DB trouble): a lead is never lost —
    // fall back to the long-standing leads table, old columns only.
    console.error("[bookings] weddings insert failed, falling back to leads:", (err as Error).message);
    try {
      await db.insert(leads).values({
        name: data.coupleNames,
        email: data.email,
        eventDate: data.eventDate,
        venue: data.venueName,
        services: data.addons.join(", ") || null,
        message: [
          data.notes,
          data.phone && `Phone: ${data.phone}`,
          data.venueAddress && `Address: ${data.venueAddress}`,
          data.spotifyPlaylistUrl && `Spotify: ${data.spotifyPlaylistUrl}`,
          `Booking reference: ${reference}`,
        ]
          .filter(Boolean)
          .join("\n") || null,
      });
      stored = "leads";
    } catch (fallbackErr) {
      console.error("[bookings] fallback insert failed:", (fallbackErr as Error).message);
      return noStore(
        { error: "Something went wrong saving your request — please email us directly instead." },
        500,
      );
    }
  }

  // Fire-and-forget: email failure must never fail the booking.
  sendBookingEmails({
    coupleNames: data.coupleNames,
    email: data.email,
    phone: data.phone || undefined,
    eventDate: data.eventDate,
    venueName: data.venueName,
    venueAddress: data.venueAddress || undefined,
    addons: data.addons,
    spotifyPlaylistUrl: data.spotifyPlaylistUrl || undefined,
    notes: data.notes || undefined,
    totalUsd,
    reference,
  }).catch((err) => console.error("[bookings] email dispatch failed:", err));

  return noStore({ ok: true, reference, totalUsd, stored });
}
