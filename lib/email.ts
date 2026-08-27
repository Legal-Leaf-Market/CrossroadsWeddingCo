import { Resend } from "resend";
import { BARTENDER_MIN_USD, DEPOSIT_USD, EMAIL_FROM_ADDRESS, SITE_NAME, SITE_URL } from "@/lib/site";

// Booking emails activate the moment RESEND_API_KEY lands in Vercel; until
// then every helper is a silent no-op so the booking flow never depends on it.
const FROM = process.env.RESEND_FROM ?? `${SITE_NAME} <${EMAIL_FROM_ADDRESS}>`;
const NOTIFY_TO = process.env.RESEND_NOTIFY_TO ?? EMAIL_FROM_ADDRESS;

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
  hubPath?: string;
};

export async function sendBookingEmails(booking: BookingEmail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;

  const resend = new Resend(key);
  const ADDON_LABELS: Record<string, string> = {
    acoustic: "live solo acoustic set",
    bartender: "bar service",
  };
  const addonLine =
    booking.addons.length > 0
      ? booking.addons.map((a) => ADDON_LABELS[a] ?? a).join(", ")
      : "none selected";

  const confirmationLines = [
    `Hi ${booking.coupleNames},`,
    ``,
    `We got your date request for ${booking.eventDate} at ${booking.venueName}. Here's what happens next:`,
    ``,
    `1. We check the calendar and confirm availability by email within 24 hours.`,
    `2. A $${DEPOSIT_USD} deposit locks your date. We'll send payment details with the confirmation.`,
    booking.hubPath
      ? `3. Your planning hub is ready right now: timeline, music, and the names we announce. Fill out now: ${SITE_URL}${booking.hubPath}`
      : `3. From there we gather the names, the schedule, and the music with you by email and on your intro call.`,
    ...(booking.hubPath
      ? [
          ``,
          `The hub saves as you type, and the link above is yours alone: keep it private.`,
        ]
      : []),
    ``,
    booking.addons.includes("bartender")
      ? `Your quote: $${booking.totalUsd.toLocaleString("en-US")} before the bar quote. That includes the $${BARTENDER_MIN_USD} bar minimum; the final bar number depends on your guest count and shelf and gets set on your intro call (add-ons noted: ${addonLine}).`
      : `Your quote: $${booking.totalUsd.toLocaleString("en-US")} (add-ons noted: ${addonLine}).`,
    `Reference: ${booking.reference}`,
    ``,
    `Questions in the meantime? Just reply to this email.`,
    ``,
    `${SITE_NAME}`,
    SITE_URL,
  ];
  const confirmation = confirmationLines.join("\n");

  // HTML twin of the plain-text confirmation, only so "Fill out now" can be
  // bold and the hub link clickable. User-typed values are escaped; the two
  // replacements below operate on copy this function wrote, after escaping.
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const hubUrl = booking.hubPath ? `${SITE_URL}${booking.hubPath}` : null;
  const confirmationHtml =
    `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #2b2622;">` +
    confirmationLines
      .map((line) => {
        let html = escapeHtml(line);
        if (hubUrl) {
          const u = escapeHtml(hubUrl);
          html = html.replace(u, `<a href="${u}" style="color: #c1633d;">${u}</a>`);
        }
        html = html.replace("Fill out now:", `<strong>Fill out now:</strong>`);
        return html;
      })
      .join("<br>") +
    `</div>`;

  const notification = [
    `New booking request`,
    ``,
    `Couple: ${booking.coupleNames}`,
    `Email: ${booking.email}`,
    `Phone: ${booking.phone || "not provided"}`,
    `Date: ${booking.eventDate}`,
    `Venue: ${booking.venueName}`,
    `Address: ${booking.venueAddress || "not provided"}`,
    `Add-ons: ${addonLine}`,
    `Spotify playlist: ${booking.spotifyPlaylistUrl || "not provided"}`,
    `Quoted total: $${booking.totalUsd.toLocaleString("en-US")}`,
    `Reference: ${booking.reference}`,
    booking.hubPath ? `Hub: ${SITE_URL}${booking.hubPath}` : `Hub: not created (leads fallback)`,
    ``,
    `Notes:`,
    booking.notes || "none",
  ].join("\n");

  // Email failure must never fail the booking. Log and move on.
  const results = await Promise.allSettled([
    resend.emails.send({
      from: FROM,
      to: booking.email,
      subject: `We got your date request`,
      text: confirmation,
      html: confirmationHtml,
    }),
    resend.emails.send({
      from: FROM,
      to: NOTIFY_TO,
      subject: `New booking request: ${booking.coupleNames}, ${booking.eventDate}`,
      text: notification,
    }),
  ]);
  for (const r of results) {
    if (r.status === "rejected") console.error("[email] send failed:", r.reason);
    else if (r.value.error) console.error("[email] send failed:", r.value.error);
  }
}
