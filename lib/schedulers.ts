/**
 * Who can be booked for an intro call, and under which slug.
 *
 * These slugs are PRINTED. Every business card carries a QR code resolving to
 * crossroadsweddingco.com/book?with=<slug>, so renaming one silently breaks a
 * stack of cards already in people's hands. Add, never rename.
 *
 * This is deliberately a different list from lib/team.ts. That one is the
 * public "who you get" section and needs a bio and a face per person; this one
 * needs a slug and somewhere to send the notification. Keeping them apart is
 * what lets a card go live before a headshot exists.
 */

export type Scheduler = {
  /** The slug in the printed QR code. Never change one that has shipped. */
  slug: string;
  /** How the page addresses them: "Book a call with Brayton". */
  name: string;
  /** Shown under the name so a stranger knows who they are about to talk to. */
  title: string;
  /**
   * Where this person's booking alert goes.
   *
   * THE DEFAULT IS THE ADDRESS ON THEIR OWN BUSINESS CARD, not an env var and
   * not the owner. All four `@crossroadsweddingco.com` addresses are printed
   * on the cards and confirmed to exist (CARD_PRINT_SPEC.md), so the correct
   * value is already a settled public fact and there is nothing to remember in
   * a dashboard. An env var that has to be set before a feature works right is
   * a feature that ships subtly wrong, and this one would have shipped with
   * every call for all four people landing in Jake's inbox.
   *
   * The env var stays as an override, for anyone who would rather these went
   * to a personal address than to their crossroads one.
   */
  notifyEmail: string;
};

function notify(varName: string, cardAddress: string): string {
  const own = process.env[varName]?.trim();
  return own && own.includes("@") ? own : cardAddress;
}

export const SCHEDULERS: Scheduler[] = [
  {
    slug: "jake",
    name: "Jake",
    title: "Co-founder & Event Producer",
    notifyEmail: notify("SCHEDULER_EMAIL_JAKE", "jake@crossroadsweddingco.com"),
  },
  {
    slug: "nic",
    name: "Nic",
    title: "Co-founder & Event Manager",
    notifyEmail: notify("SCHEDULER_EMAIL_NIC", "nic@crossroadsweddingco.com"),
  },
  {
    slug: "brayton",
    name: "Brayton",
    title: "Co-founder & Director of Talent & Training",
    notifyEmail: notify("SCHEDULER_EMAIL_BRAYTON", "brayton@crossroadsweddingco.com"),
  },
  {
    slug: "ashton",
    name: "Ashton",
    title: "Production Manager",
    notifyEmail: notify("SCHEDULER_EMAIL_ASHTON", "ashton@crossroadsweddingco.com"),
  },
];

export function findScheduler(slug: string | undefined | null): Scheduler | null {
  if (!slug) return null;
  const wanted = slug.trim().toLowerCase();
  return SCHEDULERS.find((s) => s.slug === wanted) ?? null;
}

/** One length, one grid. See the double-booking guard in phase1-schema.sql. */
export const APPOINTMENT_MINUTES = 30;

/**
 * How far ahead the calendar opens, and how much notice a slot needs.
 *
 * Fourteen days because a scanned business card is a warm lead going cold, and
 * a calendar that only offers next month is a calendar nobody uses. Two hours
 * of lead time because these are phone calls, not gigs: the only thing it has
 * to prevent is a slot booked for four minutes from now while the phone is
 * still in someone's pocket.
 */
export const CALENDAR_DAYS = 14;
export const LEAD_MINUTES = 120;
