// Where a couple found us. Client-safe (no server imports): the booking form,
// the booking API and the owner dashboard all read this one list, so a channel
// cannot be spelled one way on the form and another way in the tally.
//
// Why it exists (2026-11-01, Jacob): WeddingPro (The Knot / WeddingWire) is the
// only thing bringing in leads and it is going away. Every replacement channel
// (Zola, Roku and Hulu ads, business cards, the trifold, Google, venues) costs
// money or time, and the only way to know which ones to keep paying for is to
// record, on every booking, where that couple came from. Two signals, kept
// separate on purpose:
//   - lead_source: what the couple TOLD us ("How did you find us?").
//   - lead_src_tag: what the LINK told us (?src= on a QR code, a TV vanity URL,
//     a Zola profile link). Self-report is unreliable; a tagged link is not, but
//     only covers the doors we tagged. Together they answer the question.

export const LEAD_SOURCES = [
  { value: "zola", label: "Zola" },
  { value: "the_knot", label: "The Knot" },
  { value: "weddingwire", label: "WeddingWire" },
  { value: "google", label: "Google search" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tv", label: "Saw an ad on TV (Roku, Hulu)" },
  { value: "card_or_brochure", label: "Business card or brochure" },
  { value: "friend", label: "A friend or past couple" },
  { value: "venue", label: "Our venue recommended you" },
  { value: "vendor", label: "Another wedding vendor" },
  { value: "other", label: "Somewhere else" },
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number]["value"];

export const LEAD_SOURCE_VALUES = LEAD_SOURCES.map((s) => s.value) as [LeadSource, ...LeadSource[]];

export function leadSourceLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return LEAD_SOURCES.find((s) => s.value === value)?.label ?? value;
}

// Sources where the follow-up question ("who?") is the valuable part: the
// friend's name is how the referral credit gets paid, the venue's name is who
// to thank and keep feeding.
export const DETAIL_PROMPT: Partial<Record<LeadSource, string>> = {
  friend: "Who sent you? (So we can thank them)",
  venue: "Which venue?",
  vendor: "Which vendor?",
  other: "Where?",
};

// ?src= tags. Short and lowercase so they survive being typed off a TV screen
// or printed under a QR code. A tag maps to the dropdown option it implies, so
// a couple who scanned a card does not have to tell us they scanned a card.
// ADD, NEVER RENAME: tags end up on printed paper and in running ad campaigns.
export const SRC_TAGS: Record<string, LeadSource> = {
  zola: "zola",
  knot: "the_knot",
  ww: "weddingwire",
  google: "google",
  gbp: "google",
  ig: "instagram",
  fb: "facebook",
  tv: "tv",
  roku: "tv",
  hulu: "tv",
  card: "card_or_brochure",
  brochure: "card_or_brochure",
  flyer: "card_or_brochure",
  expo: "card_or_brochure",
  venue: "venue",
  ref: "friend",
};

/** Accepts a raw ?src= value; returns a safe tag or null. */
export function cleanSrcTag(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const tag = raw.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,39}$/.test(tag) ? tag : null;
}

/** The dropdown option a tag implies; tags like "roku-nov" match on the prefix. */
export function sourceForTag(tag: string | null): LeadSource | null {
  if (!tag) return null;
  if (SRC_TAGS[tag]) return SRC_TAGS[tag];
  const prefix = tag.split(/[-_]/)[0];
  return SRC_TAGS[prefix] ?? null;
}

// First-touch storage key. First touch, not last: the couple who saw the Hulu
// ad, Googled us a week later and booked should still be counted for the ad,
// because the ad is the spend we are trying to judge. 120 days covers the
// usual shop-around window.
export const SRC_STORAGE_KEY = "cw_src";
export const SRC_TTL_MS = 120 * 24 * 60 * 60 * 1000;
