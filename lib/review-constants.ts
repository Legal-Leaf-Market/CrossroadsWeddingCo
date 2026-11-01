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
export const REVIEW_EVENTS: { title: string; date: string; media: ReviewMedia[] }[] = [];
