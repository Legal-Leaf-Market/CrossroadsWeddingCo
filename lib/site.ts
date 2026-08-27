// Single source of truth for the canonical URL and the business facts that
// show up in metadata, structured data, and the contact section.

const FALLBACK_SITE_URL = "https://crossroadsweddingco.com";

// Override in an environment that isn't the production domain (a staging
// alias, a fork) so canonicals and sitemap entries point at the right host.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/+$/, "");

export const SITE_NAME = "Crossroads Wedding Co.";

export const SITE_TAGLINE = "Wedding DJ, Live Music & Bar Service";

export const SITE_DESCRIPTION =
  "Backyard-to-ballroom wedding DJ services starting at $1,000, plus live acoustic sets and licensed bartenders. We run your day so you don't have to.";

export const CONTACT_EMAIL = "hello@crossroadsweddingco.com";

// Transactional email identity (owner-confirmed 2026-08-26): send as Jake, so
// replies land where they get read. Overridable with RESEND_FROM in Vercel.
export const EMAIL_FROM_ADDRESS = "jake@crossroadsweddingco.com";

export const DJ_DAY_RATE_USD = 1000;

// $500 locks the date; the balance is collected closer to the event.
export const DEPOSIT_USD = 500;

// Add-on pricing (owner-confirmed 2026-08-27): acoustic is flat, bartending is
// a floor with the real quote settled on the intro call.
export const ACOUSTIC_ADDON_USD = 400;
export const BARTENDER_MIN_USD = 400;

// Venues past ~60 minutes of Columbus carry a travel surcharge, quoted up
// front and paid directly to the talent driving (docs/MASTER_SPEC_AND_STRATEGY.md §1.1).
export const TRAVEL_SURCHARGE_RANGE = "$100–$150";

export const HOME_BASE = "Columbus, Indiana";

// Every venue we serve runs on Indiana Eastern time; schedules are venue wall
// clock, so live drift math pins to this zone on server and client alike.
export const VENUE_TIME_ZONE = "America/Indiana/Indianapolis";
export const SERVICE_RADIUS_BLURB =
  "Based in Columbus, Indiana, serving couples within about two hours: Indianapolis, Bloomington, Nashville, Louisville, and Cincinnati.";

export const INTRO_CALL_LENGTH = "30-minute";

// Booking page for the intro call. Set NEXT_PUBLIC_BOOKING_URL in Vercel to
// the share link from a Google Calendar appointment schedule (free tier: one
// booking page, which is all this needs) or any other scheduler. While it's
// empty the booking card simply doesn't render, leaving the form and the
// mailto link as the only ways in.
export const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL ?? "";

// Mirrors the four cards in <Services />; used for schema.org makesOffer.
export const SERVICE_OFFERS = [
  {
    name: "Wedding DJ",
    description:
      "Ceremony sound, cocktail hour, and reception, with MC duties dialed up or down to taste.",
    priceUsd: DJ_DAY_RATE_USD,
  },
  {
    name: "Live Acoustic Sets",
    description:
      "A live acoustic set for the ceremony or cocktail hour, played by the same person running the decks. Flat $400.",
    priceUsd: ACOUSTIC_ADDON_USD,
  },
  {
    name: "Bar Service",
    description:
      "Licensed, experienced bartenders for backyard and DIY-venue weddings without in-house bar staff. From $400, fully quoted at intake.",
    priceUsd: null,
    minPriceUsd: BARTENDER_MIN_USD,
  },
  {
    name: "Day-Of Coordination",
    description:
      "Calling cues, cueing the wedding party, and keeping the run of show moving on the day itself.",
    priceUsd: null,
  },
] as const satisfies ReadonlyArray<{
  name: string;
  description: string;
  priceUsd: number | null;
  minPriceUsd?: number;
}>;
