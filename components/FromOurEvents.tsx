import SafeImage from "@/components/SafeImage";
import { REVIEW_EVENTS } from "@/lib/review-constants";

// Real photos from our own events, standing in for the stock gallery until the
// next set arrives. Reads REVIEW_EVENTS so the homepage and /reviews can never
// disagree, and shows stills only (the clip lives on /reviews). Renders nothing
// if there are no photos, never a grey placeholder. No quotes or ratings here:
// those appear only once real people have written them on /reviews.
export default function FromOurEvents() {
  const event = REVIEW_EVENTS[0];
  const photos = event?.media.filter((m) => m.kind === "image").slice(0, 3) ?? [];
  if (!event || photos.length === 0) return null;
  return (
    <section id="events-gallery" className="bg-cream py-16">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-terracotta">From our events</p>
        <h2 className="mt-1 text-3xl text-charcoal">Real rooms, not stock photos</h2>
        <p className="mt-3 max-w-2xl text-ink/70">
          {event.title}, {event.date}. More photos are on the way.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {photos.map((m) => (
            <div key={m.src} className="relative h-64 overflow-hidden rounded-2xl sm:h-72">
              <SafeImage src={m.src} alt={m.alt} fill sizes="(min-width: 640px) 33vw, 100vw" className="object-cover" />
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          <a href="/reviews" className="text-terracotta underline decoration-terracotta/40 underline-offset-2 hover:text-terracotta-dark">
            See the night and read the notes
          </a>
          <a href="/reviews#sign" className="text-ink/70 underline decoration-ink/30 underline-offset-2 hover:text-charcoal">
            Worked with us? Leave a note
          </a>
        </div>
      </div>
    </section>
  );
}
