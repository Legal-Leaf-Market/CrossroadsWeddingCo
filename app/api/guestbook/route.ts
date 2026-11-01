import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createEntry } from "@/lib/guestbook";
import { GUESTBOOK_MESSAGE_MAX, GUESTBOOK_NAME_MAX, GUESTBOOK_RELATIONS } from "@/lib/guestbook-constants";
import { sendGuestbookAlert } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public guestbook post (2026-11-01, Jacob): no login, just a name. Nothing is
// published here; every entry is stored 'pending' and shows on /reviews only
// after the owner approves it. Guards: honeypot, per-instance rate limit,
// length caps, and links refused outright (the one thing spam always carries).
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 4;
const buckets = new Map<string, { count: number; start: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.start > RATE_WINDOW_MS) {
    buckets.set(ip, { count: 1, start: now });
    return false;
  }
  b.count += 1;
  return b.count > RATE_MAX;
}

const schema = z.object({
  name: z.string().trim().min(1, "Add your name").max(GUESTBOOK_NAME_MAX, "That name is a little long"),
  relation: z.string().trim().max(40).optional().default(""),
  message: z
    .string()
    .trim()
    .min(2, "Write a few words")
    .max(GUESTBOOK_MESSAGE_MAX, `Keep it under ${GUESTBOOK_MESSAGE_MAX.toLocaleString("en-US")} characters`),
  website: z.string().max(200).optional().default(""),
});

const LINK_RE = /(https?:\/\/|www\.|\.[a-z]{2,6}\/)/i;

function noStore(json: unknown, status = 200) {
  return NextResponse.json(json, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return noStore({ error: "Invalid request" }, 400);
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (limited(ip)) return noStore({ error: "Too many posts. Give it a little while." }, 429);

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return noStore({ error: parsed.error.issues[0].message }, 400);
  const data = parsed.data;
  if (data.website) return noStore({ ok: true });
  if (LINK_RE.test(data.message) || LINK_RE.test(data.name)) {
    return noStore({ error: "Links aren't allowed in the guestbook. Just tell us in your own words." }, 400);
  }
  const relation = (GUESTBOOK_RELATIONS as readonly string[]).includes(data.relation) ? data.relation : null;

  try {
    await createEntry({ name: data.name, relation, message: data.message });
  } catch (err) {
    console.error("[guestbook] insert failed:", (err as Error).message);
    return noStore({ error: "Something went wrong saving that. Please try again in a minute." }, 500);
  }
  try {
    await sendGuestbookAlert({ name: data.name, preview: data.message.slice(0, 500) });
  } catch (err) {
    console.error("[guestbook] alert failed:", (err as Error).message);
  }
  return noStore({ ok: true });
}
