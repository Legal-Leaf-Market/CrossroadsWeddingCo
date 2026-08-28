// Booking texts via Twilio's REST API (plain fetch, no SDK dependency).
// Fails closed like every gated integration: without TWILIO_ACCOUNT_SID,
// TWILIO_AUTH_TOKEN, and a sender (TWILIO_MESSAGING_SERVICE_SID or
// TWILIO_FROM_NUMBER), every function is a silent no-op and the booking flow
// never notices. Resend cannot send SMS; this is the companion channel.

import { formatEventDate } from "@/lib/hub-constants";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER),
  );
}

/**
 * Normalize a form-typed US phone number to E.164, null when it can't be
 * done safely. Bookings collect free-form phones; a number we can't
 * confidently normalize just doesn't get a text.
 */
export function toE164US(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/**
 * Send one SMS to an E.164 number. Throws on Twilio errors so callers decide
 * whether a failure matters; silent no-op while Twilio is unconfigured.
 */
export async function sendSms(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return;
  const params = new URLSearchParams({ To: to, Body: body });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    params.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
  } else if (process.env.TWILIO_FROM_NUMBER) {
    params.set("From", process.env.TWILIO_FROM_NUMBER);
  } else {
    return;
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Twilio ${res.status}: ${detail.slice(0, 300)}`);
  }
}

export type BookingText = {
  coupleNames: string;
  phone: string;
  eventDate: string;
  venueName: string;
  reference: string;
  hubPath?: string;
};

/**
 * Confirmation text to the couple, plus an optional heads-up text to the
 * owner (TWILIO_NOTIFY_TO). Callers treat this as fire-and-forget; a texting
 * failure must never fail a booking.
 */
export async function sendBookingTexts(booking: BookingText): Promise<void> {
  if (!isSmsConfigured()) return;

  const jobs: Promise<void>[] = [];
  const to = toE164US(booking.phone);
  if (to) {
    const lines = [
      `${SITE_NAME}: got your request for ${formatEventDate(booking.eventDate)}! Confirmation and details are in your email.`,
      ...(booking.hubPath ? [`Your planning hub is ready: ${SITE_URL}${booking.hubPath}`] : []),
      `Reply STOP to opt out.`,
    ];
    jobs.push(sendSms(to, lines.join(" ")));
  }

  const notify = process.env.TWILIO_NOTIFY_TO;
  if (notify) {
    jobs.push(
      sendSms(
        notify,
        `New date request: ${booking.coupleNames}, ${formatEventDate(booking.eventDate)}, ${booking.venueName}. Ref ${booking.reference}.`,
      ),
    );
  }

  const results = await Promise.allSettled(jobs);
  for (const r of results) {
    if (r.status === "rejected") console.error("[sms] send failed:", r.reason);
  }
}
