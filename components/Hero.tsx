export default function Hero() {
  return (
    <section id="top" className="border-b border-parchment bg-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-sage-dark">
            Backyard weddings &middot; DIY venues &middot; Ballrooms
          </p>
          <h1 className="text-4xl leading-tight text-charcoal sm:text-5xl">
            The DJ &amp; music crew that also quietly runs your day.
          </h1>
          <p className="mt-6 text-lg text-ink/80">
            Give us the names, the schedule, and the vibe. We handle the
            microphone, the playlist, the timeline, and the awkward silences —
            so you can actually be at your own wedding.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="#contact"
              className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
            >
              Get a quote by email
            </a>
            <a
              href="#pricing"
              className="rounded-full border border-charcoal/20 px-6 py-3 text-sm font-semibold text-charcoal hover:border-charcoal/40"
            >
              See pricing
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-parchment bg-parchment/60 p-8">
          <h2 className="text-xl text-charcoal">What a Saturday looks like</h2>
          <ul className="mt-4 space-y-3 text-ink/80">
            <li>&bull; DJ &amp; sound for ceremony, cocktail hour, and reception</li>
            <li>&bull; A live acoustic set woven in, if you want one</li>
            <li>&bull; A licensed bartender pouring, if you need one</li>
            <li>&bull; One point of contact running the timeline, day-of</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
