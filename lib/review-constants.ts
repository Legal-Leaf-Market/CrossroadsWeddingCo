// Client-safe pieces of the /reviews board. lib/reviews.ts is server-only
// (Drizzle, pg); a client component importing it breaks the build.

export const RELATIONS = [
  "Our wedding",
  "Our event",
  "Venue or vendor",
  "Guest",
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
};

// Photos and video from real events, shown above the notes on /reviews.
// Empty until the October 17 Valle Vista files are added: an empty list
// renders no gallery at all, never a grey placeholder. To add an event:
// web-size the files (long edge about 1600px, JPEG/WebP, video as H.264 MP4
// with a poster), put them in public/reviews/<event>/, and list them here.
// Only media we have permission to post (the agreement's marketing-photo
// clause covers our own couples, with opt-out by message).
const VV = "/reviews/valle-vista-2026-10-17";

export const REVIEW_EVENTS: { title: string; date: string; media: ReviewMedia[] }[] = [
  {
    // Our first wedding (CLAUDE.md §9.2). Phone photos and one clip from the
    // night, lightly graded only: rotation fixed, web-sized, a touch of warmth,
    // location data stripped. Originals stay with Jacob, not in the repo.
    title: "Valle Vista Golf Club & Conference Center, Greenwood",
    date: "October 17, 2026",
    media: [
      { src: `${VV}/room-set.jpg`, kind: "image", alt: "The ballroom at Valle Vista with the DJ table and speakers set up before guests arrived", width: 1600, height: 1200 },
      { src: `${VV}/dance-floor.mp4`, kind: "video", poster: `${VV}/dance-floor-poster.jpg`, alt: "A short clip of a parent dance, filmed from the DJ table", width: 720, height: 1280 },
      { src: `${VV}/dj-table.jpg`, kind: "image", alt: "Jake and Nic at the DJ table getting the music ready", width: 1600, height: 1200 },
      { src: `${VV}/dance-floor.jpg`, kind: "image", alt: "Guests dancing, seen from behind the mixer and laptop at the DJ table", width: 1200, height: 1600 },
      { src: `${VV}/jake-before.jpg`, kind: "image", alt: "Jake in the ballroom before the reception", width: 1200, height: 1600 },
      { src: `${VV}/jake-reception.jpg`, kind: "image", alt: "Jake during the reception with guests on the floor behind him", width: 1200, height: 1600 },
    ],
  },
];
