import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { getCustomerWorkspace } from "@/lib/auth";
import { billingConfigured, hasLiveSubscription } from "@/lib/billing";
import { PLAN_PRICE_USD, PLATFORM_NAME } from "@/lib/tenant-constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Billing | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const when = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Indiana/Indianapolis" });

// One plan, $50 a month, every feature. Checkout and card changes happen on
// Stripe's own pages; this page says where the account stands.
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  const ws = await getCustomerWorkspace();
  if (!ws) redirect("/login");
  const sp = await searchParams;
  const t = ws.tenant;
  const live = hasLiveSubscription(t);
  const on = billingConfigured();
  const trialLeft = t.trialEndsAt ? Math.ceil((t.trialEndsAt.getTime() - Date.now()) / 86_400_000) : null;

  let status: string;
  if (t.billingStatus === "trialing") {
    status = `Your plan is set up. Your card is first charged $${PLAN_PRICE_USD} when your free trial ends${t.billingPeriodEnd ? ` on ${when(t.billingPeriodEnd)}` : ""}.`;
  } else if (t.billingStatus === "active") {
    status = `You're on the $${PLAN_PRICE_USD} monthly plan.${t.billingPeriodEnd ? ` Next charge ${when(t.billingPeriodEnd)}.` : ""}`;
  } else if (t.billingStatus === "past_due") {
    status = "Your last payment didn't go through. Stripe will try again; update your card to keep things running.";
  } else if (t.billingStatus === "canceled" || t.billingStatus === "unpaid") {
    status = "Your plan has ended. Start it again any time; your bookings and books are still here.";
  } else if (trialLeft !== null && trialLeft > 0) {
    status = `${trialLeft} ${trialLeft === 1 ? "day" : "days"} left in your free trial. Add a card now and you're not charged until it ends.`;
  } else {
    status = "Your free trial has ended. Start your plan to keep going.";
  }

  return (
    <AccountShell signedIn>
      <p className="text-sm font-semibold uppercase tracking-widest text-terracotta-dark">{t.name}</p>
      <h1 className="mt-2 text-3xl text-charcoal sm:text-4xl">Billing</h1>

      {sp.done === "1" && (
        <p className="mt-4 rounded-xl bg-sage/15 px-4 py-3 text-sm text-charcoal" role="status">
          Thanks. Stripe is confirming your plan; it shows here within a minute. Refresh if it hasn&apos;t yet.
        </p>
      )}
      {sp.error === "1" && (
        <p className="mt-4 rounded-xl bg-terracotta/10 px-4 py-3 text-sm font-semibold text-terracotta-dark" role="alert">
          We couldn&apos;t reach Stripe just now. Nothing was charged. Try again in a minute.
        </p>
      )}

      <section className="mt-8 rounded-2xl border border-parchment bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink/55">Your plan</p>
        <p className="mt-1 text-2xl font-semibold text-charcoal">
          ${PLAN_PRICE_USD} a month <span className="text-base font-normal text-ink/60">every feature, one plan</span>
        </p>
        <p className="mt-3 text-ink/75">{status}</p>

        {!on ? (
          <p className="mt-5 text-sm text-ink/60">Online billing isn&apos;t switched on yet. Nothing is due while it&apos;s off.</p>
        ) : (
          <div className="mt-5 flex flex-wrap gap-3">
            {!live && (
              <form action="/api/app/billing/checkout" method="post">
                <button type="submit" className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark">
                  {t.billingStatus ? "Start my plan again" : "Start my plan"}
                </button>
              </form>
            )}
            {t.stripeCustomerId && (
              <form action="/api/app/billing/portal" method="post">
                <button
                  type="submit"
                  className={
                    live
                      ? "rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
                      : "rounded-full border border-parchment px-6 py-3 text-sm font-semibold text-ink/70 hover:border-terracotta"
                  }
                >
                  Card, invoices and cancelling
                </button>
              </form>
            )}
          </div>
        )}
        <p className="mt-5 text-xs text-ink/50">
          Payments are handled by Stripe. We never see or store your card number. Cancel any time from this page;
          you keep access to the end of the month you paid for.
        </p>
      </section>
    </AccountShell>
  );
}
