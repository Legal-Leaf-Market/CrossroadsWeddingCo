/**
 * Who can be booked for an intro call, and where their alert goes.
 *
 * These slugs are PRINTED. Every business card carries a QR code resolving to
 * crossroadsweddingco.com/book?with=<slug>, so renaming one silently breaks a
 * stack of cards already in people's hands. Add, never rename.
 *
 * NAME AND TITLE COME FROM lib/team.ts, they are not repeated here. This file
 * used to carry its own copy of both, from back when the team section had two
 * people in it and this had four, and the cost of that was a title able to say
 * one thing on the "who you get" cards and another on the page a QR code opens,
 * with nothing to catch it. This file now adds exactly one thing to a team
 * member: an address to notify.
 *
 * A slug here with no team entry is skipped rather than thrown on. A printed
 * card whose person has left should land on the ordinary booking page, which is
 * what /book already does with an unknown `?with=`, and not 500 the route for
 * everybody else.
 */
import { TEAM } from "@/lib/team";

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

/** The slug on each printed card, and the env var that can override its address. */
const BOOKABLE: { slug: string; envVar: string }[] = [
  { slug: "jake", envVar: "SCHEDULER_EMAIL_JAKE" },
  { slug: "nic", envVar: "SCHEDULER_EMAIL_NIC" },
  { slug: "brayton", envVar: "SCHEDULER_EMAIL_BRAYTON" },
  { slug: "ashton", envVar: "SCHEDULER_EMAIL_ASHTON" },
];

function notifyEmailFor(slug: string, envVar: string): string {
  const own = process.env[envVar]?.trim();
  return own && own.includes("@") ? own : `${slug}@crossroadsweddingco.com`;
}

export const SCHEDULERS: Scheduler[] = BOOKABLE.flatMap(({ slug, envVar }) => {
  const member = TEAM.find((m) => m.slug === slug);
  if (!member) return [];
  return [{
    slug,
    name: member.name,
    title: member.title,
    notifyEmail: notifyEmailFor(slug, envVar),
  }];
});

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
