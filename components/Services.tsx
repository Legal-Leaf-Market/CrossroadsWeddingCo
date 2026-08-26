import SafeImage from "@/components/SafeImage";
import { IMAGES } from "@/lib/images";
import { ACOUSTIC_ADDON_USD, BARTENDER_MIN_USD } from "@/lib/site";

const SERVICES = [
  {
    title: "Wedding DJ",
    image: IMAGES.stringLights,
    alt: "String lights glowing over an evening wedding reception",
    body: "Ceremony sound, cocktail hour, reception, and every transition between them. We MC as much or as little as you want — some couples want a bold host, others want us invisible until it matters.",
  },
  {
    title: "Live Acoustic Sets",
    image: IMAGES.liveMusic,
    alt: "Close-up of hands playing an acoustic guitar",
    body: "Several of our DJs are also working musicians. Add a live acoustic set for your ceremony or cocktail hour — the same person can carry the whole day from guitar to turntable. Flat $" +
      ACOUSTIC_ADDON_USD +
      ".",
  },
  {
    title: "Bar Service",
    image: IMAGES.bar,
    alt: "Bartender pouring a cocktail at an outdoor event",
    body: "Licensed, experienced bartenders for backyard and DIY-venue weddings where the venue doesn't provide one. Bring your own bar; we'll staff and run it. From $" +
      BARTENDER_MIN_USD +
      ", fully quoted at intake.",
  },
  {
    title: "Day-Of Coordination",
    image: IMAGES.dayOf,
    alt: "Long outdoor reception table set for a wedding dinner",
    body: "Send us the names, the schedule, and the run of show. On the day, we're the ones calling cues, cuing the wedding party, and keeping everything moving — the unofficial coordinator role, built in.",
  },
];

export default function Services() {
  return (
    <section id="services" className="bg-parchment/40 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-3xl text-charcoal">What we do</h2>
        <p className="mt-3 max-w-2xl text-ink/70">
          One crew, four things we're actually good at. Book one or stack all
          four — most backyard weddings end up wanting at least two.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {SERVICES.map((service) => (
            <div
              key={service.title}
              className="overflow-hidden rounded-2xl border border-parchment bg-cream"
            >
              <div className="relative h-48 w-full">
                <SafeImage
                  src={service.image}
                  alt={service.alt}
                  fill
                  sizes="(min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl text-charcoal">{service.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/70">
                  {service.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
