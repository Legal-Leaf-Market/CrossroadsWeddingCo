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

// Best-effort per-instance rate limit: a warm serverless instance keeps this
// Map across invocations, which is enough to blunt casual abuse of an endpoint
// that writes rows and (with Resend live) sends email from the business domain.
// Real distributed limiting (Upstash / a counter table) is a Phase 2 hardening.
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_MAX;
}

function noStore(json: unknown, status = 200) {
  return NextResponse.json(json, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

const bookingSchema = z.object({
  coupleNames: z
    .string("Please tell us your names")
    .trim()
    .min(2, "Please tell us your names")
    .max(255, "That's a little long for the names field"),
  email: z.email("That email doesn't look right").max(255),
  phone: z.string().trim().max(50, "That phone number is too long").optional().default(""),
  eventDate: z.string("Please pick a date").regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a date"),
  venueName: z
    .string("Tell us the venue. 'Backyard in Seymour' works")
    .trim()
    .min(2, "Tell us the venue. 'Backyard in Seymour' works")
    .max(255, "That's a little long for the venue field"),
  venueAddress: z.string().trim().max(2000, "That address is too long").optional().default(""),
  addons: z.array(z.enum(["acoustic", "bartender"])).max(2).optional().default([]),
  spotifyPlaylistUrl: z.string().trim().max(500, "That link is too long").optional().default(""),
  notes: z.string().trim().max(5000, "Please keep notes under 5,000 characters").optional().default(""),
  // Honeypot: hidden from humans, filled by bots.
  website: z.string().max(200).optional().default(""),
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return noStore({ error: "Invalid request" }, 400);
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (rateLimited(ip)) {
    return noStore({ error: "Too many requests. Give it a few minutes, or email us directly." }, 429);
  }

  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return noStore({ error: issue.message }, 400);
  }
  const data = parsed.data;

  // Honeypot tripped: answer like a success, do nothing.
  if (data.website) {
    return noStore({ ok: true, reference: "OK" });
  }

  // Round-trip the date so Feb 31 can't roll over into March.
  const eventDate = new Date(`${data.eventDate}T12:00:00Z`);
  if (
    Number.isNaN(eventDate.getTime()) ||
    eventDate.toISOString().slice(0, 10) !== data.eventDate
  ) {
    return noStore({ error: "That date doesn't look right" }, 400);
  }
  const today = new Date().toISOString().slice(0, 10);
  if (data.eventDate < today) {
    return noStore({ error: "That date is in the past" }, 400);
  }

  if (data.spotifyPlaylistUrl && !parsePlaylistId(data.spotifyPlaylistUrl)) {
    return noStore(
      { error: "That Spotify link doesn't look like a playlist. Use Share, then Copy link, on the playlist itself." },
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
  // Independent of the access token: the reference is shared in emails and
  // conversations, and must reveal nothing about the portal secret.
  const reference = randomBytes(4).toString("hex").toUpperCase();

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
    // Schema not applied yet (or transient DB trouble): a lead is never lost, so
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
        { error: "Something went wrong saving your request. Please email us directly instead." },
        500,
      );
    }
  }

  if (!process.env.RESEND_API_KEY) {
    // The site promises confirmation within 24 hours. Without Resend the
    // booking is only visible in the database, so shout about it in the logs.
    console.warn(`[bookings] RESEND_API_KEY unset: booking ${reference} recorded but NO notification sent`);
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
