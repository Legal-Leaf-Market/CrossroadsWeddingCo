import { Resend } from "resend";
import {
  BARTENDER_MIN_USD,
  DEPOSIT_USD,
  EMAIL_FROM_ADDRESS,
  OWNER_EMAIL,
  SITE_NAME,
  SITE_URL,
  VENUE_TIME_ZONE,
} from "@/lib/site";

// Booking emails activate the moment RESEND_API_KEY lands in Vercel; until
// then every helper is a silent no-op so the booking flow never depends on it.
const FROM = process.env.RESEND_FROM ?? `${SITE_NAME} <${EMAIL_FROM_ADDRESS}>`;
const NOTIFY_TO = process.env.RESEND_NOTIFY_TO ?? OWNER_EMAIL;

type BookingEmail = {
  coupleNames: string;
  email: string;
  phone?: string;
  eventDate: string;
  venueName: string;
  venueAddress?: string;
  services: string[];
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
  const SERVICE_LABELS: Record<string, string> = {
    dj: "DJ and MC, the whole day",
    acoustic: "live solo acoustic set",
    bartender: "bar service",
  };
  const hasDj = booking.services.includes("dj");
  const bookedLine = booking.services.map((s) => SERVICE_LABELS[s] ?? s).join(", ");

  const confirmationLines = [
    `Hi ${booking.coupleNames},`,
    ``,
    `We got your date request for ${booking.eventDate} at ${booking.venueName}. Here's what happens next:`,
    ``,
    `1. We check the calendar and confirm availability by email within 24 hours.`,
    hasDj
      ? `2. A $${DEPOSIT_USD} deposit locks your date. We'll send payment details with the confirmation.`
      : `2. A deposit locks your date. We'll sort the amount and payment details with the confirmation.`,
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
    booking.services.includes("bartender")
      ? `Your quote: $${booking.totalUsd.toLocaleString("en-US")} before the bar quote. That includes the $${BARTENDER_MIN_USD} bar minimum; the final bar number depends on your guest count and shelf and gets set on your intro call (booked: ${bookedLine}).`
      : `Your quote: $${booking.totalUsd.toLocaleString("en-US")} (booked: ${bookedLine}).`,
    `Reference: ${booking.reference}`,
    ``,
    booking.hubPath
      ? `Questions? Please don't reply to this email. Message us: your hub has a Messages tab where you text us like a group chat, we both see it right away, and your whole conversation stays in one place: ${SITE_URL}${booking.hubPath}/messages`
      : `Questions in the meantime? Just reply to this email.`,
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
  const messagesUrl = hubUrl ? `${hubUrl}/messages` : null;
  // The Messages button is the star (owner directive 2026-08-28): the email's
  // one job is getting the couple off email and into the hub thread.
  const buttonBlock = messagesUrl
    ? `<div style="margin: 18px 0 6px;">` +
      `<a href="${escapeHtml(messagesUrl)}" style="display: inline-block; background: #c1633d; color: #faf5ec; font-weight: bold; padding: 12px 22px; border-radius: 999px; text-decoration: none;">Message us in your planning hub</a>` +
      `</div>` +
      `<div style="margin: 0 0 12px;">` +
      `<a href="${escapeHtml(hubUrl!)}" style="color: #c1633d;">Or open the hub itself</a>` +
      `</div>`
    : "<br>";
  const htmlLines = confirmationLines
      .map((line) => {
        let html = escapeHtml(line);
        // Longest URL first, so the /messages link never gets half-eaten by
        // the plain hub link replacement.
        if (messagesUrl) {
          const m = escapeHtml(messagesUrl);
          html = html.replace(m, `<a href="${m}" style="color: #c1633d;">${m}</a>`);
        }
        if (hubUrl) {
          const u = escapeHtml(hubUrl);
          if (!html.includes(`href="${u}/messages"`)) {
            html = html.replace(u, `<a href="${u}" style="color: #c1633d;">${u}</a>`);
          }
        }
        html = html.replace("Fill out now:", `<strong>Fill out now:</strong>`);
        html = html.replace("Please don't reply to this email.", `<strong>Please don't reply to this email.</strong>`);
        return html;
      });
  // Button sits between the body and the signature (the last two lines).
  const confirmationHtml =
    `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #2b2622;">` +
    htmlLines.slice(0, -2).join("<br>") +
    buttonBlock +
    htmlLines.slice(-2).join("<br>") +
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
    `Services: ${bookedLine}`,
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

// --- Message-thread notifications (AppFolio model, 2026-08-28) -------------
// The hub's Messages thread is the conversation; these emails only point at
// it. Both fail silently without RESEND_API_KEY and must be awaited by
// callers (Promise.allSettled) before the serverless response goes out.

/** Tell the owners a couple wrote in the hub thread. */
export async function sendTeamInboxAlert(input: {
  coupleNames: string;
  preview: string;
  weddingId: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const resend = new Resend(key);
  const adminKey = process.env.ADMIN_DASH_KEY;
  const replyLine =
    adminKey && adminKey.length >= 16
      ? `Reply from the dashboard: ${SITE_URL}/admin/${adminKey}/messages/${input.weddingId}`
      : `Reply from the bookings dashboard (set ADMIN_DASH_KEY to get a direct link here).`;
  const { error } = await resend.emails.send({
    from: FROM,
    to: NOTIFY_TO,
    subject: `New message from ${input.coupleNames}`,
    text: [
      `${input.coupleNames} wrote in their planning hub:`,
      ``,
      input.preview,
      ``,
      replyLine,
    ].join("\n"),
  });
  if (error) console.error("[email] inbox alert failed:", error);
}

/** Tell the couple the team wrote back; content stays in the hub on purpose. */
export async function sendHubMessagePointer(input: {
  to: string;
  hubPath: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const resend = new Resend(key);
  const url = `${SITE_URL}${input.hubPath}/messages`;
  const { error } = await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: `New message in your planning hub`,
    text: [
      `You have a new message from ${SITE_NAME}.`,
      ``,
      `Read and reply here: ${url}`,
      ``,
      `Please don't reply to this email; the hub thread is where we talk.`,
    ].join("\n"),
    html:
      `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #2b2622;">` +
      `You have a new message from ${SITE_NAME}.<br>` +
      `<div style="margin: 16px 0;"><a href="${url}" style="display: inline-block; background: #c1633d; color: #faf5ec; font-weight: bold; padding: 12px 22px; border-radius: 999px; text-decoration: none;">Open Messages</a></div>` +
      `Please don't reply to this email; the hub thread is where we talk.` +
      `</div>`,
  });
  if (error) console.error("[email] hub pointer failed:", error);
}

// --- Intro-call booking (2026-09-04) --------------------------------------
// Two emails per booking: the visitor gets the confirmation they are waiting
// on with the button still under their thumb, and the person being booked gets
// told. Both fail silently without RESEND_API_KEY, and the route awaits this
// before responding for the same serverless-freeze reason as everything else.

/**
 * The one formatting decision worth stating: the time is rendered in the VENUE
 * zone and labelled with it. Rendering an instant in the visitor's own zone is
 * friendlier right up until they are in Chicago and write "6:00" on a sticky
 * note that Indiana will read as 7:00.
 */
function venueTimeLabel(at: Date): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: VENUE_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return fmt.format(at);
}

export async function sendIntroCallEmails(input: {
  person: { slug: string; name: string; title: string; notifyEmail: string };
  startsAt: Date;
  durationMinutes: number;
  name: string;
  email: string;
  phone?: string;
  eventDate?: string;
  notes?: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const resend = new Resend(key);
  const when = venueTimeLabel(input.startsAt);
  const { person } = input;

  const toGuest = resend.emails.send({
    from: FROM,
    to: input.email,
    subject: `Your call with ${person.name}: ${when}`,
    text: [
      `You're booked. ${person.name} will call you.`,
      ``,
      `When: ${when} (${input.durationMinutes} minutes)`,
      `Who: ${person.name}, ${person.title}`,
      input.phone ? `We'll ring: ${input.phone}` : `We'll reach you at: ${input.email}`,
      ``,
      `Need to move it? Just reply to this email and we'll sort it out.`,
      ``,
      SITE_NAME,
      SITE_URL,
    ].join("\n"),
  });

  // THE OWNER IS ALWAYS COPIED, and it is not redundancy for its own sake.
  // Each person's alert goes to their own crossroadsweddingco.com address, and
  // if one of those mailboxes is ever misconfigured or forwarded into a filter,
  // the failure is a booked call that nobody knows about until the phone does
  // not ring. A second copy to the owner means a lead cannot be lost that way.
  // Deduped, so Jake does not get two of his own.
  const teamTo = [...new Set([person.notifyEmail, NOTIFY_TO])];

  const toTeam = resend.emails.send({
    from: FROM,
    to: teamTo,
    subject: `Call booked with ${input.name}: ${when}`,
    text: [
      `${input.name} booked ${input.durationMinutes} minutes with you.`,
      ``,
      `When: ${when}`,
      `Email: ${input.email}`,
      input.phone ? `Phone: ${input.phone}` : `Phone: not given`,
      input.eventDate ? `Their date: ${input.eventDate}` : `Their date: not given yet`,
      ``,
      input.notes ? `What they said:\n${input.notes}` : `They didn't leave a note.`,
    ].join("\n"),
  });

  const results = await Promise.allSettled([toGuest, toTeam]);
  for (const r of results) {
    if (r.status === "rejected") console.error("[email] intro call failed:", r.reason);
    else if (r.value.error) console.error("[email] intro call failed:", r.value.error);
  }
}
