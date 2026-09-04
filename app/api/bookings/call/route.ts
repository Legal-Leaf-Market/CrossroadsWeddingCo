import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { bookAppointment, getAvailability } from "@/lib/booking-server";
import { sendIntroCallEmails } from "@/lib/email";
import { findScheduler, APPOINTMENT_MINUTES } from "@/lib/schedulers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same shape of best-effort per-instance limit the date-request route uses, and
// for the same reason: this endpoint writes a row and sends mail from the
// business domain. Real distributed limiting is a later hardening.
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 8;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_MAX;
}

function noStore(json: unknown, status = 200) {
  return NextResponse.json(json, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

// GET is the calendar. Open, because the times a person is free are the same
// times printed on the card that sent you here, and putting a gate in front of
// "when can we talk" is the thing this feature exists to remove.
export async function GET(req: NextRequest) {
  const person = findScheduler(req.nextUrl.searchParams.get("with"));
  if (!person) return noStore({ error: "Unknown person" }, 404);
  const days = await getAvailability(person.slug);
  return noStore({ person: { slug: person.slug, name: person.name }, days });
}

const bookSchema = z.object({
  with: z.string().trim().max(40),
  // An instant, not a wall clock. The client only ever holds what GET handed
  // it, so anything that fails to round-trip through Date is a hand-built post.
  startsAt: z.string().trim().max(40),
  name: z.string().trim().min(1, "We need a name to put on the call").max(120),
  email: z.email("That email doesn't look right").max(255),
  phone: z.string().trim().max(50).optional().default(""),
  eventDate: z.string().trim().max(20).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return noStore({ error: "That's a lot of requests. Try again in a bit." }, 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return noStore({ error: "We couldn't read that request." }, 400);
  }

  const parsed = bookSchema.safeParse(body);
  if (!parsed.success) {
    return noStore({ error: parsed.error.issues[0]?.message ?? "Something in that form isn't right." }, 400);
  }
  const data = parsed.data;

  const person = findScheduler(data.with);
  if (!person) return noStore({ error: "Unknown person" }, 404);

  const startsAt = new Date(data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return noStore({ error: "That time didn't make sense. Pick one from the calendar." }, 400);
  }

  const result = await bookAppointment({
    person,
    startsAt,
    name: data.name,
    email: data.email,
    phone: data.phone,
    eventDate: data.eventDate,
    notes: data.notes,
  });

  if (!result.ok) {
    // "taken" is the race and it is the only one worth a distinct message,
    // because the fix is one tap: the calendar refreshes and the slot is gone.
    const message =
      result.reason === "taken"
        ? "Someone just took that time. Pick another and we'll lock it in."
        : result.reason === "gone"
          ? "That time isn't open any more. Here are the times that are."
          : `${person.name} hasn't opened any times yet. Send us a note instead and we'll come to you.`;
    return noStore({ error: message, retry: result.reason !== "unavailable" }, 409);
  }

  // Awaited, not fired and forgotten. A serverless function that returns before
  // its mail resolves gets frozen mid-send, which is the lesson from the
  // booking route and it applies identically here.
  await sendIntroCallEmails({
    person,
    startsAt,
    durationMinutes: APPOINTMENT_MINUTES,
    name: data.name,
    email: data.email,
    phone: data.phone,
    eventDate: data.eventDate,
    notes: data.notes,
  });

  return noStore({ ok: true, id: result.id });
}
