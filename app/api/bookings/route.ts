import { randomBytes } from "node:crypto";
import { nameSlug } from "@/lib/hub-constants";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { weddings } from "@/lib/db/schema";
import { sendBookingEmails } from "@/lib/email";
import { sendBookingTexts } from "@/lib/sms";
import { parsePlaylistId } from "@/lib/spotify";
import { ACOUSTIC_ADDON_USD, BARTENDER_MIN_USD, DEPOSIT_USD, DJ_DAY_RATE_USD } from "@/lib/site";

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

const NAME_MAX = 120;
const nameField = z.string().trim().max(NAME_MAX, "That name is a little long");

const bookingSchema = z.object({
  // The four-field shape (owner directive 2026-09-03). Surnames are what make
  // a hub URL readable, so they are captured rather than parsed back out of a
  // single string.
  partnerOneFirst: nameField.optional().default(""),
  partnerOneLast: nameField.optional().default(""),
  partnerTwoFirst: nameField.optional().default(""),
  partnerTwoLast: nameField.optional().default(""),
  // Extra people the couple wants in their hub: a planner, a parent, the maid
  // of honour. Capped so a scripted post cannot mail-bomb through this form.
  hubInviteEmails: z
    .array(z.email("One of those invite emails doesn't look right").max(255))
    .max(10, "That's as many people as we can add here. Send us the rest and we'll add them.")
    .optional()
    .default([]),
  // Still accepted, and still the display name. An old cached form that posts
  // only this keeps booking, exactly like the `addons` shape below.
  coupleNames: z
    .string()
    .trim()
    .max(255, "That's a little long for the names field")
    .optional()
    .default(""),
  email: z.email("That email doesn't look right").max(255),
  phone: z.string().trim().max(50, "That phone number is too long").optional().default(""),
  eventDate: z.string("Please pick a date").regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a date"),
  venueName: z
    .string("Tell us the venue. 'Backyard in Seymour' works")
    .trim()
    .min(2, "Tell us the venue. 'Backyard in Seymour' works")
    .max(255, "That's a little long for the venue field"),
  venueAddress: z.string().trim().max(2000, "That address is too long").optional().default(""),
  // The service picker (a la carte, owner directive 2026-08-28). `addons` is
  // the pre-picker wire shape; an old cached form sending it still books,
  // with the DJ implied like it always was.
  services: z.array(z.enum(["dj", "acoustic", "bartender"])).max(3).optional(),
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

  const services = data.services ?? ["dj", ...data.addons];
  if (services.length === 0) {
    return noStore({ error: "Pick at least one service" }, 400);
  }
  const hasDj = services.includes("dj");
  const hasAcoustic = services.includes("acoustic");
  const hasBartender = services.includes("bartender");
  // Acoustic is a published flat rate. The bar minimum is owed before any
  // quote happens, so it counts in the total, which everything downstream
  // labels "before bar quote"; the final bar number comes from the intro
  // call (CLAUDE.md §9.2, owner directive 2026-08-27). A-la-carte bookings
  // simply have no DJ line (owner directive 2026-08-28).
  const totalUsd =
    (hasDj ? DJ_DAY_RATE_USD : 0) +
    (hasAcoustic ? ACOUSTIC_ADDON_USD : 0) +
    (hasBartender ? BARTENDER_MIN_USD : 0);
  const addonsJson = [
    ...(hasAcoustic ? [{ type: "acoustic_set", fee: ACOUSTIC_ADDON_USD }] : []),
    ...(hasBartender ? [{ type: "bar_service", fee: null, minFee: BARTENDER_MIN_USD }] : []),
  ];

  // "Jane & Sam" for the hub heading. The four-field form builds it from first
  // names; a cached old form supplies it directly.
  const firstNames = [data.partnerOneFirst, data.partnerTwoFirst].filter(Boolean);
  const coupleNames = firstNames.length ? firstNames.join(" & ") : data.coupleNames;
  if (!coupleNames || coupleNames.length < 2) {
    return noStore({ error: "Please tell us your names" }, 400);
  }

  // A readable hub URL: kennedy-carter-9f3a1c7e42b6d508.
  //
  // The slug is decoration. Names are public, so a bare /hub/kennedy-carter
  // would be guessable by anyone who saw a save-the-date and enumerable in
  // bulk against common surname pairs, and this URL is the ONLY credential
  // protecting the couple's contact details, documents, private thread with
  // us, and the wedding party's names and phone-book. The 64 bits after the
  // last dash are what actually hold the door shut.
  //
  // No collision handling is needed: two couples who share both surnames get
  // the same readable half and different suffixes, which is unambiguous.
  // Falling back to the display name keeps a cached old form readable too.
  const slug = nameSlug(data.partnerOneLast, data.partnerTwoLast) === "couple"
    ? nameSlug(coupleNames)
    : nameSlug(data.partnerOneLast, data.partnerTwoLast);
  const accessToken = `${slug}-${randomBytes(8).toString("hex")}`;
  // Read-only credential for the /live/[token] vendor view; independent of
  // the write-capable access token by design.
  const shareToken = randomBytes(24).toString("hex");
  // Independent of the access token: the reference is shared in emails and
  // conversations, and must reveal nothing about the portal secret.
  const reference = randomBytes(4).toString("hex").toUpperCase();

  let stored: "weddings" | "leads";
  try {
    await db.insert(weddings).values({
      accessToken,
      shareToken,
      coupleNames,
      partnerOneFirst: data.partnerOneFirst || null,
      partnerOneLast: data.partnerOneLast || null,
      partnerTwoFirst: data.partnerTwoFirst || null,
      partnerTwoLast: data.partnerTwoLast || null,
      hubInviteEmails: data.hubInviteEmails,
      // Seed the message picker with the couple themselves. Anyone they invite
      // adds their own first name the first time they write.
      hubSpeakers: firstNames,
      contactEmail: data.email,
      contactPhone: data.phone || null,
      eventDate: data.eventDate,
      venueName: data.venueName,
      venueAddress: data.venueAddress || null,
      packageType: !hasDj ? "a_la_carte" : hasAcoustic ? "hybrid_acoustic" : "standard_dj_mc",
      addons: addonsJson,
      spotifyPlaylistUrl: data.spotifyPlaylistUrl || null,
      totalAmount: totalUsd.toFixed(2),
      // The $500 deposit is DJ-package policy; an a-la-carte deposit can't
      // exceed the whole quote. The exact a-la-carte deposit policy is an
      // open owner decision; nothing customer-facing promises a number.
      depositAmount: Math.min(DEPOSIT_USD, totalUsd).toFixed(2),
      notes: data.notes || null,
    });
    stored = "weddings";
  } catch (err) {
    // Schema not applied yet (or transient DB trouble): a lead is never lost, so
    // fall back to the long-standing leads table, old columns only.
    console.error("[bookings] weddings insert failed, falling back to leads:", (err as Error).message);
    try {
      // Raw SQL against the legacy columns only. The Drizzle insert enumerates
      // every schema column (missing ones included), so it fails on any
      // database the migration hasn't reached yet, which is exactly when this
      // fallback runs. Verified live 2026-08-26: this is how the first real
      // booking test double-failed.
      const message =
        [
          data.notes,
          data.phone && `Phone: ${data.phone}`,
          data.venueAddress && `Address: ${data.venueAddress}`,
          data.spotifyPlaylistUrl && `Spotify: ${data.spotifyPlaylistUrl}`,
          `Booking reference: ${reference}`,
        ]
          .filter(Boolean)
          .join("\n") || null;
      await db.execute(sql`
        insert into leads (name, email, event_date, venue, services, message)
        values (${coupleNames}, ${data.email}, ${data.eventDate},
                ${data.venueName}, ${services.join(", ") || null}, ${message})
      `);
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

  // AWAITED on purpose. On serverless, work left un-awaited when the
  // response returns is frozen with the function and usually never finishes:
  // that was the bug where bookings landed but no email ever arrived (the
  // strangled fetch surfaced as "Unable to fetch data" attributed to some
  // later request). Failures still never fail the booking: both sends are
  // wrapped so the only outcome of a bad day at Resend or Twilio is a log
  // line and a slightly quieter couple.
  const dispatches: Promise<void>[] = [
    sendBookingEmails({
      coupleNames,
      email: data.email,
      phone: data.phone || undefined,
      eventDate: data.eventDate,
      venueName: data.venueName,
      venueAddress: data.venueAddress || undefined,
      services,
      spotifyPlaylistUrl: data.spotifyPlaylistUrl || undefined,
      notes: data.notes || undefined,
      totalUsd,
      reference,
      hubPath: stored === "weddings" ? `/hub/${accessToken}` : undefined,
    }),
  ];
  if (data.phone) {
    dispatches.push(
      sendBookingTexts({
        coupleNames,
        phone: data.phone,
        eventDate: data.eventDate,
        venueName: data.venueName,
        reference,
        hubPath: stored === "weddings" ? `/hub/${accessToken}` : undefined,
      }),
    );
  }
  const outcomes = await Promise.allSettled(dispatches);
  outcomes.forEach((outcome, i) => {
    if (outcome.status === "rejected") {
      console.error(`[bookings] ${i === 0 ? "email" : "sms"} dispatch failed:`, outcome.reason);
    }
  });

  // The hub link only exists when the row landed in weddings; the leads
  // fallback has no access token to key it on.
  const hubPath = stored === "weddings" ? `/hub/${accessToken}` : null;
  return noStore({ ok: true, reference, totalUsd, stored, hubPath });
}
