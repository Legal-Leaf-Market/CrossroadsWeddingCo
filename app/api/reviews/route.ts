import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { createEntry } from "@/lib/reviews";
import { RELATIONS, findReviewEvent } from "@/lib/review-constants";
import { EMAIL_FROM_ADDRESS, OWNER_EMAIL, SITE_NAME, SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Anyone can sign the board with a name and a note, no email and no login
// (owner directive: send the link, they sign it as themselves). Everything
// lands as "waiting" and shows only after a person approves it, so the
// defences here are about volume, not content: a per-instance rate limit and
// a honeypot field that people never see and bots fill in.
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;
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
  name: z.string().trim().min(1, "Add your name so people know who wrote it").max(80),
  relation: z.enum(RELATIONS).optional().default("Other"),
  message: z.string().trim().min(2, "Write a few words first").max(2000, "Keep it under 2,000 characters"),
  website: z.string().optional().default(""),
  eventSlug: z.string().max(80).optional(),
});

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) {
    return NextResponse.json({ error: "That's a lot of notes. Try again in a bit." }, { status: 429, headers: NO_STORE });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Something in that form isn't right." },
      { status: 400, headers: NO_STORE },
    );
  }
  const data = parsed.data;
  // Honeypot filled: answer like a success so the bot moves on, store nothing.
  if (data.website) return NextResponse.json({ ok: true }, { headers: NO_STORE });

  try {
    // Only a real event page slug is kept; anything else is dropped, never refused.
    await createEntry({ name: data.name, relation: data.relation, message: data.message, eventSlug: findReviewEvent(data.eventSlug)?.slug ?? null });
  } catch (err) {
    console.error("[reviews] insert failed:", err);
    return NextResponse.json(
      { error: "We couldn't save that right now. Please try again in a minute." },
      { status: 503, headers: NO_STORE },
    );
  }

  // Tell the owner there is something to approve. Awaited so a serverless
  // freeze can't drop it; a failed send never fails the post.
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const adminKey = process.env.ADMIN_DASH_KEY;
      const link =
        adminKey && adminKey.length >= 16
          ? `${SITE_URL}/admin/${adminKey}/reviews`
          : "the reviews screen in the bookings dashboard";
      const { error } = await new Resend(key).emails.send({
        from: process.env.RESEND_FROM ?? `${SITE_NAME} <${EMAIL_FROM_ADDRESS}>`,
        to: process.env.RESEND_NOTIFY_TO ?? OWNER_EMAIL,
        subject: `New note on the reviews page from ${data.name}`,
        text: [
          `${data.name} (${data.relation}) wrote:`,
          ``,
          data.message,
          ``,
          `It isn't public yet. Approve or hide it: ${link}`,
        ].join("\n"),
      });
      if (error) console.error("[reviews] alert failed:", error);
    } catch (err) {
      console.error("[reviews] alert failed:", err);
    }
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
