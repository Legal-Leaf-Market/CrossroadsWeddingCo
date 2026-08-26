import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookCallCard from "@/components/BookCallCard";
import BookingForm from "@/components/BookingForm";
import { DEPOSIT_USD, DJ_DAY_RATE_USD } from "@/lib/site";

const DESCRIPTION = `Request your wedding date: flat $${DJ_DAY_RATE_USD.toLocaleString("en-US")} DJ & MC day rate, $${DEPOSIT_USD} deposit locks it in once we confirm availability.`;

export const metadata: Metadata = {
  title: "Check your date",
  description: DESCRIPTION,
  alternates: { canonical: "/book" },
  openGraph: { url: "/book", title: "Check your date", description: DESCRIPTION },
};

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ deposit?: string }>;
}) {
  // Stripe checkout returns here with ?deposit=paid|cancelled — the page must
  // not greet someone who just paid $500 with "No payment now."
  const { deposit } = await searchParams;
  return (
    <>
      <Header />
      <main>
        <section className="bg-charcoal py-20 text-cream">
          <div className="mx-auto max-w-3xl px-6">
            {deposit === "paid" && (
              <div role="status" className="mb-8 rounded-2xl border border-sage/60 bg-sage/10 p-6">
                <h2 className="text-xl text-cream">Deposit received — your date is locked.</h2>
                <p className="mt-2 text-cream/70">
                  A receipt is on its way from Stripe, and we&apos;ll follow up by email with
                  everything that happens next. Thank you!
                </p>
              </div>
            )}
            {deposit === "cancelled" && (
              <div role="status" className="mb-8 rounded-2xl border border-cream/20 bg-cream/5 p-6">
                <p className="text-cream/80">
                  Payment was cancelled — nothing was charged. Your date request still stands,
                  and the deposit link keeps working whenever you&apos;re ready.
                </p>
              </div>
            )}
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">
              {deposit === "paid"
                ? "Deposit paid"
                : `No payment now \u00b7 $${DEPOSIT_USD} deposit locks the date once confirmed`}
            </p>
            <h1 className="text-4xl sm:text-5xl">Check your date</h1>
            <p className="mt-4 max-w-xl text-lg text-cream/80">
              Tell us the date and the place. We&apos;ll confirm availability within 24 hours,
              and the rate is exactly what it says on the site.
            </p>
            <div className="mt-10">
              <BookingForm />
            </div>
            <div className="mt-10">
              <BookCallCard />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
