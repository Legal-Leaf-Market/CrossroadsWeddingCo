import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookCallCard from "@/components/BookCallCard";
import {
  BARTENDER_MIN_USD,
  CONTACT_EMAIL,
  SERVICE_RADIUS_BLURB,
  SITE_NAME,
  SITE_URL,
  TRAVEL_SURCHARGE_RANGE,
} from "@/lib/site";

// Shareable a-la-carte page (owner directive 2026-08-28). Copy must never
// imply we supply or sell alcohol: serve-only, per the standing legal rule in
// CLAUDE.md §9.2. The couple provides the bar; we staff and run it.
const TITLE = `Wedding bartenders for backyard and DIY venues: from $${BARTENDER_MIN_USD}`;
const DESCRIPTION = `Licensed, experienced bartenders for weddings without in-house bar staff. You provide the alcohol, we set up, pour, and take care of your guests. Starting at $${BARTENDER_MIN_USD}, quoted straight on a short call. Books with our DJ package or entirely on its own.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/bartending" },
  openGraph: { url: "/bartending", title: TITLE, description: DESCRIPTION },
};

export default function BartendingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Wedding bartending service",
    name: `${SITE_NAME}: Wedding Bar Service`,
    description: DESCRIPTION,
    provider: {
      "@type": "LocalBusiness",
      "@id": `${SITE_URL}/#business`,
      name: SITE_NAME,
      url: SITE_URL,
    },
    offers: {
      "@type": "Offer",
      priceSpecification: {
        "@type": "PriceSpecification",
        minPrice: String(BARTENDER_MIN_USD),
        priceCurrency: "USD",
      },
      description: "Serve-only wedding bartending: the host provides the alcohol, we staff and run the bar. Final quote depends on guest count and bar setup.",
    },
  };

  return (
    <>
      <Header />
      <main>
        <section className="bg-charcoal py-20 text-cream">
          <div className="mx-auto max-w-4xl px-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">
              A la carte or with our DJ package · From ${BARTENDER_MIN_USD}
            </p>
            <h1 className="max-w-2xl text-4xl leading-tight sm:text-5xl">
              Your bar, run by pros who do this for a living.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-cream/80">
              Backyard wedding? Barn with no bar staff? You buy the alcohol you actually
              want, and our licensed, experienced bartenders set it up, pour it right, and
              take care of your people all night.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="/book"
                className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
              >
                Check your date
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Bar service inquiry`}
                className="rounded-full border border-cream/40 px-6 py-3 text-sm font-semibold text-cream hover:border-cream/70"
              >
                Just the bar? Email us
              </a>
            </div>
          </div>
        </section>

        <section className="bg-cream py-16">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-3xl text-charcoal">How wedding bars work in Indiana</h2>
            <p className="mt-4 max-w-2xl text-ink/70">
              This part trips a lot of couples up, so here it is straight:
            </p>
            <ul className="mt-6 space-y-4 text-ink/80">
              {[
                "You (or your caterer or venue) provide the alcohol. We never sell it or supply it; that keeps your backyard or DIY-venue bar on the right side of Indiana law, and it means you pay store prices for your shelf instead of markup.",
                "On private property, a host serving their own guests is exactly how the rules are designed to work. We staff and pour on your behalf.",
                "At a licensed venue, we work under the venue's permit and their rules, alongside their team.",
                "Our bartenders hold current Indiana ATC permits and bring about twenty years of behind-the-bar experience.",
                "We serve like professionals: checking IDs, pacing the pours, and handling the one guest who's had enough with a smile instead of a scene.",
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
          <div className="mx-auto max-w-4xl px-6">
            <div className="rounded-2xl border-2 border-terracotta bg-cream p-8">
              <h2 className="text-2xl text-charcoal">
                ${BARTENDER_MIN_USD} is the minimum, not the price.
              </h2>
              <p className="mt-3 text-ink/70">
                Your guest count and your shelf set the real number: a hundred guests with
                beer and wine is a different night than two hundred guests with a full
                cocktail list, and bigger guest lists need a second bartender. So we don&apos;t
                quote vague ranges on a website; we ask about your bar on a short call and
                give you one straight number that doesn&apos;t move.
              </p>
              <p className="mt-3 text-ink/70">
                And yes, it books entirely on its own. Already have your DJ? Our bartenders
                will still happily run your bar.
              </p>
              <p className="mt-3 text-sm text-ink/60">
                {SERVICE_RADIUS_BLURB} Venues past about an hour from Columbus carry a{" "}
                {TRAVEL_SURCHARGE_RANGE} travel fee, quoted up front.
              </p>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Bar service inquiry`}
                className="mt-6 inline-block rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
              >
                Get your straight quote
              </a>
            </div>
          </div>
        </section>

        <section className="bg-charcoal py-16 text-cream">
          <div className="mx-auto max-w-3xl px-6">
            <BookCallCard />
            <p className="mt-6 text-center text-sm text-cream/50">
              Want the whole day handled? The{" "}
              <a href="/" className="underline decoration-cream/30 underline-offset-2 hover:text-cream/80">
                $1,000 flat-rate DJ and MC package
              </a>{" "}
              covers ceremony through last dance, and bar service bolts right on.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
