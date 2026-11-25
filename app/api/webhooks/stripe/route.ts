import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { weddings } from "@/lib/db/schema";
import { ledgerToday } from "@/lib/books/ledger";
import { applyCheckout, applySubscription } from "@/lib/billing";
import { markOfficiantPaidByCard } from "@/lib/service-agreements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One Stripe endpoint, signature-verified, failing closed until both Stripe
// secrets exist (CLAUDE.md §9.4). Two jobs:
//  - platform billing: the $50 monthly plan (lib/billing.ts), mirrored onto
//    the account on checkout and every subscription change;
//  - wedding deposits, only when STRIPE_DEPOSITS_ENABLED=1 opened them;
//  - Compass Events officiating invoices paid by card from the hub
//    (metadata kind "officiant", COMPASS_CARD_PAYMENTS=1).
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

  try {
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const r = await applySubscription(event.data.object, event.created);
      console.log(`[stripe] ${event.type} ${event.data.object.id}: ${r}`);
      return NextResponse.json({ received: true });
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      if (session.mode === "subscription") {
        await applyCheckout(session, event.created);
        return NextResponse.json({ received: true });
      }
      // Compass Events officiating invoice, paid from the couple's hub. Handled
      // and returned before the DJ deposit branch so it can never mark the
      // Crossroads deposit. Only a paid session counts; async success arrives
      // as its own event.
      if (session.metadata?.kind === "officiant") {
        const agreementId = session.metadata.serviceAgreementId;
        const part = session.metadata.part;
        if (agreementId && (part === "deposit" || part === "balance") && session.payment_status === "paid") {
          const r = await markOfficiantPaidByCard(agreementId, part);
          if (r === "already") {
            console.warn(`[stripe] officiant ${part} paid by card but already marked received: ${agreementId} (${session.id}). Check for a double payment.`);
          } else {
            console.log(`[stripe] officiant ${part} ${r} for ${agreementId} (${session.id})`);
          }
        }
        return NextResponse.json({ received: true });
      }
      // completed can arrive with payment_status "unpaid" for async methods, so
      // only a paid session locks the date; async success arrives as its own event.
      const weddingId = session.metadata?.weddingId;
      if (weddingId && session.payment_status === "paid") {
        await db
          .update(weddings)
          .set({ isDepositPaid: true, depositPaidOn: ledgerToday(), status: "deposit_paid", updatedAt: new Date() })
          .where(eq(weddings.id, weddingId));
        console.log(`[stripe] deposit recorded for wedding ${weddingId}`);
      }
    }
  } catch (err) {
    // A 500 makes Stripe retry, which is what we want after a database blip.
    console.error(`[stripe] ${event.type} failed:`, (err as Error).message);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
