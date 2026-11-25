import Stripe from "stripe";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenants, type Tenant } from "@/lib/db/schema";
import { PLAN_PRICE_USD, PLATFORM_NAME } from "@/lib/tenant-constants";

// Platform billing: one plan, $50 a month, through Stripe Checkout and the
// Stripe customer portal. Stripe holds the card and is the record of truth;
// the webhook mirrors the subscription onto the tenant row. Found (the bank)
// has no API and routes its own card payments through Stripe, so payouts are
// set to land in the Found account from the Stripe dashboard.
//
// Fails closed: without STRIPE_SECRET_KEY the billing page says billing is not
// switched on and shows no button.

/** Statuses that keep an account on the paid plan. past_due keeps access while Stripe retries the card. */
const LIVE = new Set(["trialing", "active", "past_due"]);
/** Statuses that end it. "incomplete" changes nothing: the first payment is still being attempted. */
const ENDED = new Set(["canceled", "unpaid", "incomplete_expired", "paused"]);

export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");
  return new Stripe(key);
}

export function hasLiveSubscription(t: Pick<Tenant, "billingStatus" | "stripeSubscriptionId">): boolean {
  return Boolean(t.stripeSubscriptionId && t.billingStatus && LIVE.has(t.billingStatus));
}

/**
 * A Checkout session for the monthly plan. Days left on the free trial carry
 * over: the card is saved now and first charged when the trial ends. Stripe
 * needs a trial end at least 48 hours out, so a trial closer to its end than
 * that is simply charged now.
 */
export async function startCheckout(t: Tenant, email: string, origin: string): Promise<string> {
  const trialEnd = t.trialEndsAt ? Math.floor(t.trialEndsAt.getTime() / 1000) : 0;
  const carryTrial = trialEnd > Math.floor(Date.now() / 1000) + 49 * 3600;
  const priceId = process.env.STRIPE_PRICE_ID?.trim();
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    client_reference_id: t.id,
    ...(t.stripeCustomerId ? { customer: t.stripeCustomerId } : { customer_email: email }),
    line_items: [
      priceId
        ? { price: priceId, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: PLAN_PRICE_USD * 100,
              recurring: { interval: "month" },
              product_data: { name: `${PLATFORM_NAME}, monthly plan` },
            },
          },
    ],
    subscription_data: {
      metadata: { tenant_id: t.id },
      ...(carryTrial ? { trial_end: trialEnd } : {}),
    },
    metadata: { tenant_id: t.id, purpose: "platform_plan" },
    allow_promotion_codes: true,
    success_url: `${origin}/app/billing?done=1`,
    cancel_url: `${origin}/app/billing`,
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

/** The Stripe customer portal: change card, see invoices, cancel. */
export async function portalUrl(t: Tenant, origin: string): Promise<string | null> {
  if (!t.stripeCustomerId) return null;
  const s = await stripe().billingPortal.sessions.create({
    customer: t.stripeCustomerId,
    return_url: `${origin}/app/billing`,
  });
  return s.url;
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  // Newer API versions keep the period on each item; older ones on the subscription.
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const end = item?.current_period_end ?? legacy;
  return typeof end === "number" ? new Date(end * 1000) : null;
}

/**
 * Mirror a subscription onto its account. Out-of-order and repeated webhooks
 * are expected, so an event older than the last one applied changes nothing.
 */
export async function applySubscription(sub: Stripe.Subscription, eventCreated: number): Promise<"applied" | "stale" | "no_account"> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const tenantId = sub.metadata?.tenant_id;
  const at = new Date(eventCreated * 1000);
  const plan = LIVE.has(sub.status) ? "standard" : ENDED.has(sub.status) ? "trial" : null;

  const who = tenantId && /^[0-9a-f-]{36}$/.test(tenantId) ? eq(tenants.id, tenantId) : eq(tenants.stripeCustomerId, customerId);
  const updated = await db
    .update(tenants)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      billingStatus: sub.status,
      billingPeriodEnd: periodEnd(sub),
      billingEventAt: at,
      ...(plan ? { plan } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        who,
        eq(tenants.kind, "customer"),
        or(isNull(tenants.billingEventAt), lte(tenants.billingEventAt, at)),
        // A different subscription replacing a live one is fine; an old,
        // ended one must not overwrite a newer live one.
        or(
          isNull(tenants.stripeSubscriptionId),
          eq(tenants.stripeSubscriptionId, sub.id),
          sql`${tenants.billingStatus} is null or ${tenants.billingStatus} not in ('trialing','active','past_due')`,
        ),
      ),
    )
    .returning({ id: tenants.id });
  if (updated.length) return "applied";
  const [exists] = await db.select({ id: tenants.id }).from(tenants).where(who).limit(1);
  return exists ? "stale" : "no_account";
}

/** Checkout finished: remember the customer, then apply the subscription as Stripe has it now. */
export async function applyCheckout(session: Stripe.Checkout.Session, eventCreated: number): Promise<void> {
  if (session.mode !== "subscription" || session.metadata?.purpose !== "platform_plan") return;
  const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!subId) return;
  const sub = await stripe().subscriptions.retrieve(subId);
  await applySubscription(sub, eventCreated);
}
