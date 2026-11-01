import { CORPORATE_DJ_SOUND_USD } from "@/lib/site";

// Front-page strip pushing corporate holiday parties (owner directive
// 2026-11-01: holiday parties book late and carry real budgets). It says only
// what is true: the price and that December dates are open. No invented
// scarcity ("only 2 left"). Remove or reword after the season.
export default function HolidayBanner() {
  return (
    <a
      href="/events"
      className="block bg-terracotta px-6 py-3 text-center text-sm font-semibold text-cream hover:bg-terracotta-dark"
    >
      Booking company holiday parties now: DJ, sound and MC, ${CORPORATE_DJ_SOUND_USD.toLocaleString("en-US")} flat. December
      dates are still open. <span className="underline underline-offset-2">Plan yours</span>
    </a>
  );
}
