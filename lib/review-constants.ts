// Client-safe pieces of the /reviews board. lib/reviews.ts is server-only
// (Drizzle, pg); a client component importing it breaks the build.

export const RELATIONS = [
  "Our wedding",
  "Our event",
  "Venue or vendor",
  "Guest",
  "Other",
] as const;

// Tribute pages (2026-11-13, Jacob: Back YOUR Blue). A tribute has its own
// notes board: same moderated guestbook rows, tagged with the tribute's slug,
// shown only on that page and never on /reviews (they are about a person, not
// about our events). Add, never rename: the link is shared with family.
export const TRIBUTE_SLUGS = ["back-your-blue"] as const;
export const isTributeSlug = (s: string | null | undefined): s is (typeof TRIBUTE_SLUGS)[number] =>
  !!s && (TRIBUTE_SLUGS as readonly string[]).includes(s);
export const TRIBUTE_RELATIONS = [
  "Family",
  "Friend",
  "Coworker",
  "Church family",
  "Fellow veteran",
  "Neighbor",
  "Other",
] as const;

export type ReviewMedia = {
  /** Path under public/, e.g. "/reviews/valle-vista-2026-10-17/first-dance.webp". */
  src: string;
  kind: "image" | "video";
  /** Poster frame for a video. */
  poster?: string;
  alt: string;
  width: number;
  height: number;
  /** Card title for a themed gallery, e.g. "The Lovers". */
  label?: string;
  /** Its tarot number, e.g. "VI". */
  numeral?: string;
};

// Photos and video from real events, shown above the notes on /reviews.
// Empty until the October 17 Valle Vista files are added: an empty list
// renders no gallery at all, never a grey placeholder. To add an event:
// web-size the files (long edge about 1600px, JPEG/WebP, video as H.264 MP4
// with a poster), put them in public/reviews/<event>/, and list them here.
// Only media we have permission to post (the agreement's marketing-photo
// clause covers our own couples, with opt-out by message).
const VV = "/reviews/valle-vista-2026-10-17";
const FO = "/reviews/forge-on-4th-2026-11-07";

export type ReviewEvent = {
  /** Page address: /weddings/<slug>. Printed on cards once shared: add, never rename. */
  slug: string;
  title: string;
  date: string;
  /** YYYY-MM-DD. Notes the couple writes from a house wedding's hub on this date land on this page. */
  eventDate: string;
  media: ReviewMedia[];
  /** A look of the couple's own, drawn from their day. Absent: the site's look. */
  theme?: "goth";
  /** A line from the day itself (their own sign), never one we wrote for them. */
  tagline?: string;
};

export const REVIEW_EVENTS: ReviewEvent[] = [
  {
    // Our first wedding (CLAUDE.md §9.2). Phone photos and one clip from the
    // night, lightly graded only: rotation fixed, web-sized, a touch of warmth,
    // location data stripped. Originals stay with Jacob, not in the repo.
    slug: "valle-vista-2026-10-17",
    title: "Valle Vista Golf Club & Conference Center, Greenwood",
    date: "October 17, 2026",
    eventDate: "2026-10-17",
    media: [
      { src: `${VV}/room-set.jpg`, kind: "image", alt: "The ballroom at Valle Vista with the DJ table and speakers set up before guests arrived", width: 1600, height: 1200 },
      { src: `${VV}/dance-floor.mp4`, kind: "video", poster: `${VV}/dance-floor-poster.jpg`, alt: "A short clip of a parent dance, filmed from the DJ table", width: 720, height: 1280 },
      { src: `${VV}/dj-table.jpg`, kind: "image", alt: "Jake and Nic at the DJ table getting the music ready", width: 1600, height: 1200 },
      { src: `${VV}/dance-floor.jpg`, kind: "image", alt: "The parent dance, seen from behind the mixer and laptop at the DJ table", width: 1200, height: 1600 },
      { src: `${VV}/jake-before.jpg`, kind: "image", alt: "Jake in the ballroom before the reception", width: 1200, height: 1600 },
      { src: `${VV}/jake-reception.jpg`, kind: "image", alt: "Jake during the reception with guests on the floor behind him", width: 1200, height: 1600 },
    ],
  },
  {
    // Kat and Tanis, November 7 (CLAUDE.md §9.2). Titled by the venue, like
    // Valle Vista: the couple's names appear only if they sign a note
    // themselves. Photos go here once Jacob sends them, prepared the same way
    // (light edits only, location data stripped). Until then the page shows
    // no gallery, never a placeholder.
    slug: "forge-on-4th-2026-11-07",
    title: "Forge on 4th, Columbus",
    date: "November 7, 2026",
    eventDate: "2026-11-07",
    // Their day was black and violet, skeleton hands making a heart, tables
    // named for tarot cards, and "'Til We Are Ghosts" at the sweetheart table.
    // The page wears it (Jacob, 2026-11-11: "emo pop punk Gothic"). Left out on
    // purpose: the seating-chart mirror (about 90 guests' names legible) and a
    // photo of two guests, who are not covered by the couple's photo consent,
    // plus three that center on kids or young bridesmaids (add only if Kat OKs).
    theme: "goth",
    tagline: "'Til We Are Ghosts",
    media: [
      { src: `${FO}/welcome-sign.jpg`, kind: "image", numeral: "XVII", label: "The Star", alt: "The welcome sign: black with violet flowers and skeleton hands making a heart around 11.07.2026", width: 1200, height: 1600 },
      { src: `${FO}/getting-ready.jpg`, kind: "image", numeral: "I", label: "Ace of Cups", alt: "The bride getting ready, putting in an earring at the mirror in a white satin robe", width: 1200, height: 1600 },
      { src: `${FO}/vows.jpg`, kind: "image", numeral: "VI", label: "The Lovers", alt: "The vows under a black coffin-shaped arch with violet flowers and candles", width: 1200, height: 1600 },
      { src: `${FO}/first-dance.jpg`, kind: "image", numeral: "II", label: "Two of Cups", alt: "The bride and groom in a dramatic dance hold, her gown white with black lace flowers", width: 1200, height: 1600 },
      { src: `${FO}/table-wheel.jpg`, kind: "image", numeral: "X", label: "Wheel of Fortune", alt: "A table in black and violet under brick arched windows, its Wheel of Fortune tarot card standing tall", width: 1200, height: 1600 },
      { src: `${FO}/table.jpg`, kind: "image", numeral: "X", label: "Ten of Pentacles", alt: "A guest table set in black and violet with a lantern centerpiece", width: 1200, height: 1600 },
      { src: `${FO}/bride-dance.jpg`, kind: "image", numeral: "X", label: "Ten of Cups", alt: "The bride sharing a dance, smiling, as the groom watches from the head table", width: 1200, height: 1600 },
      { src: `${FO}/dance-floor.jpg`, kind: "image", numeral: "XIX", label: "The Sun", alt: "The bride and groom laughing mid-dance on the floor", width: 1200, height: 1600 },
      { src: `${FO}/slow-dance.jpg`, kind: "image", numeral: "IV", label: "Four of Wands", alt: "The bride and groom in a close slow dance in low light, the room soft behind them", width: 901, height: 1600 },
      { src: `${FO}/family-hug.jpg`, kind: "image", numeral: "XXI", label: "The World", alt: "A big group hug on the dance floor as guests look on", width: 1200, height: 1600 },
    ],
  },
];

export function findReviewEvent(slug: string | null | undefined): ReviewEvent | null {
  return REVIEW_EVENTS.find((e) => e.slug === slug) ?? null;
}
