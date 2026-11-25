import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { sendPartnerInquiry } from "@/lib/email";
import { cleanInquiry, inquiryLines } from "@/lib/partner-inquiry";
import { SITE_URL } from "@/lib/site";
import { venueClock } from "@/lib/cookie-order";
import { HOUSE_TENANT_ID } from "@/lib/tenant-constants";

// POST /api/partners/inquiry  The Rabbit's Balloons inquiry form (2026-11-25).
// Rachael Starr has no public inbox yet, so the inquiry is saved as a lead
// (source "rabbits_balloons", on the owner dashboard under Recent inquiries)
// and emailed to the owner to pass on. Either one landing is a success; only
// when both fail does the person see an error, with our address to write to.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PARTNERS: Record<string, { name: string; owner: string; source: string; path: string }> = {
  "rabbits-balloons": { name: "Rabbit's Balloons", owner: "Rachael Starr", source: "rabbits_balloons", path: "/partners/rabbits-balloons" },
};

// Best-effort per-instance limit, the same shape as the other public forms.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const buckets = new Map<string, { n: number; start: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.start > WINDOW_MS) {
    buckets.set(ip, { n: 1, start: now });
    return false;
  }
  b.n += 1;
  return b.n > MAX_PER_WINDOW;
}

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return reply({ ok: false, error: "Something went wrong reading the form. Try again." }, 400);
  }
  const partner = PARTNERS[String(body.partner || "")];
  if (!partner) return reply({ ok: false, error: "Unknown partner." }, 404);

  const checked = cleanInquiry(body, venueClock(new Date()).date);
  // A bot that filled the hidden field gets the same reply a person does.
  if (!checked.ok && checked.error === "bot") return reply({ ok: true });
  if (!checked.ok) return reply({ ok: false, error: checked.error }, 400);
  const d = checked.data;

  const ip = (req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return reply({ ok: false, error: "That's a lot of inquiries from one place. Give it an hour, or email us." }, 429);

  const lines = inquiryLines(d);
  const message = lines
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const [saved, mailed] = await Promise.allSettled([
    db.insert(leads).values({
      tenantId: HOUSE_TENANT_ID,
      name: d.name,
      email: d.email || d.contact,
      phone: d.phone ? d.phone.slice(0, 50) : null,
      eventDate: d.date || null,
      targetDate: d.date || null,
      venue: d.venue || null,
      services: `${partner.name}: ${d.occasion}`,
      message: message || null,
      source: partner.source,
      rawPayload: { partner: String(body.partner), ...d },
    }),
    sendPartnerInquiry({
      partnerName: partner.name,
      ownerName: partner.owner,
      name: d.name,
      contact: d.contact,
      replyTo: d.email || undefined,
      lines,
      pageUrl: `${SITE_URL}${partner.path}`,
    }),
  ]);
  const savedOk = saved.status === "fulfilled";
  const mailedOk = mailed.status === "fulfilled" && mailed.value === true;
  if (saved.status === "rejected") console.error("[partner-inquiry] save failed:", (saved.reason as Error)?.message);
  if (!savedOk && !mailedOk) {
    return reply({ ok: false, error: "We couldn't send that just now. Email us instead and we'll pass it on." }, 502);
  }
  return reply({ ok: true });
}
