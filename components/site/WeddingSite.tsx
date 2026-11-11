import type { WeddingArt } from "@/lib/wedding-art";
import { time12, type SiteFaq, type SiteLink } from "@/lib/wedding-site-constants";

// The public wedding website a couple shares with guests. Everything on it
// comes from the couple's own hub; a section with nothing in it is left out
// rather than shown empty. Times and titles only from the schedule: the MC
// notes on the same rows never reach this page.
export type WeddingSiteProps = {
  coupleNames: string;
  dateLabel: string;
  daysToGo: number | null;
  venueName: string;
  venueAddress: string | null;
  dressCode: string | null;
  story: string | null;
  schedule: { title: string; startTime: string }[];
  links: SiteLink[];
  faq: SiteFaq[];
  brandName: string;
  art: WeddingArt | null;
  sample?: boolean;
};

export default function WeddingSite(p: WeddingSiteProps) {
  const mapHref = p.venueAddress?.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.venueName}, ${p.venueAddress}`)}`
    : null;
  return (
    <div className="min-h-screen bg-cream text-ink">
      {p.sample && (
        <p className="bg-charcoal px-4 py-2 text-center text-xs font-semibold uppercase tracking-widest text-cream">
          Preview with sample details
        </p>
      )}
      <header className="relative overflow-hidden border-b border-parchment bg-white px-6 pb-14 pt-16 text-center">
        {p.art && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {/* eslint-disable @next/next/no-img-element */}
            <img src={`${p.art.dir}/${p.art.corners.leftTop}`} alt="" className="absolute left-0 top-0 hidden w-40 opacity-70 sm:block" />
            <img src={`${p.art.dir}/${p.art.corners.rightTop}`} alt="" className="absolute -right-4 -top-4 w-28 opacity-60 sm:right-0 sm:top-0 sm:w-40 sm:opacity-70" />
            {/* eslint-enable @next/next/no-img-element */}
          </div>
        )}
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.35em] text-terracotta">We&apos;re getting married</p>
          <h1 className="mx-auto mt-5 max-w-3xl break-words font-display text-5xl leading-tight text-charcoal sm:text-7xl">{p.coupleNames}</h1>
          <p className="mt-6 text-lg text-charcoal">{p.dateLabel}</p>
          <p className="mt-1 text-ink/65">{p.venueName}</p>
          {p.daysToGo !== null && p.daysToGo > 0 && (
            <p className="mt-6 inline-block rounded-full border border-parchment px-4 py-1.5 text-sm text-ink/70">
              {p.daysToGo === 1 ? "Tomorrow" : `${p.daysToGo} days to go`}
            </p>
          )}
          {p.daysToGo === 0 && <p className="mt-6 inline-block rounded-full bg-terracotta px-4 py-1.5 text-sm font-semibold text-cream">Today&apos;s the day</p>}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-14 px-6 py-14">
        {p.story?.trim() && (
          <section>
            <h2 className="text-center font-display text-3xl text-charcoal">Our story</h2>
            <p className="mt-5 whitespace-pre-line text-center leading-relaxed text-ink/80">{p.story.trim()}</p>
          </section>
        )}

        {p.schedule.length > 0 && (
          <section>
            <h2 className="text-center font-display text-3xl text-charcoal">The day</h2>
            <ol className="mt-6 divide-y divide-parchment rounded-2xl border border-parchment bg-white">
              {p.schedule.map((s, i) => (
                <li key={i} className="flex items-baseline gap-5 px-5 py-3.5">
                  <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-terracotta">{time12(s.startTime)}</span>
                  <span className="min-w-0 break-words text-charcoal">{s.title}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="text-center">
          <h2 className="font-display text-3xl text-charcoal">Where</h2>
          <p className="mt-4 text-lg text-charcoal">{p.venueName}</p>
          {p.venueAddress?.trim() && <p className="text-ink/70">{p.venueAddress.trim()}</p>}
          {mapHref && (
            <a href={mapHref} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-full border border-terracotta px-5 py-2 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream">
              Get directions
            </a>
          )}
          {p.dressCode?.trim() && (
            <p className="mt-6 text-ink/75">
              <span className="font-semibold text-charcoal">What to wear:</span> {p.dressCode.trim()}
            </p>
          )}
        </section>

        {p.links.length > 0 && (
          <section className="text-center">
            <h2 className="font-display text-3xl text-charcoal">Good to have</h2>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {p.links.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noreferrer nofollow" className="rounded-full bg-charcoal px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink">
                  {l.label || new URL(l.url).hostname.replace(/^www\./, "")}
                </a>
              ))}
            </div>
          </section>
        )}

        {p.faq.length > 0 && (
          <section>
            <h2 className="text-center font-display text-3xl text-charcoal">Questions</h2>
            <div className="mt-6 space-y-3">
              {p.faq.map((f, i) => (
                <details key={i} className="group rounded-2xl border border-parchment bg-white px-5 py-4">
                  <summary className="cursor-pointer list-none font-semibold text-charcoal">
                    <span className="mr-2 inline-block text-terracotta transition group-open:rotate-45">+</span>
                    {f.q}
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-ink/75">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-parchment px-6 py-8 text-center text-xs text-ink/45">Wedding website by {p.brandName}</footer>
    </div>
  );
}
