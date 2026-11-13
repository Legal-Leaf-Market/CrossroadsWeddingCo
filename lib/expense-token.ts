import { createHmac, timingSafeEqual } from "node:crypto";
import { SITE_URL } from "@/lib/site";

// Each crew member's expense capture link (2026-11-13). Same pattern as the
// officiant's signing link (lib/officiant-sign.ts): nothing stored, the token
// is the crew id plus an HMAC of it under ADMIN_DASH_KEY, so rotating that key
// retires every link at once, and with no key no link is made or accepted.

const PURPOSE = "expense-capture:v1:";

function secret(): string | null {
  const k = process.env.ADMIN_DASH_KEY;
  return k && k.length >= 16 ? k : null;
}

function sig(id: string, key: string): string {
  return createHmac("sha256", key).update(PURPOSE + id).digest("base64url").slice(0, 32);
}

export function expenseToken(crewMemberId: string): string | null {
  const key = secret();
  return key ? `${crewMemberId}.${sig(crewMemberId, key)}` : null;
}

export function expenseUrl(crewMemberId: string): string | null {
  const t = expenseToken(crewMemberId);
  return t ? `${SITE_URL.replace(/\/$/, "")}/expense/${t}` : null;
}

/** The crew id the token was made for, or null for anything forged or malformed. */
export function crewIdFromExpenseToken(token: string): string | null {
  const key = secret();
  if (!key) return null;
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{32})$/.exec(token);
  if (!m) return null;
  const a = Buffer.from(m[2]);
  const b = Buffer.from(sig(m[1], key));
  return a.length === b.length && timingSafeEqual(a, b) ? m[1] : null;
}
