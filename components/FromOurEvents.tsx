import SafeImage from "@/components/SafeImage";
import { REVIEW_EVENTS, type ReviewEvent, type ReviewMedia } from "@/lib/review-constants";

// Real photos and video from our own events, newest first (2026-11-13, Jacob:
// "put forge on fourth photos and videos on the front page"). Reads
// REVIEW_EVENTS so the homepage, /reviews and each event page can never
// disagree; an item flagged `home` is shown here, and an event with no flags
// shows its first few. Renders nothing for an event with no media, never a
// grey placeholder. No quotes or ratings here: those appear only once real
// people have written them on /reviews.

function picks(e: ReviewEvent, max: number): ReviewMedia[] {
  const flagged = e.media.filter((m) => m.home);
  return (flagged.length ? flagged : e.media).slice(0, max);
}

function Tile({ m, sizes }: { m: ReviewMedia; sizes: string }) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-charcoal">
      {m.kind === "video" ? (
        <video
          src={m.src}
          poster={m.poster}
          controls
          playsInline
          preload="none"
          className="absolute inset-0 h-full w-full object-cover"
          aria-label={m.alt}
        />
      ) : (
        <SafeImage src={m.src} alt={m.alt} fill sizes={sizes} className="object-cover" />
      )}
    </div>
  );
}

export default function FromOurEvents() {
  const events = REVIEW_EVENTS.filter((e) => e.media.length > 0).sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  if (events.length === 0) return null;
  const [latest, ...earlier] = events;
  return (
    <section id="events-gallery" className="bg-cream py-16">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-terracotta">From our events</p>
        <h2 className="mt-1 text-3xl text-charcoal">Real rooms, not stock photos</h2>

        <div className="mt-8">
          <p className="text-ink/70">
            <span className="font-semibold text-charcoal">{latest.title}</span>, {latest.date}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {picks(latest, 6).map((m) => (
              <Tile key={m.src} m={m} sizes="(min-width: 640px) 33vw, 50vw" />
            ))}
          </div>
          <a
            href={`/weddings/${latest.slug}`}
            className="mt-4 inline-block text-sm font-semibold text-terracotta underline decoration-terracotta/40 underline-offset-2 hover:text-terracotta-dark"
          >
            See the whole night
          </a>
        </div>

        {earlier.map((e) => (
          <div key={e.slug} className="mt-12">
            <p className="text-ink/70">
              <span className="font-semibold text-charcoal">{e.title}</span>, {e.date}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {picks(e, 4).map((m) => (
                <Tile key={m.src} m={m} sizes="(min-width: 640px) 25vw, 50vw" />
              ))}
            </div>
            <a
              href={`/weddings/${e.slug}`}
              className="mt-4 inline-block text-sm font-semibold text-terracotta underline decoration-terracotta/40 underline-offset-2 hover:text-terracotta-dark"
            >
              See the whole night
            </a>
          </div>
        ))}

        <p className="mt-10 text-sm font-semibold">
          <a href="/reviews#sign" className="text-ink/70 underline decoration-ink/30 underline-offset-2 hover:text-charcoal">
            Worked with us? Leave a note
          </a>
        </p>
      </div>
    </section>
  );
}
