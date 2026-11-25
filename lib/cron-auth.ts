import { createHmac, timingSafeEqual } from "node:crypto";

// Who may run a scheduled job (2026-11-13). The live site is on Netlify, which
// ignores vercel.json's crons, so the jobs now run from Netlify scheduled
// functions (netlify/functions/*.mjs) that call the job's route. Either secret
// works:
//   - CRON_SECRET, sent as "Authorization: Bearer <secret>" (the Vercel way), or
//   - a per-job token derived from ADMIN_DASH_KEY, so the scheduled functions
//     work without another secret to set. Rotating the key rotates the tokens.
// With neither configured, nothing runs (fails closed). No imports beyond
// node:crypto, so scripts/verify-plaid.mjs checks it directly.

const PURPOSE = "cron:v1:";

function adminKey(): string | null {
  const k = process.env.ADMIN_DASH_KEY;
  return k && k.length >= 16 ? k : null;
}

/** The bearer token for one job, or null when no key is configured. */
export function cronToken(job: string, key: string | null = adminKey()): string | null {
  return key ? createHmac("sha256", key).update(PURPOSE + job).digest("base64url") : null;
}

export function cronConfigured(): boolean {
  return !!process.env.CRON_SECRET || !!adminKey();
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function cronAuthorized(authorization: string | null, job: string): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const given = authorization.slice(7);
  const secret = process.env.CRON_SECRET;
  if (secret && same(given, secret)) return true;
  const token = cronToken(job);
  return !!token && same(given, token);
}
