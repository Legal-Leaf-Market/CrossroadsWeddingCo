import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { REVIEW_EVENTS } from "@/lib/review-constants";

// Past events (2026-11-18, Jacob). One card per real event in REVIEW_EVENTS,
// newest first, each opening its own /weddings/<slug> page. Reads the same
// list as /reviews and the homepage gallery so the three can never disagree.
// An event with no photos yet shows as a text card, never a grey placeholder.
const TITLE = "Past events";
const DESCRIPTION = "Weddings and events we've played, with real photos from the night and notes from the people who were there.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/past-events" },
  openGraph: { url: "/past-events", title: TITLE, description: DESCRIPTION },
};

export default function PastEventsPage() {
  const events = [...REVIEW_EVENTS].sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  return (
    <>
      <Header />
      <main>
        <section className="bg-charcoal py-16 text-cream">
          <div className="mx-auto max-w-4xl px-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">Our work</p>
            <h1 className="max-w-2xl text-4xl leading-tight sm:text-5xl">Past events.</h1>
            <p className="mt-6 max-w-2xl text-lg text-cream/80">
              Real rooms, not stock photos. Open one to see the night and read what the people who were there wrote.
            </p>
          </div>
        </section>
        <section className="bg-cream py-14">
          <div className="mx-auto grid max-w-5xl gap-6 px-6 sm:grid-cols-2">
            {events.map((ev) => {
              const img = ev.media.find((m) => m.kind === "image" && m.src === ev.cover) ?? ev.media.find((m) => m.kind === "image");
              const poster = !img ? ev.media.find((m) => m.kind === "video" && m.poster) : undefined;
              const cover = img ? { src: img.src, alt: img.alt } : poster ? { src: poster.poster!, alt: poster.alt } : null;
              return (
                <a
                  key={ev.slug}
                  href={`/weddings/${ev.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-parchment bg-white transition hover:border-terracotta/60"
                >
                  {cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.src} alt={cover.alt} loading="lazy" className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]" />
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-terracotta">{ev.date}</p>
                    <h2 className="mt-1 text-xl text-charcoal group-hover:text-terracotta">{ev.title}</h2>
                    {ev.tagline && <p className="mt-2 italic text-ink/70">&ldquo;{ev.tagline}&rdquo;</p>}
                    <span className="mt-4 text-sm font-semibold text-terracotta underline decoration-terracotta/40 underline-offset-2">
                      See the night
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
          <div className="mx-auto mt-10 flex max-w-5xl flex-wrap gap-x-6 gap-y-2 px-6 text-sm font-semibold">
            <a href="/reviews" className="text-terracotta underline decoration-terracotta/40 underline-offset-2 hover:text-terracotta-dark">
              Read every review
            </a>
            <a href="/book" className="text-ink/70 underline decoration-ink/30 underline-offset-2 hover:text-charcoal">
              Check your date
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
