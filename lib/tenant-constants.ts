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

/** Owner decision 2026-11-11 (Jacob): one plan, every feature, $50 a month flat. */
export const PLAN_PRICE_USD = 50;

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

/**
 * True for Crossroads' own bookings. A NULL tenant predates the column and was
 * backfilled to the house, so it reads as house too. Features written for
 * Crossroads alone (its service agreement, the team message thread that emails
 * Jake, Crossroads video calls, check-in texts) are gated on this.
 */
export function isHouseTenant(tenantId: string | null | undefined): boolean {
  return !tenantId || tenantId === HOUSE_TENANT_ID;
}

/** Event types a business account can book. Stored in weddings.package_type. Add, never rename. */
export const EVENT_TYPES = [
  { key: "wedding", label: "Wedding" },
  { key: "corporate", label: "Corporate event" },
  { key: "private_party", label: "Private party" },
  { key: "other", label: "Other event" },
] as const;

export function eventTypeLabel(key: string | null | undefined): string {
  return EVENT_TYPES.find((t) => t.key === key)?.label ?? "Event";
}

/** Statuses an account owner can set, with plain labels. Values are the event_status enum. */
export const BOOKING_STATUSES = [
  { key: "inquiry", label: "Inquiry" },
  { key: "deposit_paid", label: "Booked (deposit in)" },
  { key: "planning_locked", label: "Planning locked" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export type BookingStatusKey = (typeof BOOKING_STATUSES)[number]["key"];

export function bookingStatusLabel(key: string): string {
  return BOOKING_STATUSES.find((s) => s.key === key)?.label ?? key.replace(/_/g, " ");
}
