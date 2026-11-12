import { createHmac, timingSafeEqual } from "node:crypto";
import { getAdminWeddingRow } from "@/lib/admin";
import type { ServiceAgreement, Wedding } from "@/lib/db/schema";
import { sendOfficiantSignedEmail } from "@/lib/email";
import { countersignOfficiantAgreement, getOfficiantAgreement, officiantDetails } from "@/lib/service-agreements";
import { SITE_URL } from "@/lib/site";

// The officiant's own signing link (2026-11-12, Jake: "a direct link to have
// Terry sign"). The owner page already had a sign box, but it lives behind the
// whole dashboard key, sits under the DJ agreement's button on the dashboard,
// and opens every booking's money and messages to whoever holds it. This link
// opens ONE thing: the officiant agreement of one wedding, with one action,
// sign it. Nothing is stored: the token is the wedding id plus an HMAC of it
// under ADMIN_DASH_KEY, so rotating that key retires every signing link, and
// with no key configured no link can be made or accepted (fails closed).

const PURPOSE = "officiant-sign:v1:";

function secret(): string | null {
  const k = process.env.ADMIN_DASH_KEY;
  return k && k.length >= 16 ? k : null;
}

function sig(weddingId: string, key: string): string {
  return createHmac("sha256", key).update(PURPOSE + weddingId).digest("base64url").slice(0, 32);
}

export function officiantSignToken(weddingId: string): string | null {
  const key = secret();
  return key ? `${weddingId}.${sig(weddingId, key)}` : null;
}

export function officiantSignUrl(weddingId: string): string | null {
  const t = officiantSignToken(weddingId);
  return t ? `${SITE_URL.replace(/\/$/, "")}/sign/officiant/${t}` : null;
}

/** The wedding id the token was made for, or null for anything forged or malformed. */
export function weddingIdFromSignToken(token: string): string | null {
  const key = secret();
  if (!key) return null;
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{32})$/.exec(token);
  if (!m) return null;
  const a = Buffer.from(m[2]);
  const b = Buffer.from(sig(m[1], key));
  return a.length === b.length && timingSafeEqual(a, b) ? m[1] : null;
}

export async function loadForSigning(
  token: string,
): Promise<{ wedding: Wedding; agreement: ServiceAgreement } | null> {
  const id = weddingIdFromSignToken(token);
  if (!id) return null;
  const wedding = await getAdminWeddingRow(id);
  if (!wedding) return null;
  const agreement = await getOfficiantAgreement(wedding.id);
  return agreement ? { wedding, agreement } : null;
}

/** Everyone the couple has on the booking: the contact email plus hub invites. */
export function coupleEmails(w: Wedding): string[] {
  const all = [w.contactEmail, ...(w.hubInviteEmails ?? [])]
    .map((e) => (e ?? "").trim())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const seen = new Set<string>();
  return all.filter((e) => (seen.has(e.toLowerCase()) ? false : (seen.add(e.toLowerCase()), true)));
}

/**
 * Sign for Compass Events, then tell the couple. One path for both doors (the
 * owner page and the officiant's own link), so the couple hears about it
 * however the signature arrived. The email is awaited: a serverless function
 * is frozen once it answers, and a fire-and-forget send would never leave.
 */
export async function countersignAndNotify(
  wedding: Wedding,
  name: string,
  title: string,
): ReturnType<typeof countersignOfficiantAgreement> {
  const r = await countersignOfficiantAgreement(wedding.id, name, title);
  if (r !== "ok") return r;
  const a = await getOfficiantAgreement(wedding.id);
  try {
    await sendOfficiantSignedEmail({
      to: coupleEmails(wedding),
      coupleNames: wedding.coupleNames,
      officiantName: name || (a ? officiantDetails(a).officiantName : ""),
      hubPath: `/hub/${wedding.accessToken}/officiant`,
    });
  } catch (err) {
    console.error("[officiant-sign] couple email failed:", err);
  }
  return r;
}
