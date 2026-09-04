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

import { OWNER_EMAIL } from "@/lib/site";

export type Scheduler = {
  /** The slug in the printed QR code. Never change one that has shipped. */
  slug: string;
  /** How the page addresses them: "Book a call with Brayton". */
  name: string;
  /** Shown under the name so a stranger knows who they are about to talk to. */
  title: string;
  /**
   * Where the booking alert goes. Env-driven so a person's address can land
   * without a deploy, and falling back to the owner rather than to nothing:
   * a card is in someone's wallet, and an appointment that reaches nobody is
   * worse than one that reaches Jacob.
   */
  notifyEmail: string;
};

function notify(varName: string): string {
  const own = process.env[varName]?.trim();
  return own && own.includes("@") ? own : OWNER_EMAIL;
}

export const SCHEDULERS: Scheduler[] = [
  {
    slug: "jake",
    name: "Jake",
    title: "Co-founder & Event Producer",
    notifyEmail: notify("SCHEDULER_EMAIL_JAKE"),
  },
  {
    slug: "nic",
    name: "Nic",
    title: "Co-founder & Event Manager",
    notifyEmail: notify("SCHEDULER_EMAIL_NIC"),
  },
  {
    slug: "brayton",
    name: "Brayton",
    title: "Co-founder & Director of Talent & Training",
    notifyEmail: notify("SCHEDULER_EMAIL_BRAYTON"),
  },
  {
    slug: "ashton",
    name: "Ashton",
    title: "Production Manager",
    notifyEmail: notify("SCHEDULER_EMAIL_ASHTON"),
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
