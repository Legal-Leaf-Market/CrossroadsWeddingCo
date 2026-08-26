import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookCallCard from "@/components/BookCallCard";
import BookingForm from "@/components/BookingForm";
import { DEPOSIT_USD, DJ_DAY_RATE_USD } from "@/lib/site";

export const metadata: Metadata = {
  title: "Check your date",
  description: `Request your wedding date: flat $${DJ_DAY_RATE_USD.toLocaleString("en-US")} DJ & MC day rate, $${DEPOSIT_USD} deposit locks it in once we confirm availability.`,
  alternates: { canonical: "/book" },
};

export default function BookPage() {
  return (
    <>
      <Header />
      <main>
        <section className="bg-charcoal py-20 text-cream">
          <div className="mx-auto max-w-3xl px-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">
              No payment now &middot; ${DEPOSIT_USD} deposit locks the date once confirmed
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
