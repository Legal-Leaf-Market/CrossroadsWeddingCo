import SafeImage from "@/components/SafeImage";
import { IMAGES } from "@/lib/images";

const CONTACT_EMAIL = "hello@crossroadsweddingco.com";

export default function ContactCTA() {
  return (
    <section id="contact" className="relative overflow-hidden bg-charcoal py-24 text-cream">
      <SafeImage
        src={IMAGES.contact}
        alt="String lights glowing at dusk"
        fill
        sizes="100vw"
        className="object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/85 to-charcoal/70" />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl">Tell us your date</h2>
        <p className="mt-3 text-cream/70">
          Email is the fastest way to reach us — send your date, venue (or
          backyard address), and what you're picturing for music, bar, and
          day-of help.
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=Wedding date inquiry`}
          className="mt-8 inline-block rounded-full bg-terracotta px-8 py-4 text-base font-semibold text-cream hover:bg-terracotta-dark"
        >
          {CONTACT_EMAIL}
        </a>
      </div>
    </section>
  );
}
