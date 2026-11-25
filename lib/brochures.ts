// The two trifold brochures (wedding, corporate) as the site shares them.
// Client-safe: the floating share pop-up and the share kit both read this.
//
// Why it exists (2026-11-03, Jacob): the printed trifolds are going out to
// downtown Columbus businesses, and the site should push the same brochures to
// be passed along: "share with a boss, share with a friend, share with a bride". Every shared link carries ?src=share-<audience>, which
// SourceCapture keeps as first touch, so a booking that came from a forwarded
// brochure is counted (SRC_TAGS "share" maps to "A friend or past couple").
//
// Prices come from lib/site.ts only; a share message must never quote a number
// the site does not.
import {
  ACOUSTIC_ADDON_USD,
  BARTENDER_ONE_USD,
  CORPORATE_DEPOSIT_USD,
  CORPORATE_DJ_SOUND_USD,
  DEPOSIT_USD,
  DJ_DAY_RATE_USD,
  SITE_URL,
} from "@/lib/site";

export type BrochureKind = "wedding" | "corporate";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

export const BROCHURES: Record<
  BrochureKind,
  {
    kind: BrochureKind;
    path: string;
    title: string;
    short: string;
    headline: string;
    priceLine: string;
    bookPath: string;
    bookLabel: string;
  }
> = {
  wedding: {
    kind: "wedding",
    path: "/brochures/wedding",
    title: "The wedding brochure",
    short: "Wedding brochure",
    headline: "Everything for the wedding, on one page.",
    priceLine: `DJ & MC ${usd(DJ_DAY_RATE_USD)} flat · live acoustic ${usd(ACOUSTIC_ADDON_USD)} · bartenders from ${usd(BARTENDER_ONE_USD)}`,
    bookPath: "/book",
    bookLabel: "Check your wedding date",
  },
  corporate: {
    kind: "corporate",
    path: "/brochures/corporate",
    title: "The corporate events brochure",
    short: "Corporate brochure",
    headline: "Everything for the company party, on one page.",
    priceLine: `DJ, sound & MC ${usd(CORPORATE_DJ_SOUND_USD)} flat · ${usd(CORPORATE_DEPOSIT_USD)} deposit holds the date`,
    bookPath: "/events",
    bookLabel: "Check your event date",
  },
};

export const BROCHURE_DEPOSITS = { wedding: usd(DEPOSIT_USD), corporate: usd(CORPORATE_DEPOSIT_USD) };

// Who the visitor is sending it to. Each audience picks the brochure that fits
// and a message written for that person. The tag rides on the link.
export type Audience = {
  id: string;
  label: string;
  kind: BrochureKind;
  message: string;
};

export const AUDIENCES: Audience[] = [
  {
    id: "bride",
    label: "A bride",
    kind: "wedding",
    message: `Found you a wedding DJ: DJ and MC for ${usd(DJ_DAY_RATE_USD)} flat, day-of coordination built in, no packages to decode. Here's their brochure:`,
  },
  {
    id: "boss",
    label: "My boss",
    kind: "corporate",
    message: `For the holiday party: DJ, sound and MC for ${usd(CORPORATE_DJ_SOUND_USD)} flat, and they confirm a date the same day. Here's their brochure:`,
  },
  {
    id: "friend",
    label: "A friend",
    kind: "wedding",
    message: `Know anyone getting married? Flat-price wedding DJs out of Columbus: ${usd(DJ_DAY_RATE_USD)} for DJ and MC. Brochure:`,
  },
  {
    id: "office",
    label: "The office party planner",
    kind: "corporate",
    message: `Planning the office party? DJ, sound and MC for ${usd(CORPORATE_DJ_SOUND_USD)} flat, set up before anyone walks in. Brochure:`,
  },
  {
    id: "couple",
    label: "The happy couple",
    kind: "wedding",
    message: `For the wedding: DJ and MC ${usd(DJ_DAY_RATE_USD)} flat, live acoustic ${usd(ACOUSTIC_ADDON_USD)}, bartenders from ${usd(BARTENDER_ONE_USD)}. Book one or stack all three. Brochure:`,
  },
  {
    id: "hr",
    label: "HR",
    kind: "corporate",
    message: `For our next company event: one flat price (${usd(CORPORATE_DJ_SOUND_USD)}) for DJ, sound and MC, and the price doesn't change after the call. Brochure:`,
  },
  {
    id: "planner",
    label: "A planner or venue",
    kind: "wedding",
    message: `A good crew for your vendor list: weddings ${usd(DJ_DAY_RATE_USD)} flat, company events ${usd(CORPORATE_DJ_SOUND_USD)} flat. Brochure:`,
  },
];

/** The link a visitor shares: the brochure page, tagged with who it went to. */
export function shareUrl(kind: BrochureKind | "all", audience: string): string {
  const path = kind === "all" ? "/brochures" : BROCHURES[kind].path;
  const tag = `share-${audience}`.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return `${SITE_URL}${path}?src=${tag}`;
}

/** The brochure's share image (app/brochures/<kind>/opengraph-image.tsx). */
export function shareImageUrl(kind: BrochureKind): string {
  return `${SITE_URL}${BROCHURES[kind].path}/opengraph-image`;
}
