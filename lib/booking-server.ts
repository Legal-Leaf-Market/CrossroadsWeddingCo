/**
 * Server side of the intro-call calendar: office hours in, bookable slots out,
 * one appointment written under a constraint that cannot double-book.
 *
 * The pure scheduling arithmetic lives in lib/scheduling.ts and is tested
 * against a fixed clock. Everything here is the database half.
 */

import { and, asc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, officeHours } from "@/lib/db/schema";
import { resolveDatabaseUrl } from "@/lib/db/url";
import { VENUE_TIME_ZONE } from "@/lib/site";
import {
  APPOINTMENT_MINUTES,
  CALENDAR_DAYS,
  LEAD_MINUTES,
  type Scheduler,
} from "@/lib/schedulers";
import { slotsForDate, venueYmd, type OfficeHour } from "@/lib/scheduling";

/** "HH:MM" from minutes past midnight, which is what slotsForDate reads. */
function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type DaySlots = {
  /** Venue-local "YYYY-MM-DD". */
  ymd: string;
  /** UTC ISO instants, which is the only shape a client should ever hold. */
  slots: string[];
};

export async function getOfficeHours(personSlug: string): Promise<OfficeHour[]> {
  if (!resolveDatabaseUrl()) return [];
  const rows = await db
    .select()
    .from(officeHours)
    .where(eq(officeHours.personSlug, personSlug))
    .orderBy(asc(officeHours.weekday), asc(officeHours.startMinute));
  return rows.map((r) => ({
    weekday: r.weekday,
    start: hhmm(r.startMinute),
    end: hhmm(r.endMinute),
  }));
}

/** The venue-local dates the calendar covers, starting today. */
function calendarDates(now: Date): string[] {
  const out: string[] = [];
  for (let i = 0; i < CALENDAR_DAYS; i++) {
    out.push(venueYmd(new Date(now.getTime() + i * 86_400_000), VENUE_TIME_ZONE));
  }
  return out;
}

/**
 * Every open slot for one person over the next CALENDAR_DAYS days.
 *
 * Returns an empty array, never a fabricated one, when the person has set no
 * office hours. A calendar that invents "Tuesdays 6 to 8" because nobody has
 * filled theirs in offers a stranger a time its owner never agreed to, and the
 * first anyone hears of it is a missed call.
 */
export async function getAvailability(personSlug: string, now = new Date()): Promise<DaySlots[]> {
  const hours = await getOfficeHours(personSlug);
  if (hours.length === 0) return [];

  const dates = calendarDates(now);
  const horizon = new Date(now.getTime() + (CALENDAR_DAYS + 1) * 86_400_000);

  // One query for the whole window rather than one per day. Cancelled rows are
  // excluded here and not later: a cancelled appointment frees its slot, and
  // the unique index says the same thing.
  const booked = await db
    .select({ startsAt: appointments.startsAt, durationMinutes: appointments.durationMinutes })
    .from(appointments)
    .where(
      and(
        eq(appointments.personSlug, personSlug),
        isNull(appointments.cancelledAt),
        gte(appointments.startsAt, new Date(now.getTime() - 86_400_000)),
        lt(appointments.startsAt, horizon),
      ),
    );
  const busy = booked.map((b) => ({ startsAt: b.startsAt, duration: b.durationMinutes }));

  return dates
    .map((ymd) => ({
      ymd,
      slots: slotsForDate({
        ymd,
        hours,
        timeZone: VENUE_TIME_ZONE,
        durationMinutes: APPOINTMENT_MINUTES,
        busy,
        now,
        leadMinutes: LEAD_MINUTES,
      }).map((s) => s.startsAt.toISOString()),
    }))
    .filter((d) => d.slots.length > 0);
}

export type BookResult =
  | { ok: true; id: string }
  | { ok: false; reason: "taken" | "gone" | "unavailable" };

/**
 * Write one appointment.
 *
 * TWO CHECKS, AND THEY ARE NOT REDUNDANT. The first re-derives the slot from
 * office hours, because a client can post any instant it likes and the grid is
 * the only thing that says 6:17pm on a Sunday is not bookable. The second is
 * the unique index, which is what actually decides between two people tapping
 * the same 6:00 in the same second: the loser gets "taken", not a silent
 * second booking. A check-then-insert cannot see the request racing it.
 */
export async function bookAppointment(input: {
  person: Scheduler;
  startsAt: Date;
  name: string;
  email: string;
  phone?: string;
  eventDate?: string;
  notes?: string;
  now?: Date;
}): Promise<BookResult> {
  const now = input.now ?? new Date();
  const ymd = venueYmd(input.startsAt, VENUE_TIME_ZONE);
  const hours = await getOfficeHours(input.person.slug);
  if (hours.length === 0) return { ok: false, reason: "unavailable" };

  const legal = slotsForDate({
    ymd,
    hours,
    timeZone: VENUE_TIME_ZONE,
    durationMinutes: APPOINTMENT_MINUTES,
    now,
    leadMinutes: LEAD_MINUTES,
  }).some((s) => s.startsAt.getTime() === input.startsAt.getTime());
  if (!legal) return { ok: false, reason: "gone" };

  try {
    const [row] = await db
      .insert(appointments)
      .values({
        personSlug: input.person.slug,
        startsAt: input.startsAt,
        durationMinutes: APPOINTMENT_MINUTES,
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        eventDate: input.eventDate || null,
        notes: input.notes ?? "",
      })
      .returning({ id: appointments.id });
    return { ok: true, id: row.id };
  } catch (err) {
    // 23505 is unique_violation, which here means exactly one thing: somebody
    // else took this slot between the check above and this insert.
    if (isUniqueViolation(err)) return { ok: false, reason: "taken" };
    throw err;
  }
}

/**
 * Drizzle WRAPS the driver error, so the SQLSTATE is on `.cause` and not on the
 * error you catch. Reading `err.code` directly looks right, typechecks, and is
 * silently always undefined: the losing half of a real race got a 500 and the
 * words "Internal Server Error" instead of "someone just took that time". It
 * only showed up under two simultaneous requests against a real Postgres, which
 * is the only way this path is ever reached.
 */
function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 5; depth++) {
    if ((e as { code?: string }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

export type AdminAppointment = {
  id: string;
  personSlug: string;
  startsAt: Date;
  durationMinutes: number;
  name: string;
  email: string;
  phone: string | null;
  eventDate: string | null;
  notes: string;
};

/** Upcoming calls across everyone, for the dashboard. */
export async function getUpcomingAppointments(now = new Date()): Promise<AdminAppointment[]> {
  if (!resolveDatabaseUrl()) return [];
  return db
    .select({
      id: appointments.id,
      personSlug: appointments.personSlug,
      startsAt: appointments.startsAt,
      durationMinutes: appointments.durationMinutes,
      name: appointments.name,
      email: appointments.email,
      phone: appointments.phone,
      eventDate: appointments.eventDate,
      notes: appointments.notes,
    })
    .from(appointments)
    .where(and(isNull(appointments.cancelledAt), gte(appointments.startsAt, new Date(now.getTime() - 3_600_000))))
    .orderBy(asc(appointments.startsAt));
}

export async function cancelAppointment(id: string): Promise<void> {
  await db.update(appointments).set({ cancelledAt: sql`now()` }).where(eq(appointments.id, id));
}

/** Replace one person's whole week of office hours in a single transaction. */
export async function setOfficeHours(
  personSlug: string,
  blocks: { weekday: number; startMinute: number; endMinute: number }[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(officeHours).where(eq(officeHours.personSlug, personSlug));
    if (blocks.length === 0) return;
    await tx.insert(officeHours).values(blocks.map((b) => ({ personSlug, ...b })));
  });
}
