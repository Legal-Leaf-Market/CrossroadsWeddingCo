/**
 * Turning "Brayton is free Tuesdays 6pm to 8pm" into real bookable instants.
 *
 * Office hours are wall-clock times in the venue's zone, because that is how a
 * person thinks about their own evening. An appointment is an instant. The
 * conversion between the two is the only hard part of this feature, and it is
 * hard for one reason: on the two DST days a year, the offset that turns 6pm
 * Indiana into UTC is not the offset in effect at midnight that morning.
 *
 * Everything here is pure and takes `now` as an argument, so it can be tested
 * against a fixed clock instead of whatever today happens to be.
 */

export type OfficeHour = {
  /** 0 = Sunday, matching Date#getDay. */
  weekday: number;
  /** "HH:MM", 24-hour, venue wall clock. */
  start: string;
  end: string;
};

export type Slot = {
  /** UTC instant the slot begins. */
  startsAt: Date;
  /** Minutes. */
  duration: number;
};

export type Busy = { startsAt: Date; duration: number };

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseHHMM(value: string): number | null {
  const m = HHMM.exec(value);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * The zone's UTC offset in milliseconds at a given instant. Derived by asking
 * Intl what the wall clock reads there and comparing, which is the only way to
 * get this without shipping a timezone database.
 */
export function zoneOffsetMs(at: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(at)) p[part.type] = part.value;
  const asIfUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  return asIfUtc - at.getTime();
}

/**
 * A wall-clock time in `timeZone` to the instant it happens.
 *
 * Two passes. The first offset is looked up at the naive timestamp, which can
 * sit on the wrong side of a DST transition; the second is looked up at the
 * corrected instant, which is right.
 *
 * The measured difference, comparing both implementations across every half
 * hour of six transition days: they agree everywhere except wall-clock times
 * from 02:00 to 06:30 on the two changeover days, where one pass is off by
 * exactly an hour in whichever direction the clock moved. Evening office hours
 * are unaffected either way, so the second pass is not load-bearing today, and
 * it is two lines that stop being wrong if anyone ever books a 6am call.
 *
 * The hour that does not exist in spring and the hour that happens twice in
 * autumn both fall at 2am here, so this lands on a defensible instant rather
 * than trying to be clever about an ambiguity nobody will schedule into.
 */
export function zonedWallClockToUtc(
  ymd: string,
  minutesFromMidnight: number,
  timeZone: string,
): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, 0) + minutesFromMidnight * 60_000;
  const firstPass = naive - zoneOffsetMs(new Date(naive), timeZone);
  const secondPass = naive - zoneOffsetMs(new Date(firstPass), timeZone);
  return new Date(secondPass);
}

/** The venue-local date, "YYYY-MM-DD", that an instant falls on. */
export function venueYmd(at: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(at);
}

/** Which weekday a venue-local date is, without constructing a local Date. */
export function venueWeekday(ymd: string, timeZone: string): number {
  const noon = zonedWallClockToUtc(ymd, 12 * 60, timeZone);
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(noon);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Bookable slots on one venue-local date.
 *
 * A slot survives only if the whole appointment fits inside a single office
 * hour block, nothing already booked overlaps it, and it starts far enough
 * ahead of `now`. Slots do not straddle two blocks: 5-6pm and 7-8pm is not
 * secretly a 90 minute window.
 */
export function slotsForDate(opts: {
  ymd: string;
  hours: OfficeHour[];
  timeZone: string;
  durationMinutes: number;
  stepMinutes?: number;
  busy?: Busy[];
  now: Date;
  leadMinutes?: number;
}): Slot[] {
  const {
    ymd,
    hours,
    timeZone,
    durationMinutes,
    stepMinutes = durationMinutes,
    busy = [],
    now,
    leadMinutes = 0,
  } = opts;

  if (durationMinutes <= 0 || stepMinutes <= 0) return [];
  const weekday = venueWeekday(ymd, timeZone);
  const earliest = now.getTime() + leadMinutes * 60_000;
  const busyRanges = busy.map((b) => [b.startsAt.getTime(), b.startsAt.getTime() + b.duration * 60_000] as const);

  const out: Slot[] = [];
  const seen = new Set<number>();

  for (const block of hours) {
    if (block.weekday !== weekday) continue;
    const from = parseHHMM(block.start);
    const to = parseHHMM(block.end);
    if (from === null || to === null || to <= from) continue;

    for (let m = from; m + durationMinutes <= to; m += stepMinutes) {
      const startsAt = zonedWallClockToUtc(ymd, m, timeZone);
      const t = startsAt.getTime();
      if (t < earliest) continue;
      // Two office-hour blocks that touch or overlap must not yield the same
      // slot twice.
      if (seen.has(t)) continue;
      const end = t + durationMinutes * 60_000;
      if (busyRanges.some(([bs, be]) => overlaps(t, end, bs, be))) continue;
      seen.add(t);
      out.push({ startsAt, duration: durationMinutes });
    }
  }

  out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return out;
}
