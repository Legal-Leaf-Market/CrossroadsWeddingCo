import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { weddings } from "@/lib/db/schema";
import { DEPOSIT_USD, SITE_NAME, SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Creates a Stripe Checkout session for the $500 date-lock deposit.
// Fails closed until STRIPE_SECRET_KEY exists (CLAUDE.md §9.4): the booking
// UI never renders a payment control while this returns 501.
export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Deposit payments are not enabled yet" }, { status: 501 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) }).safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid booking token" }, { status: 400 });
  }

  const [wedding] = await db
    .select()
    .from(weddings)
    .where(eq(weddings.accessToken, parsed.data.token))
    .limit(1);
  if (!wedding) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (wedding.isDepositPaid) {
    return NextResponse.json({ error: "Deposit already paid" }, { status: 409 });
  }

  const stripe = new Stripe(key);
  // Idempotency key pinned to the wedding: concurrent or repeated clicks get
  // the same Checkout session back instead of minting parallel ones. It is the
  // simplest guard against a double-charged deposit.
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: DEPOSIT_USD * 100,
          product_data: {
            name: `${SITE_NAME}: date-lock deposit`,
            description: `Locks ${wedding.eventDate} for ${wedding.coupleNames}. Non-refundable; applied to the total.`,
          },
        },
      },
    ],
    customer_email: wedding.contactEmail ?? undefined,
    metadata: { weddingId: wedding.id },
    success_url: `${SITE_URL}/book?deposit=paid`,
    cancel_url: `${SITE_URL}/book?deposit=cancelled`,
  }, { idempotencyKey: `deposit-${wedding.id}` });

  return NextResponse.json({ url: session.url });
}
