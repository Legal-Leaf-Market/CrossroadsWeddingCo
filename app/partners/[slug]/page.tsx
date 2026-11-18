import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PARTNERS, findPartner } from "@/lib/partners";

export const dynamicParams = false;
export function generateStaticParams() {
  return PARTNERS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = findPartner((await params).slug);
  if (!p) return {};
  const title = `${p.name}, a Crossroads partner`;
  return {
    title,
    description: p.intro,
    alternates: { canonical: `/partners/${p.slug}` },
    openGraph: { url: `/partners/${p.slug}`, title, description: p.intro },
  };
}

function dateLabel(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function PartnerPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = findPartner((await params).slug);
  if (!p) notFound();
  const external = (href: string) => /^https?:/.test(href);
  return (
    <>
      <Header />
      <main>
        <section className="bg-charcoal py-16 text-cream">
          <div className="mx-auto max-w-4xl px-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">
              <a href="/partners" className="hover:text-cream">Partners</a>
            </p>
            <h1 className="text-4xl leading-tight sm:text-5xl">{p.name}</h1>
            <p className="mt-3 text-lg text-gold/90">{p.kind}</p>
            <p className="mt-6 max-w-2xl text-lg text-cream/80">{p.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {p.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  {...(external(l.href) ? { target: "_blank", rel: "noopener" } : {})}
                  className={
                    l.primary
                      ? "rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
                      : "rounded-full border border-cream/40 px-6 py-3 text-sm font-semibold text-cream hover:border-cream/70"
                  }
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-cream py-14">
          <div className={`mx-auto grid max-w-5xl gap-10 px-6 ${p.art ? "md:grid-cols-[3fr_2fr]" : ""}`}>
            <div>
              <h2 className="text-3xl text-charcoal">For your wedding or event</h2>
              <ul className="mt-6 space-y-3 text-ink/80">
                {p.forEvents.map((line) => (
                  <li key={line} className="flex gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-terracotta" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {p.details && (
                <dl className="mt-8 space-y-3 rounded-2xl border border-parchment bg-white p-6 text-sm">
                  {p.details.map((d) => (
                    <div key={d.label}>
                      <dt className="font-semibold text-charcoal">{d.label}</dt>
                      <dd className="text-ink/80">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {p.related && (
                <p className="mt-6 text-ink/70">
                  Also from the same family: <strong className="text-charcoal">{p.related.name}</strong>, {p.related.about}.
                </p>
              )}
            </div>
            {p.art && (
              <figure className="self-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.art.src} alt={p.art.alt} loading="lazy" width={639} height={533} className="h-auto w-full rounded-2xl bg-parchment/50 p-4" />
                <figcaption className="mt-2 text-xs text-ink/60">{p.art.caption}</figcaption>
              </figure>
            )}
          </div>
        </section>

        <section className="bg-parchment/40 py-12">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-2xl text-charcoal">Planning with Crossroads?</h2>
            <p className="mt-3 max-w-2xl text-ink/80">
              Mention {p.name} on your intro call and we&apos;ll put the timeline together around them, so the dessert table,
              the backdrop and the big moments land where they should.
            </p>
            <a href="/book" className="mt-5 inline-block rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark">
              Check your date
            </a>
            <p className="mt-8 text-xs text-ink/50">
              From {p.name}&apos;s own words ({/^https?:/.test(p.source) ? "their website" : p.source}), checked {dateLabel(p.checked)}. Prices and
              availability come from them.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
