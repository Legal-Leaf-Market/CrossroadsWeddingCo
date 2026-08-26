import { Resend } from "resend";
import { CONTACT_EMAIL, DEPOSIT_USD, SITE_NAME, SITE_URL } from "@/lib/site";

// Booking emails activate the moment RESEND_API_KEY lands in Vercel; until
// then every helper is a silent no-op so the booking flow never depends on it.
const FROM = process.env.RESEND_FROM ?? `${SITE_NAME} <${CONTACT_EMAIL}>`;
const NOTIFY_TO = process.env.RESEND_NOTIFY_TO ?? "jake@crossroadsweddingco.com";

type BookingEmail = {
  coupleNames: string;
  email: string;
  phone?: string;
  eventDate: string;
  venueName: string;
  venueAddress?: string;
  addons: string[];
  spotifyPlaylistUrl?: string;
  notes?: string;
  totalUsd: number;
  reference: string;
};

export async function sendBookingEmails(booking: BookingEmail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;

  const resend = new Resend(key);
  const addonLine =
    booking.addons.length > 0 ? booking.addons.join(", ") : "none selected";

  const confirmation = [
    `Hi ${booking.coupleNames},`,
    ``,
    `We got your date request for ${booking.eventDate} at ${booking.venueName}. Here's what happens next:`,
    ``,
    `1. We check the calendar and confirm availability by email within 24 hours.`,
    `2. A $${DEPOSIT_USD} deposit locks your date. We'll send payment details with the confirmation.`,
    `3. From there you get a planning link where the names, the schedule, and the music all live.`,
    ``,
    `Your quote: $${booking.totalUsd.toLocaleString("en-US")} (add-ons noted: ${addonLine}).`,
    `Reference: ${booking.reference}`,
    ``,
    `Questions in the meantime? Just reply to this email.`,
    ``,
    `— ${SITE_NAME}`,
    SITE_URL,
  ].join("\n");

  const notification = [
    `New booking request`,
    ``,
    `Couple: ${booking.coupleNames}`,
    `Email: ${booking.email}`,
    `Phone: ${booking.phone || "—"}`,
    `Date: ${booking.eventDate}`,
    `Venue: ${booking.venueName}`,
    `Address: ${booking.venueAddress || "—"}`,
    `Add-ons: ${addonLine}`,
    `Spotify playlist: ${booking.spotifyPlaylistUrl || "—"}`,
    `Quoted total: $${booking.totalUsd.toLocaleString("en-US")}`,
    `Reference: ${booking.reference}`,
    ``,
    `Notes:`,
    booking.notes || "—",
  ].join("\n");

  // Email failure must never fail the booking — log and move on.
  const results = await Promise.allSettled([
    resend.emails.send({
      from: FROM,
      to: booking.email,
      subject: `Got your date request — ${SITE_NAME}`,
      text: confirmation,
    }),
    resend.emails.send({
      from: FROM,
      to: NOTIFY_TO,
      subject: `New booking request: ${booking.coupleNames} — ${booking.eventDate}`,
      text: notification,
    }),
  ]);
  for (const r of results) {
    if (r.status === "rejected") console.error("[email] send failed:", r.reason);
    else if (r.value.error) console.error("[email] send failed:", r.value.error);
  }
}
