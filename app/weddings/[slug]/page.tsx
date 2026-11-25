import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventGallery from "@/components/EventGallery";
import GothGallery from "@/components/GothGallery";
import ReviewForm from "@/components/ReviewForm";
import { findReviewEvent } from "@/lib/review-constants";
import { getEventEntries, type PublicEntry } from "@/lib/reviews";
import { VENUE_TIME_ZONE } from "@/lib/site";

// One page per real event (2026-11-11, Jacob): the photos from the night and
// the notes written about it. Titled by venue and date, like the /reviews
// gallery; a couple's names appear only where they signed a note themselves.
// No Review or AggregateRating JSON-LD (CLAUDE.md §9.1).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const ev = findReviewEvent((await params).slug);
  if (!ev) return { title: "Not found" };
  const title = `${ev.title}, ${ev.date}`;
  const description = `Photos and notes from our event at ${ev.title} on ${ev.date}.`;
  return {
    title,
    description,
    alternates: { canonical: `/weddings/${ev.slug}` },
    openGraph: { url: `/weddings/${ev.slug}`, title, description },
  };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const ev = findReviewEvent((await params).slug);
  if (!ev) notFound();
  let entries: PublicEntry[] = [];
  let loadFailed = false;
  try {
    entries = await getEventEntries(ev.slug, ev.eventDate);
  } catch (err) {
    console.error("[weddings] notes failed:", err);
    loadFailed = true;
  }
  const goth = ev.theme === "goth";
  return (
    <>
      <Header />
      <main className={goth ? "bg-[#0b0810] text-violet-50" : undefined}>
        {goth && (
          <section className="relative overflow-hidden px-6 py-20 text-center">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.35),transparent_60%)]" />
            <div className="relative mx-auto max-w-3xl">
              <p className="text-xs uppercase tracking-[0.5em] text-violet-300/80">From our events</p>
              {ev.tagline && (
                <p className="mt-8 font-display text-5xl italic leading-tight text-violet-100 [text-shadow:0_0_18px_rgba(167,139,250,0.75)] sm:text-7xl">
                  {ev.tagline}
                </p>
              )}
              <svg aria-hidden viewBox="0 0 120 104" className="mx-auto mt-8 h-16 w-16 text-violet-300/80 [filter:drop-shadow(0_0_8px_rgba(167,139,250,0.8))]">
                <path d="M60 98 C 18 70, 4 44, 16 24 C 28 4, 52 8, 60 28 C 68 8, 92 4, 104 24 C 116 44, 102 70, 60 98 Z" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="7 5" />
              </svg>
              <h1 className="mt-8 text-2xl uppercase tracking-[0.3em] text-violet-100 sm:text-3xl">{ev.title}</h1>
              <p className="mt-3 tracking-[0.35em] text-violet-300/80">{ev.date.toUpperCase()}</p>
            </div>
          </section>
        )}
        {!goth && (
        <section className="bg-charcoal py-16 text-cream">
          <div className="mx-auto max-w-4xl px-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">From our events</p>
            <h1 className="max-w-3xl text-4xl leading-tight sm:text-5xl">{ev.title}</h1>
            <p className="mt-4 text-lg text-cream/80">{ev.date}</p>
          </div>
        </section>
        )}

        <section className={goth ? "px-6 pb-20 pt-6" : "bg-cream py-12"}>
          <div className="mx-auto max-w-5xl px-6">
            {goth && ev.media.length > 0 ? (
              <GothGallery media={ev.media} />
            ) : ev.media.length > 0 ? (
              <EventGallery media={ev.media} />
            ) : (
              <p className="text-ink/70">Photos from this night are on their way.</p>
            )}
          </div>
        </section>

        <section className={goth ? "border-t border-violet-400/20 py-16" : "bg-parchment/40 py-16"}>
          <div className="mx-auto max-w-4xl px-6">
            <h2 className={goth ? "text-center text-2xl uppercase tracking-[0.3em] text-violet-100" : "text-2xl text-charcoal"}>What people said</h2>
            <div className="mt-6 grid gap-4">
              {loadFailed ? (
                <p className="rounded-2xl border border-parchment bg-white p-6 text-ink/70">
                  The notes didn&apos;t load just now. Refresh in a minute.
                </p>
              ) : entries.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-parchment bg-white/60 p-6 text-ink/70">
                  No notes on this one yet. Were you there? Add yours below.
                </p>
              ) : (
                entries.map((e) => (
                  <figure key={e.id} className={`rounded-2xl border bg-white p-6 ${e.featured ? "border-terracotta/50" : "border-parchment"}`}>
                    <blockquote className="whitespace-pre-line text-ink/85">{e.message}</blockquote>
                    <figcaption className="mt-4 text-sm">
                      <span className="font-semibold text-charcoal">{e.name}</span>
                      <span className="text-ink/55">
                        {" "}
                        · {e.relation} ·{" "}
                        {new Date(e.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: VENUE_TIME_ZONE })}
                      </span>
                    </figcaption>
                  </figure>
                ))
              )}
            </div>
          </div>
        </section>

        <section id="sign" className={goth ? "border-t border-violet-400/20 py-16" : "bg-cream py-16"}>
          <div className="mx-auto max-w-2xl px-6">
            <h2 className={goth ? "text-2xl uppercase tracking-[0.3em] text-violet-100" : "text-2xl text-charcoal"}>Were you there?</h2>
            <p className={goth ? "mt-2 text-violet-200/80" : "mt-2 text-ink/70"}>Guests, venue staff and vendors: tell us how it went. We read every note before it goes up.</p>
            <div className="mt-6">
              <ReviewForm eventSlug={ev.slug} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
