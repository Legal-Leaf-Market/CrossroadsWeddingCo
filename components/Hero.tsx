import SafeImage from "@/components/SafeImage";
import { IMAGES } from "@/lib/images";

export default function Hero() {
  return (
    <section id="top" className="relative bg-charcoal">
      <div className="relative flex min-h-[max(480px,70vh)] w-full items-center overflow-hidden">
        <SafeImage
          src={IMAGES.gardenArch}
          alt="Floral arch at an outdoor wedding ceremony"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* This photo is bright, so cream text needs a heavier scrim than a dusk shot did.
            On md+ the headline is left-aligned, so weight it sideways and let the right
            of the photo read clearly; on mobile the text spans the width, so it stays vertical. */}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/70 to-charcoal/45 md:bg-gradient-to-r md:from-charcoal/95 md:via-charcoal/70 md:to-charcoal/25" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pt-20 pb-32">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">
            Backyard weddings &middot; DIY venues &middot; Ballrooms
          </p>
          <h1 className="max-w-2xl text-4xl leading-tight text-cream sm:text-5xl md:text-6xl">
            The DJ &amp; music crew that also quietly runs your day.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-cream/80">
            Give us the names, the schedule, and the vibe. We handle the
            microphone, the playlist, the timeline, and the awkward silences
            so you can actually be at your own wedding.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="/book"
              className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
            >
              Check your date
            </a>
            <a
              href="#pricing"
              className="rounded-full border border-cream/40 px-6 py-3 text-sm font-semibold text-cream hover:border-cream/70"
            >
              See pricing
            </a>
          </div>
        </div>
      </div>

      <div className="relative mx-auto -mt-16 max-w-4xl px-6">
        <div className="rounded-2xl border border-parchment bg-cream p-8 shadow-xl">
          <h2 className="text-xl text-charcoal">What a Saturday looks like</h2>
          <ul className="mt-4 grid gap-3 text-ink/80 sm:grid-cols-2">
            <li>&bull; DJ &amp; sound for ceremony, cocktail hour, and reception</li>
            <li>&bull; A live acoustic set woven in, if you want one</li>
            <li>&bull; A licensed bartender pouring, if you need one</li>
            <li>&bull; One point of contact running the timeline, day-of</li>
          </ul>
        </div>
      </div>
      <div className="h-20 bg-cream" />
    </section>
  );
}
