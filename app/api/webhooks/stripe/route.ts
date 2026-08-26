import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { weddings } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Marks the deposit paid when Stripe confirms checkout. Signature-verified;
// fails closed until both Stripe secrets exist (CLAUDE.md §9.4).
export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhooks are not enabled yet" }, { status: 501 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = new Stripe(key);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, webhookSecret);
  } catch (err) {
    console.error("[stripe] signature verification failed:", (err as Error).message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const weddingId = session.metadata?.weddingId;
    if (weddingId) {
      await db
        .update(weddings)
        .set({ isDepositPaid: true, status: "deposit_paid", updatedAt: new Date() })
        .where(eq(weddings.id, weddingId));
      console.log(`[stripe] deposit recorded for wedding ${weddingId}`);
    }
  }

  return NextResponse.json({ received: true });
}
