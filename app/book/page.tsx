import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookCallCard from "@/components/BookCallCard";
import BookingForm from "@/components/BookingForm";
import CallScheduler from "@/components/CallScheduler";
import { APPOINTMENT_MINUTES, findScheduler } from "@/lib/schedulers";
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
  searchParams: Promise<{ deposit?: string; service?: string; with?: string }>;
}) {
  // Stripe checkout returns here with ?deposit=paid|cancelled, and the page must
  // not greet someone who just paid $500 with "No payment now."
  const { deposit, service, with: withSlug } = await searchParams;
  // ?with=<slug> is what the QR code on every printed business card resolves
  // to. The slugs are in lib/schedulers.ts and they are printed, so an unknown
  // one lands on the ordinary page rather than a 404: a card that has been
  // handed out must never dead-end, even if somebody later retires the person
  // on it.
  const scheduler = findScheduler(withSlug);
  // The /acoustic and /bartending pages deep-link a-la-carte bookings.
  const initialServices =
    service === "acoustic" ? ["acoustic"] : service === "bartending" ? ["bartender"] : ["dj"];
  const alaCarte = !initialServices.includes("dj");
  return (
    <>
      <Header />
      <main>
        <section className="bg-charcoal py-20 text-cream">
          <div className="mx-auto max-w-3xl px-6">
            {deposit === "paid" && (
              <div role="status" className="mb-8 rounded-2xl border border-sage/60 bg-sage/10 p-6">
                <h2 className="text-xl text-cream">Deposit received. Your date is locked.</h2>
                <p className="mt-2 text-cream/70">
                  A receipt is on its way from Stripe, and we&apos;ll follow up by email with
                  everything that happens next. Thank you!
                </p>
              </div>
            )}
            {deposit === "cancelled" && (
              <div role="status" className="mb-8 rounded-2xl border border-cream/20 bg-cream/5 p-6">
                <p className="text-cream/80">
                  Payment was cancelled and nothing was charged. Your date request still stands,
                  and the deposit link keeps working whenever you&apos;re ready.
                </p>
              </div>
            )}
            {/* The deposit line is about booking a WEDDING. Above "Talk to
                Brayton" it reads as the price of the phone call, which is
                nothing, so the call page says what the call costs instead. */}
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">
              {deposit === "paid"
                ? "Deposit paid"
                : scheduler
                  ? "Free \u00b7 30 minutes \u00b7 No obligation"
                  : alaCarte
                    ? "No payment now \u00b7 A deposit locks the date once confirmed"
                    : `No payment now \u00b7 $${DEPOSIT_USD} deposit locks the date once confirmed`}
            </p>
            <h1 className="text-4xl sm:text-5xl">
              {scheduler ? `Talk to ${scheduler.name}` : "Check your date"}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-cream/80">
              {scheduler
                ? "Pick a time that works and we'll call you. Or skip it and just send us your date below, whichever is easier."
                : "Tell us the date and the place. We'll confirm availability within 24 hours, and the rate is exactly what it says on the site."}
            </p>
            {scheduler && (
              <div className="mt-10">
                <CallScheduler
                  slug={scheduler.slug}
                  name={scheduler.name}
                  title={scheduler.title}
                  minutes={APPOINTMENT_MINUTES}
                />
              </div>
            )}
            <div className="mt-10">
              <BookingForm initialServices={initialServices} />
            </div>
            {/* The external-scheduler card is the fallback for the plain page.
                With a person named it would offer a second, different way to
                book the same call, which is how somebody ends up on two
                calendars. */}
            {!scheduler && (
              <div className="mt-10">
                <BookCallCard />
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
