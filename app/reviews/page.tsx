import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GuestbookForm from "@/components/GuestbookForm";
import { listApprovedEntries } from "@/lib/guestbook";

// Reviews, photos and the public guestbook (2026-11-01, Jacob). The photos and
// video are from our October 17 wedding at Valle Vista, lightly graded. The
// featured slot is held for the couple's own review; it fills when the owner
// features an approved entry. Deliberately NO rating or review structured
// data: CLAUDE.md 9.1 withholds AggregateRating until there are genuine,
// on-page reviews in volume, and guestbook notes are not star ratings.
export const dynamic = "force-dynamic";

const TITLE = "Reviews, photos and our guestbook";
const DESCRIPTION =
  "Photos and video from our wedding at Valle Vista in Greenwood, notes from the people we've worked with, and a guestbook anyone can sign.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/reviews" },
  openGraph: { url: "/reviews", title: TITLE, description: DESCRIPTION, images: ["/reviews/valle-vista/vv-3.webp"] },
};

const PHOTOS: { src: string; alt: string; caption: string; tall?: boolean }[] = [
  { src: "/reviews/valle-vista/vv-3.webp", alt: "The reception room at Valle Vista set up with speakers and a DJ table before guests arrive", caption: "Set and ready before the doors open" },
  { src: "/reviews/valle-vista/vv-2.webp", alt: "Two of our crew doing final checks at the DJ table by the windows", caption: "Final checks at the booth" },
  { src: "/reviews/valle-vista/vv-5.webp", alt: "Our mixer and microphones at the DJ table while guests dance", caption: "On the board while the floor fills up", tall: true },
  { src: "/reviews/valle-vista/vv-4.webp", alt: "Jake at the DJ table with guests dancing behind him", caption: "Jake on the decks", tall: true },
  { src: "/reviews/valle-vista/vv-1.webp", alt: "Jake in the reception room during setup", caption: "Setup day", tall: true },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function ReviewsPage() {
  const entries = await listApprovedEntries();
  const featured = entries.find((e) => e.featured) ?? null;
  const rest = entries.filter((e) => !e.featured);

  return (
    <>
      <Header />
      <main>
        <section className="bg-charcoal py-20 text-cream">
          <div className="mx-auto max-w-4xl px-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">
              Valle Vista, Greenwood · October 17, 2026
            </p>
            <h1 className="max-w-2xl text-4xl leading-tight sm:text-5xl">Don&apos;t take our word for it.</h1>
            <p className="mt-6 max-w-2xl text-lg text-cream/80">
              Photos and video from a wedding we were proud of, and notes from the people who were there.
            </p>
          </div>
        </section>

        <section className="bg-cream py-16">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-3xl text-charcoal">From the couple</h2>
            {featured ? (
              <figure className="mt-6 rounded-2xl border-2 border-terracotta bg-white p-8">
                <blockquote className="whitespace-pre-wrap text-xl leading-relaxed text-charcoal">{featured.message}</blockquote>
                <figcaption className="mt-4 text-ink/70">
                  <span className="font-semibold text-charcoal">{featured.name}</span>
                  {featured.relation && <span> · {featured.relation}</span>}
                </figcaption>
              </figure>
            ) : (
              <div className="mt-6 rounded-2xl border-2 border-dashed border-parchment bg-white p-8">
                <p className="text-lg text-charcoal">Their review is on its way.</p>
                <p className="mt-2 text-ink/60">
                  We asked our October 17 couple to write a few words in the guestbook below. It will appear here once it&apos;s in.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="bg-parchment/40 py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-3xl text-charcoal">The night, in pictures</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <figure className="md:row-span-2">
                <video
                  className="w-full rounded-2xl bg-charcoal"
                  controls
                  playsInline
                  muted
                  preload="none"
                  poster="/reviews/valle-vista/vv-dance-poster.webp"
                  aria-label="Guests dancing at the reception while our mixer runs in the foreground"
                >
                  <source src="/reviews/valle-vista/vv-dance.mp4" type="video/mp4" />
                </video>
                <figcaption className="mt-2 text-sm text-ink/60">The dance floor at Valle Vista</figcaption>
              </figure>
              {PHOTOS.slice(0, 2).map((p) => (
                <figure key={p.src}>
                  <img src={p.src} alt={p.alt} loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover" />
                  <figcaption className="mt-2 text-sm text-ink/60">{p.caption}</figcaption>
                </figure>
              ))}
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {PHOTOS.slice(2).map((p) => (
                <figure key={p.src}>
                  <img src={p.src} alt={p.alt} loading="lazy" className="aspect-[3/4] w-full rounded-2xl object-cover" />
                  <figcaption className="mt-2 text-sm text-ink/60">{p.caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-cream py-16">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-3xl text-charcoal">Guestbook</h2>
            <p className="mt-2 text-ink/70">Were you there, or have we worked together? Leave a note.</p>
            <div className="mt-6">
              <GuestbookForm />
            </div>
            {rest.length > 0 && (
              <ul className="mt-10 space-y-4">
                {rest.map((e) => (
                  <li key={e.id} className="rounded-2xl border border-parchment bg-white p-6">
                    <p className="whitespace-pre-wrap text-ink/80">{e.message}</p>
                    <p className="mt-3 text-sm text-ink/60">
                      <span className="font-semibold text-charcoal">{e.name}</span>
                      {e.relation && <span> · {e.relation}</span>}
                      <span> · {formatDate(e.createdAt)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
