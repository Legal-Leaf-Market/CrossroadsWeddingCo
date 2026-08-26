import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookCallCard from "@/components/BookCallCard";
import { CITIES, cityPath, getCity } from "@/lib/cities";
import {
  ACOUSTIC_ADDON_USD,
  BARTENDER_MIN_USD,
  DEPOSIT_USD,
  DJ_DAY_RATE_USD,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

type Params = { state: string; city: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return CITIES.map((c) => ({ state: c.stateSlug, city: c.citySlug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { state, city } = await params;
  const data = getCity(state, city);
  if (!data) return {};
  return {
    title: `Wedding DJ in ${data.name}, ${data.stateAbbr} — flat $${DJ_DAY_RATE_USD.toLocaleString("en-US")}`,
    description: `${SITE_NAME} covers ${data.name}, ${data.stateName}: wedding DJ, MC, and day-of timeline coordination for one flat $${DJ_DAY_RATE_USD.toLocaleString("en-US")} day rate. Live acoustic sets and bar service available.`,
    alternates: { canonical: cityPath(data) },
  };
}

export default async function CityPage({ params }: { params: Promise<Params> }) {
  const { state, city } = await params;
  const data = getCity(state, city);
  if (!data) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Wedding DJ and MC",
    name: `${SITE_NAME} — ${data.headline}`,
    description: data.intro,
    provider: { "@id": `${SITE_URL}/#business` },
    areaServed: {
      "@type": "City",
      name: data.name,
      containedInPlace: { "@type": "State", name: data.stateName },
    },
    offers: {
      "@type": "Offer",
      price: String(DJ_DAY_RATE_USD),
      priceCurrency: "USD",
      description: "Flat day rate: ceremony through last dance, DJ, MC, equipment, and day-of timeline coordination.",
    },
  };

  return (
    <>
      <Header />
      <main>
        <section className="bg-charcoal py-20 text-cream">
          <div className="mx-auto max-w-4xl px-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">
              {data.name}, {data.stateName}
            </p>
            <h1 className="max-w-2xl text-4xl leading-tight sm:text-5xl">{data.headline}</h1>
            <p className="mt-6 max-w-2xl text-lg text-cream/80">{data.intro}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="/book"
                className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
              >
                Check your date
              </a>
              <a
                href="/#services"
                className="rounded-full border border-cream/40 px-6 py-3 text-sm font-semibold text-cream hover:border-cream/70"
              >
                What we do
              </a>
            </div>
          </div>
        </section>

        <section className="bg-cream py-16">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-3xl text-charcoal">
              What weddings around {data.name} get from us
            </h2>
            <ul className="mt-6 space-y-4 text-ink/80">
              {data.localNotes.map((note) => (
                <li key={note} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-terracotta" aria-hidden />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm font-semibold text-sage-dark">{data.travelNote}</p>
          </div>
        </section>

        <section className="bg-parchment/40 py-16">
          <div className="mx-auto max-w-4xl px-6">
            <div className="rounded-2xl border-2 border-terracotta bg-cream p-8">
              <h2 className="text-2xl text-charcoal">The rate is the rate, everywhere we go</h2>
              <p className="mt-3 text-ink/70">
                ${DJ_DAY_RATE_USD.toLocaleString("en-US")} flat for the day: DJ and sound for
                ceremony, cocktail hour, and reception, MC duties dialed to taste, all equipment,
                and day-of timeline coordination. A ${DEPOSIT_USD} deposit locks your date.
              </p>
              <ul className="mt-4 grid gap-2 text-sm text-ink/70 sm:grid-cols-2">
                <li>
                  &bull; Live acoustic set — flat ${ACOUSTIC_ADDON_USD}
                </li>
                <li>
                  &bull; Bar service — from ${BARTENDER_MIN_USD}, fully quoted on your intro call
                </li>
              </ul>
              <a
                href="/book"
                className="mt-6 inline-block rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
              >
                Check your date
              </a>
            </div>
          </div>
        </section>

        <section className="bg-charcoal py-16 text-cream">
          <div className="mx-auto max-w-3xl px-6">
            <BookCallCard />
            <p className="mt-6 text-center text-sm text-cream/50">
              Also serving{" "}
              {CITIES.filter((c) => c.citySlug !== data.citySlug)
                .map((c) => c.name)
                .join(", ")}{" "}
              — anywhere within about two hours of Columbus, Indiana.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
