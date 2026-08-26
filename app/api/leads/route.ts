import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(json: unknown, status = 200) {
  return NextResponse.json(json, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return noStore({ error: "Invalid request" }, 400);
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const eventDate = String(body.eventDate ?? "").trim();
  const venue = String(body.venue ?? "").trim();
  const services = Array.isArray(body.services)
    ? (body.services as unknown[]).map(String).join(", ")
    : "";
  const message = String(body.message ?? "").trim();

  if (!name || !email) {
    return noStore({ error: "Name and email are required" }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return noStore({ error: "That email doesn't look right" }, 400);
  }

  try {
    await db.insert(leads).values({
      name,
      email,
      eventDate: eventDate || null,
      venue: venue || null,
      services: services || null,
      message: message || null,
    });
    return noStore({ ok: true });
  } catch (err) {
    console.error("[leads] insert failed:", (err as Error).message);
    return noStore(
      { error: "Something went wrong saving your info. Please email us directly instead." },
      500,
    );
  }
}
