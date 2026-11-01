import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  CONTACT_EMAIL,
  CORPORATE_DEPOSIT_USD,
  CORPORATE_DJ_SOUND_USD,
  SERVICE_RADIUS_BLURB,
  SITE_NAME,
  SITE_URL,
  TRAVEL_SURCHARGE_RANGE,
} from "@/lib/site";

// Corporate and event page (owner directive 2026-11-01): the door every
// corporate pitch, holiday party call and partner referral points at. Flat
// $1,500 for DJ and sound; the wedding day rate is never shown as an event
// price here. Acoustic and bar staff are quoted per event, so this page names
// them without a number.
const PRICE = `$${CORPORATE_DJ_SOUND_USD.toLocaleString("en-US")}`;
const DEPOSIT = `$${CORPORATE_DEPOSIT_USD.toLocaleString("en-US")}`;
const TITLE = `Corporate event and holiday party DJ: ${PRICE} flat for DJ and sound`;
const DESCRIPTION = `DJ, sound and MC for corporate events, holiday parties, galas and company celebrations across Columbus, Indianapolis, Greenwood, Franklin and Bloomington. ${PRICE} flat, MC included.`;
// The link a venue or planner passes on after putting us on their list. The
// ?src=venue tag rides into the call booking (appointments.src_tag) and the
// team's booking email. Tags are printed and shared: add, never rename.
const REFERRAL_LINK = `${SITE_URL.replace(/^https?:\/\//, "")}/events?src=venue`;
const MAILTO =`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Event inquiry")}`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/events" },
  openGraph: { url: "/events", title: TITLE, description: DESCRIPTION },
};

export default function EventsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Corporate event DJ and sound",
    name: `${SITE_NAME}: Corporate Event DJ and Sound`,
    description: DESCRIPTION,
    provider: {
      "@type": "LocalBusiness",
      "@id": `${SITE_URL}/#business`,
      name: SITE_NAME,
      url: SITE_URL,
    },
    offers: {
      "@type": "Offer",
      price: String(CORPORATE_DJ_SOUND_USD),
      priceCurrency: "USD",
      description: "Flat rate for DJ and sound at a corporate event, MC included.",
    },
  };

  return (
    <>
      <Header />
      <main>
        <section className="bg-charcoal py-20 text-cream">
          <div className="mx-auto max-w-4xl px-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">
              Corporate events and holiday parties · {PRICE} flat
            </p>
            <h1 className="max-w-2xl text-4xl leading-tight sm:text-5xl">
              Your event runs on time, and the room has a great night.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-cream/80">
              DJ, sound and MC for holiday parties, galas, award dinners, company picnics and
              celebrations. One flat price, the mic handled for every speech, and a crew that
              follows your run of show to the minute.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="/book?with=jake"
                className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
              >
                Book a call with Jake
              </a>
              <a
                href={MAILTO}
                className="rounded-full border border-cream/40 px-6 py-3 text-sm font-semibold text-cream hover:border-cream/70"
              >
                Email us your date
              </a>
            </div>
          </div>
        </section>

        <section className="bg-cream py-16">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-3xl text-charcoal">What {PRICE} covers</h2>
            <ul className="mt-6 space-y-4 text-ink/80">
              {[
                "DJ and a sound system sized for your room, set up before your guests arrive.",
                "A wireless mic for welcomes, speeches, awards and raffles, with someone on the board making sure every word is heard.",
                "An MC who keeps the agenda moving and hands the floor back to the party.",
                "Background music through dinner, then a dance floor if you want one. You set the line on what plays and what doesn't.",
                "Your timeline and your venue's rules: load-in windows, sound limits and hard stops.",
                `A ${DEPOSIT} deposit locks your date.`,
              ].map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-terracotta" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-parchment/40 py-16">
          <div className="mx-auto grid max-w-4xl gap-6 px-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-parchment bg-cream p-6">
              <h2 className="text-xl text-charcoal">Holiday parties</h2>
              <p className="mt-3 text-ink/70">
                December dates are open, short notice included. Tell us the night, the venue and
                roughly how many people, and we&apos;ll confirm the same day.
              </p>
            </div>
            <div className="rounded-2xl border border-parchment bg-cream p-6">
              <h2 className="text-xl text-charcoal">Add live music or a bar crew</h2>
              <p className="mt-3 text-ink/70">
                A live solo acoustic set for a reception or dinner, and licensed bartenders to
                staff your bar (you or your venue provide the alcohol). Quoted per event.
              </p>
            </div>
            <div className="rounded-2xl border border-parchment bg-cream p-6 sm:col-span-2">
              <h2 className="text-xl text-charcoal">Where we work</h2>
              <p className="mt-3 text-ink/70">
                {SERVICE_RADIUS_BLURB} Events past about an hour from Columbus carry a{" "}
                {TRAVEL_SURCHARGE_RANGE} travel fee, quoted up front.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-cream py-16">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-3xl text-charcoal">For venues and event planners</h2>
            <p className="mt-4 max-w-2xl text-ink/80">
              When a client asks you who to call for a DJ, this is what you&apos;re handing them: one
              flat price they can read on this page before anyone talks, an MC who runs your
              timeline, and a crew that works inside your house rules. December short notice
              included.
            </p>
            <ul className="mt-6 space-y-3 text-ink/80">
              {[
                "We arrive early and load in on your schedule.",
                "We keep to your sound limits, cutoffs and hard stops.",
                "We take the mic for welcomes, toasts and awards, so your coordinator doesn't have to.",
                `The price doesn't change after the call: ${PRICE} for DJ and sound, MC included.`,
              ].map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-terracotta" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-ink/80">
              Putting us on your vendor list? Send clients this link, so we know the booking came
              from you:
            </p>
            <p className="mt-2 text-sm font-semibold text-charcoal [overflow-wrap:anywhere] sm:text-base">{REFERRAL_LINK}</p>
          </div>
        </section>

        <section className="bg-charcoal py-16 text-cream">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl">Tell us the date.</h2>
            <p className="mt-3 text-cream/70">
              We&apos;ll tell you right away if we&apos;re free, and the price is the price.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <a
                href="/book?with=jake"
                className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
              >
                Book a call with Jake
              </a>
              <a
                href={MAILTO}
                className="rounded-full border border-cream/40 px-6 py-3 text-sm font-semibold text-cream hover:border-cream/70"
              >
                {CONTACT_EMAIL}
              </a>
            </div>
            <p className="mt-8 text-sm text-cream/50">
              Planning a wedding instead? The{" "}
              <a href="/" className="underline decoration-cream/30 underline-offset-2 hover:text-cream/80">
                flat-rate wedding DJ and MC package
              </a>{" "}
              is the other half of what we do.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
