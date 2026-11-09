// Client-safe constants for accounts (tenants). No database imports here, so
// any component may read them.

/**
 * Crossroads itself. Fixed id, seeded by scripts/phase1-schema.sql, and the
 * column DEFAULT on every table the house app writes to. Changing it orphans
 * every existing booking.
 */
export const HOUSE_TENANT_ID = "00000000-0000-4000-8000-000000000001";

/**
 * Working name for the software sold to other businesses. Not a brand yet:
 * set NEXT_PUBLIC_PLATFORM_NAME once the name is chosen.
 */
export const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "Crossroads Agency OS";

/** Length of the free trial a new account starts on. No card is asked for. */
export const TRIAL_DAYS = 14;

/** What kind of business is signing up. Add, never rename: rows store the key. */
export const BUSINESS_TYPES = [
  { key: "dj", label: "DJ or entertainment company" },
  { key: "planner", label: "Wedding planner or coordinator" },
  { key: "photo_video", label: "Photographer or videographer" },
  { key: "photo_booth", label: "Photo booth" },
  { key: "bar", label: "Bar or beverage service" },
  { key: "music", label: "Live music or officiant" },
  { key: "venue", label: "Venue" },
  { key: "other", label: "Something else" },
] as const;

export type BusinessTypeKey = (typeof BUSINESS_TYPES)[number]["key"];

export function businessTypeLabel(key: string | null | undefined): string {
  return BUSINESS_TYPES.find((t) => t.key === key)?.label ?? "Wedding or event business";
}
