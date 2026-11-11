import type { ReviewMedia } from "@/lib/review-constants";

// Photos and clips from one real event. Columns, not a grid: the photos mix
// portrait and landscape, and a grid would crop or leave holes. Renders
// nothing for an event with no media yet, never a grey placeholder.
export default function EventGallery({ media }: { media: ReviewMedia[] }) {
  if (media.length === 0) return null;
  return (
    <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
      {media.map((m) => (
        <div key={m.src} className="mb-3 break-inside-avoid">
          {m.kind === "video" ? (
            <video
              src={m.src}
              poster={m.poster}
              controls
              playsInline
              preload="none"
              width={m.width}
              height={m.height}
              className="h-auto w-full rounded-xl bg-charcoal"
              aria-label={m.alt}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.src} alt={m.alt} width={m.width} height={m.height} loading="lazy" className="h-auto w-full rounded-xl" />
          )}
        </div>
      ))}
    </div>
  );
}
