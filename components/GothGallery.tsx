import type { ReviewMedia } from "@/lib/review-constants";

// Kat and Tanis' page (2026-11-11): their own theme, worn by the page. Each
// photo is a tarot card, after the tarot cards that named their tables, taped
// up at a slight tilt like a bedroom wall of prints. Pure CSS, no new fonts or
// scripts. Tilt and tape vary by position, never by chance, so the server and
// browser always agree.
const TILTS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "rotate-0", "-rotate-2", "rotate-1"];
const NUMERALS = ["XVII", "VI", "II", "X", "X", "XIX", "XXI"];

export default function GothGallery({ media }: { media: ReviewMedia[] }) {
  const cards = media.filter((m) => m.kind === "image");
  if (cards.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-8 gap-y-12">
      {cards.map((m, i) => (
        <figure
          key={m.src}
          className={`group relative w-full max-w-sm sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.4rem)] ${TILTS[i % TILTS.length]} transition duration-300 hover:rotate-0 hover:scale-[1.02]`}
        >
          {/* tape */}
          <span
            aria-hidden
            className="absolute -top-3 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rotate-[-4deg] bg-violet-200/25 shadow-sm backdrop-blur-[1px]"
          />
          <div className="rounded-[18px] border border-violet-300/40 bg-[#120d18] p-2.5 shadow-[0_0_30px_-6px_rgba(167,139,250,0.55)] transition group-hover:shadow-[0_0_44px_-4px_rgba(167,139,250,0.85)]">
            <div className="rounded-[12px] border border-violet-300/25 p-2">
              <p className="pb-2 text-center font-display text-[0.7rem] tracking-[0.4em] text-violet-200/70">
                {NUMERALS[i % NUMERALS.length]}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.src}
                alt={m.alt}
                width={m.width}
                height={m.height}
                loading={i < 3 ? "eager" : "lazy"}
                className="aspect-[3/4] w-full rounded-md object-cover [filter:saturate(0.92)_contrast(1.05)]"
              />
              {m.label && (
                <figcaption className="pt-3 text-center font-display text-lg uppercase tracking-[0.25em] text-violet-100">
                  {m.label}
                </figcaption>
              )}
            </div>
          </div>
        </figure>
      ))}
    </div>
  );
}
