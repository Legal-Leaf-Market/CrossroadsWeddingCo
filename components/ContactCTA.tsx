import SafeImage from "@/components/SafeImage";
import LeadForm from "@/components/LeadForm";
import BookCallCard from "@/components/BookCallCard";
import { IMAGES } from "@/lib/images";
import { CONTACT_EMAIL } from "@/lib/site";

export default function ContactCTA() {
  return (
    <section id="contact" className="relative overflow-hidden bg-charcoal py-24 text-cream">
      <SafeImage
        src={IMAGES.stringLights}
        alt="String lights glowing at dusk"
        fill
        sizes="100vw"
        className="object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/85 to-charcoal/70" />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl">Tell us your date</h2>
        <p className="mt-3 text-cream/70">
          Send your date, venue (or backyard address), and what you're
          picturing for music, bar, and day-of help — or just email us
          directly.
        </p>
        <div className="mt-10">
          <BookCallCard />
          <LeadForm />
        </div>
        <p className="mt-6 text-sm text-cream/50">
          Prefer email?{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Wedding date inquiry`}
            className="underline hover:text-cream/80"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </section>
  );
}
