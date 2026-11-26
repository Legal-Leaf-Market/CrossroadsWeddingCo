import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PARTNERS } from "@/lib/partners";

// The partner list (2026-11-18). Local businesses we send couples and hosts to
// for what we don't do ourselves. No referral fee or ranking is implied: the
// order is the order they joined.
const TITLE = "Local partners for your wedding or event";
const DESCRIPTION =
  "Columbus, Indiana businesses we partner with for the parts of the day we don't do ourselves: catering, cookies, dessert tables, favors, balloon installs and photography.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/partners" },
  openGraph: { url: "/partners", title: TITLE, description: DESCRIPTION },
};

export default function PartnersPage() {
  return (
    <>
      <Header />
      <main>
        <section className="bg-charcoal py-16 text-cream">
          <div className="mx-auto max-w-4xl px-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">Partners</p>
            <h1 className="max-w-2xl text-4xl leading-tight sm:text-5xl">Local partners we trust with your day.</h1>
            <p className="mt-6 max-w-2xl text-lg text-cream/80">
              We handle the music, the mic and the bar. For the food, the sweets, the balloons and the photos, these are the Columbus
              businesses we partner with. Book them directly, or tell us on your intro call and we&apos;ll connect you.
            </p>
          </div>
        </section>
        <section className="bg-cream py-14">
          <div className="mx-auto grid max-w-5xl gap-6 px-6 md:grid-cols-2">
            {PARTNERS.map((p) => (
              <a
                key={p.slug}
                href={`/partners/${p.slug}`}
                className="group flex flex-col rounded-2xl border border-parchment bg-white p-6 transition hover:border-terracotta/60"
              >
                <h2 className="text-2xl text-charcoal group-hover:text-terracotta">{p.name}</h2>
                <p className="mt-1 text-sm font-semibold text-terracotta">{p.kind}</p>
                {p.badge && (
                  <p className="mt-3 inline-flex self-start rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-charcoal">
                    {p.badge}
                  </p>
                )}
                <p className="mt-4 flex-1 text-ink/80">{p.intro}</p>
                <span className="mt-5 text-sm font-semibold text-terracotta underline decoration-terracotta/40 underline-offset-2">
                  See {p.name}
                </span>
              </a>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-5xl px-6 text-sm text-ink/60">
            Run a local wedding or event business? Write to us from the{" "}
            <a href="/#contact" className="underline underline-offset-2 hover:text-charcoal">contact section</a>.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
