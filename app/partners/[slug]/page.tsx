import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PARTNERS, findPartner } from "@/lib/partners";
import { getShopifyMenu, type MenuItem } from "@/lib/partner-menu";

// One page per partner (lib/partners.ts). A partner with a public Shopify
// store gets its live menu, re-read every six hours; nothing else on the page
// changes unless that file does.
export const dynamicParams = false;
export const revalidate = 21600;
// A partner with its own page file (Cookie Paradise) is served by that file,
// never by this template.
export function generateStaticParams() {
  return PARTNERS.filter((p) => !p.customPage).map((p) => ({ slug: p.slug }));
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

function Dot() {
  return <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-terracotta" aria-hidden />;
}

export default async function PartnerPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = findPartner((await params).slug);
  if (!p || p.customPage) notFound();
  const external = (href: string) => /^https?:/.test(href);
  const menu: MenuItem[] = p.liveMenu ? await getShopifyMenu(p.liveMenu.origin) : [];
  const others = PARTNERS.filter((o) => o.slug !== p.slug);
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
                    <Dot />
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
                  Also from the same family:{" "}
                  {p.related.href ? (
                    <a href={p.related.href} target="_blank" rel="noopener" className="font-semibold text-charcoal underline decoration-terracotta/40 underline-offset-2 hover:text-terracotta">
                      {p.related.name}
                    </a>
                  ) : (
                    <strong className="text-charcoal">{p.related.name}</strong>
                  )}
                  , {p.related.about}.
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

        {menu.length > 0 && p.liveMenu && (
          <section className="bg-white py-14" id="menu">
            <div className="mx-auto max-w-5xl px-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-terracotta">Live from their shop</p>
              <h2 className="mt-1 text-3xl text-charcoal">On the menu right now</h2>
              <p className="mt-3 max-w-2xl text-ink/70">
                Read from {p.name}&apos;s own online store and refreshed through the day. Event orders are quoted by them; these are
                their everyday prices.
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {menu.map((m) => (
                  <li key={m.url}>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener"
                      className="flex h-full items-baseline justify-between gap-4 rounded-xl border border-parchment bg-cream/60 px-4 py-3 hover:border-terracotta/60"
                    >
                      <span className="font-semibold text-charcoal">{m.title}</span>
                      <span className="shrink-0 text-sm font-semibold text-terracotta">{m.price}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <a
                href={p.liveMenu.origin}
                target="_blank"
                rel="noopener"
                className="mt-6 inline-block text-sm font-semibold text-terracotta underline decoration-terracotta/40 underline-offset-2 hover:text-terracotta-dark"
              >
                Order from {p.name} on their site
              </a>
            </div>
          </section>
        )}

        {p.steps && (
          <section className="bg-parchment/40 py-14">
            <div className="mx-auto max-w-5xl px-6">
              <h2 className="text-3xl text-charcoal">How a project runs</h2>
              <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {p.steps.map((s, i) => (
                  <li key={s.title} className="rounded-2xl border border-parchment bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-terracotta">Step {i + 1}</p>
                    <h3 className="mt-1 text-lg text-charcoal">{s.title}</h3>
                    <p className="mt-2 text-sm text-ink/75">{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {p.practices && (
          <section className="bg-cream py-14">
            <div className="mx-auto max-w-5xl px-6">
              <h2 className="text-3xl text-charcoal">{p.practicesTitle ?? "Lower waste, stated plainly"}</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {p.practices.map((x) => (
                  <div key={x.title} className="flex gap-3">
                    <Dot />
                    <p className="text-ink/80">
                      <strong className="text-charcoal">{x.title}.</strong> {x.body}
                    </p>
                  </div>
                ))}
              </div>
              {p.caveat && <p className="mt-6 max-w-2xl rounded-xl bg-white p-4 text-sm text-ink/75">Straight talk: {p.caveat}</p>}
            </div>
          </section>
        )}

        {p.ask && (
          <section className="bg-white py-12">
            <div className="mx-auto max-w-5xl px-6">
              <h2 className="text-2xl text-charcoal">What to have ready when you reach out</h2>
              <ul className="mt-5 space-y-2 text-ink/80">
                {p.ask.map((q) => (
                  <li key={q} className="flex gap-3">
                    <Dot />
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="bg-parchment/40 py-12">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-2xl text-charcoal">Planning with Crossroads?</h2>
            <p className="mt-3 max-w-2xl text-ink/80">
              Mention {p.name} on your intro call and{" "}
              {p.withUs ?? "we'll put the timeline together around them, so the dessert table, the backdrop and the big moments land where they should."}
            </p>
            <a href="/book" className="mt-5 inline-block rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark">
              Check your date
            </a>
            {others.length > 0 && (
              <p className="mt-6 text-sm text-ink/70">
                Plan the rest of the day:{" "}
                {others.map((o, i) => (
                  <span key={o.slug}>
                    {i > 0 && ", "}
                    <a href={`/partners/${o.slug}`} className="font-semibold text-charcoal underline decoration-terracotta/40 underline-offset-2 hover:text-terracotta">
                      {o.name}
                    </a>
                  </span>
                ))}
                {" "}and <a href="/" className="font-semibold text-charcoal underline decoration-terracotta/40 underline-offset-2 hover:text-terracotta">our music and bar service</a>.
              </p>
            )}
            <p className="mt-8 text-xs text-ink/50">
              From {p.name}&apos;s own words ({external(p.source) ? "their website" : p.source}), checked {dateLabel(p.checked)}.
              {p.liveMenu ? " The menu is read live from their online store." : ""} Prices and availability come from them.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
