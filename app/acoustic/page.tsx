import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookCallCard from "@/components/BookCallCard";
import {
  ACOUSTIC_ADDON_USD,
  CONTACT_EMAIL,
  SERVICE_RADIUS_BLURB,
  SITE_NAME,
  SITE_URL,
  TRAVEL_SURCHARGE_RANGE,
} from "@/lib/site";

// Shareable a-la-carte page (owner directive 2026-08-28): couples who already
// have their DJ can book the live solo acoustic set on its own, flat $500.
const TITLE = `Live solo acoustic set for your wedding: flat $${ACOUSTIC_ADDON_USD}`;
const DESCRIPTION = `One performer, singer-songwriter style, played live for your ceremony or cocktail hour. Flat $${ACOUSTIC_ADDON_USD}, with up to three requested songs learned just for you. Book it with our DJ package or entirely on its own.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/acoustic" },
  openGraph: { url: "/acoustic", title: TITLE, description: DESCRIPTION },
};

export default function AcousticPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Live wedding acoustic music",
    name: `${SITE_NAME}: Live Solo Acoustic Set`,
    description: DESCRIPTION,
    provider: {
      "@type": "LocalBusiness",
      "@id": `${SITE_URL}/#business`,
      name: SITE_NAME,
      url: SITE_URL,
    },
    offers: {
      "@type": "Offer",
      price: String(ACOUSTIC_ADDON_USD),
      priceCurrency: "USD",
      description: "Flat rate for a live solo acoustic set, ceremony or cocktail hour, standalone or alongside the DJ package.",
    },
  };

  return (
    <>
      <Header />
      <main>
        <section className="bg-charcoal py-20 text-cream">
          <div className="mx-auto max-w-4xl px-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">
              A la carte or with our DJ package · Flat ${ACOUSTIC_ADDON_USD}
            </p>
            <h1 className="max-w-2xl text-4xl leading-tight sm:text-5xl">
              Live music for the moment everyone remembers.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-cream/80">
              One performer, singer-songwriter style, played live for your ceremony or your
              cocktail hour. Real strings, real voice, your songs. No track, no karaoke rig,
              no twelve-piece band invoice.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="/book?service=acoustic"
                className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
              >
                Check your date
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Acoustic set inquiry`}
                className="rounded-full border border-cream/40 px-6 py-3 text-sm font-semibold text-cream hover:border-cream/70"
              >
                Just the acoustic set? Email us
              </a>
            </div>
          </div>
        </section>

        <section className="bg-cream py-16">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-3xl text-charcoal">How the set works</h2>
            <ul className="mt-6 space-y-4 text-ink/80">
              {[
                "One performer, guitar and voice, singer-songwriter style. Think stripped-back covers of the songs you actually love.",
                "Ceremony or cocktail hour. One hour is the sweet spot; two hours is the absolute max, because live music should end before anyone wants it to.",
                "With enough notice, we learn up to three requested songs just for your wedding. The rest comes from a standing repertoire we keep sharp.",
                "Processionals, recessionals, and first dances played live turn a song you like into a moment you keep.",
                "Booking our DJ too? The handoff is seamless: the acoustic set ends and the next playlist starts on the same beat, because it's the same crew.",
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
              <h2 className="text-2xl text-charcoal">Already have a DJ? Perfect.</h2>
              <p className="mt-3 text-ink/70">
                The acoustic set books entirely on its own. Plenty of couples have their DJ
                locked in and just want live music for the ceremony or cocktail hour; we show
                up, play the set, and hand the room back to your crew. Flat
                ${ACOUSTIC_ADDON_USD}, no package required, no strings attached except the
                six on the guitar.
              </p>
              <p className="mt-3 text-sm text-ink/60">
                {SERVICE_RADIUS_BLURB} Venues past about an hour from Columbus carry a{" "}
                {TRAVEL_SURCHARGE_RANGE} travel fee, quoted up front.
              </p>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Acoustic set inquiry`}
                className="mt-6 inline-block rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
              >
                Ask about your date
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
              covers ceremony through last dance, and the acoustic set bolts right on.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
