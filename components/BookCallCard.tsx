import { BOOKING_URL, INTRO_CALL_LENGTH } from "@/lib/site";

// Renders nothing until a booking page is configured, so an unset
// NEXT_PUBLIC_BOOKING_URL can never ship a dead "Book now" button.
export default function BookCallCard() {
  if (!BOOKING_URL) return null;

  return (
    <div className="mb-6 rounded-2xl border border-cream/20 bg-cream/5 p-6 text-left sm:flex sm:items-center sm:justify-between sm:gap-6">
      <div>
        <p className="text-lg text-cream">Rather just talk it through?</p>
        <p className="mt-1 text-sm text-cream/70">
          Grab a {INTRO_CALL_LENGTH} call. We&apos;ll walk through your date,
          your venue, and what you actually need on the day.
        </p>
      </div>
      <a
        href={BOOKING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block shrink-0 rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark sm:mt-0"
      >
        Book a call
      </a>
    </div>
  );
}
