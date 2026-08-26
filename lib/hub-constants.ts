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
  { type: "cake_cutting", label: "Cake cutting" },
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

/** Days until the event; negative once it has passed. */
export function daysOut(eventDate: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const ms = new Date(`${eventDate}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}
