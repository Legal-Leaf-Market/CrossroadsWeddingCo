// Shared by the scheduled functions in netlify/functions (2026-11-13). The
// live site is on Netlify, which ignores vercel.json's crons, so each job is a
// Netlify scheduled function that calls the job's route on the site with a
// bearer token: CRON_SECRET when it is set, else the per-job token derived from
// ADMIN_DASH_KEY exactly as lib/cron-auth.ts derives it. No key, no call.
import { createHmac } from "node:crypto";

export function jobToken(job) {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET;
  const key = process.env.ADMIN_DASH_KEY;
  if (!key || key.length < 16) return null;
  return createHmac("sha256", key).update(`cron:v1:${job}`).digest("base64url");
}

export async function runJob(job, path) {
  const token = jobToken(job);
  if (!token) {
    console.log(`[schedule] ${job}: no CRON_SECRET or ADMIN_DASH_KEY, skipped`);
    return new Response("skipped", { status: 200 });
  }
  const base = (process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || "https://crossroadsweddingco.shop").replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${token}` } });
  const text = await res.text();
  console.log(`[schedule] ${job}: ${res.status} ${text.slice(0, 300)}`);
  return new Response(text, { status: res.ok ? 200 : 502 });
}
