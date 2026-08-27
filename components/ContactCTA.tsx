import BookCallCard from "@/components/BookCallCard";
import { CONTACT_EMAIL } from "@/lib/site";

export default function ContactCTA() {
  return (
    <section id="contact" className="bg-charcoal py-24 text-cream">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl">Tell us your date</h2>
        <p className="mt-3 text-cream/70">
          Two minutes, no account: your date, your venue (or backyard address),
          and what you're picturing. We answer fast, and your planning hub is
          ready the moment you hit send.
        </p>
        <div className="mt-10">
          <BookCallCard />
          <a
            href="/book"
            className="block w-full rounded-2xl bg-terracotta px-8 py-7 text-2xl font-bold uppercase tracking-widest text-cream shadow-lg transition hover:bg-terracotta-dark sm:text-3xl"
          >
            Check your date now
          </a>
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
