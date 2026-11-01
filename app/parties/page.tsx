import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BarRules from "@/components/BarRules";
import {
  CONTACT_EMAIL,
  SERVICE_RADIUS_BLURB,
  SITE_NAME,
  SITE_URL,
  TRAVEL_SURCHARGE_RANGE,
} from "@/lib/site";

// Private parties (owner directive 2026-11-01): the third path beside weddings
// and corporate events. Birthdays, Halloween, graduations, anniversaries. The
// owner's call is that the DJ and the bar are both quoted on the call, so this
// page publishes no price and the JSON-LD carries no Offer: structured data may
// only say what the page says. The wedding and corporate rates are deliberately
// not shown as a party price either.
const TITLE = "Private party DJ and bartenders: birthdays, Halloween, graduations";
const DESCRIPTION =
  "DJ, sound, MC and licensed bartenders for private parties across Columbus, Indianapolis, Greenwood, Franklin and Bloomington. You provide the alcohol, we serve it. Quoted on a short call.";
const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Private party inquiry")}`;

const PARTIES = [
  ["Birthdays", "Milestone birthdays, surprise parties, a 21st done right."],
  ["Halloween and costume parties", "A playlist that fits the night, a costume contest on the mic, and a bar crew that knows how to check an ID under a mask."],
  ["Graduations", "Open houses and grad parties, with music the grad and the grandparents can both live with."],
  ["Anniversaries and vow renewals", "The first dance again, the toasts on a good mic, and the songs from the year you met."],
  ["Retirements and reunions", "Speeches people can hear, and a room that remembers how to dance."],
  ["Holiday get-togethers", "Friends, family or the neighborhood, at home or in a rented hall."],
];

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/parties" },
  openGraph: { url: "/parties", title: TITLE, description: DESCRIPTION },
};

export default function PartiesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Private party DJ and bartending",
    name: `${SITE_NAME}: Private Party DJ and Bartenders`,
    description: DESCRIPTION,
    provider: {
      "@type": "LocalBusiness",
      "@id": `${SITE_URL}/#business`,
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  return (
    <>
      <Header />
      <main>
        <section className="bg-charcoal py-20 text-cream">
          <div className="mx-auto max-w-4xl px-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">
              Private parties · Quoted on a short call
            </p>
            <h1 className="max-w-2xl text-4xl leading-tight sm:text-5xl">
              Your party, with the music and the bar handled.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-cream/80">
              DJ, sound and MC for birthdays, Halloween parties, graduations and anniversaries,
              plus licensed bartenders to run your bar. The same crew that runs weddings, sized
              for your party.
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
            <h2 className="text-3xl text-charcoal">The parties we do</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {PARTIES.map(([name, line]) => (
                <div key={name} className="rounded-2xl border border-parchment bg-cream p-6">
                  <h3 className="text-lg text-charcoal">{name}</h3>
                  <p className="mt-2 text-ink/70">{line}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-parchment/40 py-16">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-3xl text-charcoal">What you can book</h2>
            <ul className="mt-6 space-y-4 text-ink/80">
              {[
                "DJ and a sound system sized for your room or your yard.",
                "A wireless mic for toasts, a costume contest, or the birthday speech, with an MC who keeps it moving.",
                "A live solo acoustic set, if you want real music during dinner or early in the night.",
                "Licensed bartenders to set up, pour and break down your bar.",
                "Any one of these on its own, or all of them together.",
              ].map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-terracotta" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-cream py-16">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-3xl text-charcoal">How the bar works at a private party</h2>
            <p className="mt-4 max-w-2xl text-ink/70">
              This is the part people ask about most, so here it is straight:
            </p>
            <div className="mt-6">
              <BarRules path="party" />
            </div>
          </div>
        </section>

        <section className="bg-parchment/40 py-16">
          <div className="mx-auto max-w-4xl px-6">
            <div className="rounded-2xl border-2 border-terracotta bg-cream p-8">
              <h2 className="text-2xl text-charcoal">How pricing works</h2>
              <p className="mt-3 text-ink/70">
                Parties come in every size, so we quote yours on a short call: how many hours, how
                many guests, and whether you want the DJ, the bar, or both. You get one number, and
                that number does not move afterward.
              </p>
              <p className="mt-3 text-sm text-ink/60">
                {SERVICE_RADIUS_BLURB} Parties past about an hour from Columbus carry a{" "}
                {TRAVEL_SURCHARGE_RANGE} travel fee, quoted up front.
              </p>
              <a
                href="/book?with=jake"
                className="mt-6 inline-block rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
              >
                Get your quote
              </a>
            </div>
          </div>
        </section>

        <section className="bg-charcoal py-16 text-cream">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl">Tell us the date.</h2>
            <p className="mt-3 text-cream/70">We&apos;ll tell you right away if we&apos;re free.</p>
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
              Planning a{" "}
              <a href="/" className="underline decoration-cream/30 underline-offset-2 hover:text-cream/80">
                wedding
              </a>{" "}
              or a{" "}
              <a href="/events" className="underline decoration-cream/30 underline-offset-2 hover:text-cream/80">
                company event
              </a>{" "}
              instead? Those have their own flat prices.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
