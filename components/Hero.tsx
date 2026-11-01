import SafeImage from "@/components/SafeImage";
import { IMAGES } from "@/lib/images";
import { CORPORATE_DEPOSIT_USD, CORPORATE_DJ_SOUND_USD, DEPOSIT_USD, DJ_DAY_RATE_USD } from "@/lib/site";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

export default function Hero() {
  return (
    <section id="top" className="relative bg-charcoal">
      <div className="relative flex min-h-[max(480px,70vh)] w-full items-center overflow-hidden">
        <SafeImage
          src={IMAGES.gardenArch}
          alt="Floral arch at an outdoor event"
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
            Crossroads Wedding and Event Co. &middot; Corporate events &middot; Holiday parties &middot; Weddings
          </p>
          <h1 className="max-w-2xl text-4xl leading-tight text-cream sm:text-5xl md:text-6xl">
            Your company party or your wedding, run like clockwork.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-cream/80">
            DJ, sound and an MC who keeps the night on schedule, for holiday
            parties, award dinners and client nights as well as weddings. Flat
            prices, published up front: {usd(CORPORATE_DJ_SOUND_USD)} for a corporate event,{" "}
            {usd(DJ_DAY_RATE_USD)} for a wedding.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="/events"
              className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
            >
              Book your holiday party
            </a>
            <a
              href="/book"
              className="rounded-full border border-cream/40 px-6 py-3 text-sm font-semibold text-cream hover:border-cream/70"
            >
              Check your wedding date
            </a>
          </div>
        </div>
      </div>

      <div className="relative mx-auto -mt-16 grid max-w-5xl gap-6 px-6 md:grid-cols-2">
        <div className="rounded-2xl border-2 border-terracotta bg-cream p-8 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-terracotta">Now booking December</p>
          <h2 className="mt-1 text-xl text-charcoal">Corporate events and holiday parties</h2>
          <ul className="mt-4 space-y-2 text-ink/80">
            <li>&bull; DJ and sound sized for your room</li>
            <li>&bull; A mic for welcomes, speeches, awards and raffles</li>
            <li>&bull; An MC who keeps the agenda moving</li>
            <li>&bull; Live acoustic and bar staff available</li>
          </ul>
          <p className="mt-4 text-charcoal">
            <strong>{usd(CORPORATE_DJ_SOUND_USD)} flat</strong>
            <span className="text-ink/70"> &middot; {usd(CORPORATE_DEPOSIT_USD)} deposit locks the date</span>
          </p>
          <a
            href="/events"
            className="mt-5 inline-block rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
          >
            Plan your event
          </a>
        </div>
        <div className="rounded-2xl border border-parchment bg-cream p-8 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink/60">Weddings</p>
          <h2 className="mt-1 text-xl text-charcoal">What a Saturday looks like</h2>
          <ul className="mt-4 space-y-2 text-ink/80">
            <li>&bull; DJ &amp; sound for ceremony, cocktail hour, and reception</li>
            <li>&bull; A live acoustic set woven in, if you want one</li>
            <li>&bull; A licensed bartender pouring, if you need one</li>
            <li>&bull; One point of contact running the timeline, day-of</li>
          </ul>
          <p className="mt-4 text-charcoal">
            <strong>{usd(DJ_DAY_RATE_USD)} flat</strong>
            <span className="text-ink/70"> &middot; {usd(DEPOSIT_USD)} deposit locks the date</span>
          </p>
          <a
            href="/book"
            className="mt-5 inline-block rounded-full border border-charcoal/30 px-6 py-3 text-sm font-semibold text-charcoal hover:border-charcoal/60"
          >
            Check your date
          </a>
        </div>
      </div>
      <div className="h-20 bg-cream" />
    </section>
  );
}
