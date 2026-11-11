import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ReviewForm from "@/components/ReviewForm";
import EventGallery from "@/components/EventGallery";
import { getPublicEntries, type PublicEntry } from "@/lib/reviews";
import { REVIEW_EVENTS } from "@/lib/review-constants";
import { VENUE_TIME_ZONE } from "@/lib/site";

// Kind words and photos from real events (2026-11-01, Jacob). Every note was
// written and signed by the person named on it and approved by us before it
// shows. Deliberately no Review or AggregateRating JSON-LD on this page.
export const dynamic = "force-dynamic";

const TITLE = "Kind words from our couples, venues and guests";
const DESCRIPTION =
  "Notes from couples, venue staff and guests we've worked with, signed by the people who wrote them. Add yours.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/reviews" },
  openGraph: { url: "/reviews", title: TITLE, description: DESCRIPTION },
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: VENUE_TIME_ZONE,
  });
}

function Note({ entry }: { entry: PublicEntry }) {
  return (
    <figure
      className={`rounded-2xl border bg-white p-6 ${entry.featured ? "border-terracotta/50" : "border-parchment"}`}
    >
      <blockquote className="whitespace-pre-line text-ink/85">{entry.message}</blockquote>
      <figcaption className="mt-4 text-sm">
        <span className="font-semibold text-charcoal">{entry.name}</span>
        <span className="text-ink/55">
          {" "}
          · {entry.relation} · {dateLabel(entry.createdAt)}
        </span>
      </figcaption>
    </figure>
  );
}

export default async function ReviewsPage() {
  let entries: PublicEntry[] = [];
  let loadFailed = false;
  try {
    entries = await getPublicEntries();
  } catch (err) {
    console.error("[reviews] load failed:", err);
    loadFailed = true;
  }
  const featured = entries.filter((e) => e.featured);
  const rest = entries.filter((e) => !e.featured);

  return (
    <>
      <Header />
      <main>
        <section className="bg-charcoal py-16 text-cream">
          <div className="mx-auto max-w-4xl px-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">Reviews</p>
            <h1 className="max-w-2xl text-4xl leading-tight sm:text-5xl">Kind words, in their own words.</h1>
            <p className="mt-6 max-w-2xl text-lg text-cream/80">
              Notes from couples, venue staff and guests we&apos;ve worked with. Each one is signed by
              the person who wrote it. Worked with us? Add yours at the bottom of the page.
            </p>
          </div>
        </section>

        {REVIEW_EVENTS.map((ev) => (
          <section key={ev.slug} className="bg-cream py-12">
            <div className="mx-auto max-w-5xl px-6">
              <h2 className="text-2xl text-charcoal">{ev.title}</h2>
              <p className="mt-1 text-sm text-ink/60">{ev.date}</p>
              <div className="mt-6">
                <EventGallery media={ev.media} />
              </div>
              <a href={`/weddings/${ev.slug}`} className="mt-4 inline-block text-sm font-semibold text-terracotta underline decoration-terracotta/40 underline-offset-2 hover:text-terracotta-dark">
                {ev.media.length ? "See this event's page" : "Photos coming soon. See this event's page"}
              </a>
            </div>
          </section>
        ))}

        <section className="bg-parchment/40 py-16">
          <div className="mx-auto grid max-w-4xl gap-4 px-6">
            {loadFailed ? (
              <p className="rounded-2xl border border-parchment bg-white p-6 text-ink/70">
                The notes didn&apos;t load just now. Refresh in a minute; you can still add yours below.
              </p>
            ) : entries.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-parchment bg-white/60 p-6 text-ink/70">
                No notes up yet. If we&apos;ve worked your wedding or event, you could be the first.
              </p>
            ) : (
              <>
                {featured.map((e) => (
                  <Note key={e.id} entry={e} />
                ))}
                {rest.map((e) => (
                  <Note key={e.id} entry={e} />
                ))}
              </>
            )}
          </div>
        </section>

        <section id="sign" className="bg-cream py-16">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-3xl text-charcoal">Sign the board</h2>
            <p className="mb-6 mt-3 text-ink/70">
              Tell people what it was like working with us. Just your name and a few words.
            </p>
            <ReviewForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
