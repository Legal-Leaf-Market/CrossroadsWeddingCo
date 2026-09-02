// Client-safe hub constants. No database imports here: components/hub/* are
// client components, and anything they import must never pull in lib/db (pg).

// The named moments a DJ needs a track for. Fixed set: the portal upserts one
// cue row per type, and the run sheet prints them in this order.
export const CUE_TYPES = [
  { type: "processional", label: "Processional" },
  { type: "recessional", label: "Recessional" },
  { type: "grand_entrance", label: "Grand entrance" },
  { type: "first_dance", label: "First dance" },
  { type: "father_daughter", label: "Father-daughter dance" },
  { type: "mother_son", label: "Mother-son dance" },
  { type: "kids_dance", label: "Dance with the kids" },
  { type: "cake_cutting", label: "Cake cutting" },
  { type: "bouquet_toss", label: "Bouquet toss" },
  { type: "garter_toss", label: "Garter toss" },
  { type: "money_dance", label: "Dollar dance" },
  { type: "last_song", label: "Last song" },
] as const;

export type CueType = (typeof CUE_TYPES)[number]["type"];

export const TIMELINE_CATEGORIES = [
  "pre_ceremony",
  "ceremony",
  "cocktail",
  "reception",
  "dance",
] as const;

export const TOKEN_RE = /^[a-f0-9]{48}$/;

/** HH:MM, 24-hour. Shared by the timeline route's zod schema and the client's pre-save guard. */
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Message sent with a 409 when a hub section was changed from another tab or device. */
export const CONFLICT_MESSAGE = "Updated from another device. Showing the latest.";

/** A couple can split their music into this many shared Spotify playlists. */
export const MAX_PLAYLIST_LINKS = 10;

export type PlaylistLink = { label: string; url: string };

/**
 * Coerce whatever the spotify_playlist_urls jsonb column holds into clean
 * {label, url} rows. A manually fixed-up or malformed element must never
 * reach the client, where rendering it would crash the hub.
 */
export function normalizePlaylistLinks(value: unknown): PlaylistLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is Record<string, unknown> => x !== null && typeof x === "object")
    .map((x) => ({
      label: typeof x.label === "string" ? x.label : "",
      url: typeof x.url === "string" ? x.url : "",
    }))
    .slice(0, MAX_PLAYLIST_LINKS);
}

/**
 * Extract the playlist id from a Spotify share link or URI, null when the
 * input is not a playlist link. Lives here (client-safe) so the hub UI and
 * the API routes validate identically; lib/spotify re-exports it.
 */
/**
 * A single Spotify track link (share link or URI) to its id, null when the
 * input is not one. Mirrors parsePlaylistId so the hub UI and the API agree.
 */
export function parseTrackId(input: string): string | null {
  const trimmed = input.trim();
  const uri = trimmed.match(/^spotify:track:([A-Za-z0-9]+)$/);
  if (uri) return uri[1];
  try {
    const url = new URL(trimmed);
    if (!/(^|\.)spotify\.com$/.test(url.hostname)) return null;
    const match = url.pathname.match(/\/track\/([A-Za-z0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function parsePlaylistId(input: string): string | null {
  const trimmed = input.trim();
  const uri = trimmed.match(/^spotify:playlist:([A-Za-z0-9]+)$/);
  if (uri) return uri[1];
  try {
    const url = new URL(trimmed);
    if (!/(^|\.)spotify\.com$/.test(url.hostname)) return null;
    const match = url.pathname.match(/\/playlist\/([A-Za-z0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** "Saturday, June 12, 2027" from a YYYY-MM-DD date, timezone-proof via noon UTC. */
export function formatEventDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Days until the event; negative once it has passed. */
export function daysOut(eventDate: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const ms = new Date(`${eventDate}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Who can reply on a thread. The chat picker renders this, and the admin POST
 * route validates against it, so both halves stay in step: before this was
 * shared, the roster lived in three places (the picker's list, a hardcoded
 * localStorage check, and a z.enum on the server) and adding a teammate to the
 * dropdown silently posted their messages as Jake.
 *
 * Adding someone is a one-line change here. Names are stored on every message
 * row, so renaming an entry does not rewrite history: past messages keep the
 * name they were sent under.
 */
export const TEAM_NAMES = ["Jake", "Nic", "Brayton", "Ashton"] as const;
export type TeamName = (typeof TEAM_NAMES)[number];

export function isTeamName(v: unknown): v is TeamName {
  return typeof v === "string" && (TEAM_NAMES as readonly string[]).includes(v);
}
