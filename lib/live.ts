// The "Crossroads Live" drift engine, pure and client-safe: both live pages
// (the hub's control view and the vendor's read-only view) share this math.
// All wall-clock conversion pins to the venue timezone (lib/site.ts), so the
// server render, a vendor's phone in another timezone, and the MC's device
// all agree, and SSR output never hydration-mismatches the client.

import { VENUE_TIME_ZONE } from "@/lib/site";

export type LiveBlock = {
  id: string;
  title: string;
  category: string;
  /** HH:MM, 24-hour, venue wall clock. */
  scheduledStartTime: string;
  durationMinutes: number;
  /** ISO timestamp of the moment the MC started the block, null until then. */
  actualStart: string | null;
  isCompleted: boolean;
  mcNotes: string;
};

export type LiveView = {
  blocks: (LiveBlock & {
    /** Minutes since venue-local midnight the block is now expected to start. */
    projectedMinutes: number;
    status: "done" | "now" | "upcoming";
  })[];
  /** Positive = running behind schedule, negative = ahead. Null before the first start. */
  driftMinutes: number | null;
  currentId: string | null;
  allDone: boolean;
};

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToLabel(totalMinutes: number): string {
  // Projected times can drift past midnight; wrap for display.
  const wrapped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

const venueClock = new Intl.DateTimeFormat("en-US", {
  timeZone: VENUE_TIME_ZONE,
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

/** Minutes since midnight of `iso`, on the venue's wall clock. */
function venueMinutes(iso: string): number {
  const parts = venueClock.formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

/**
 * Difference in minutes between two times-of-day, wrapped into (-720, 720]
 * so a block scheduled 23:55 and started 00:10 reads 15 minutes behind, not
 * 1425 minutes ahead.
 */
function wrappedDelta(actualMinutes: number, scheduledMinutes: number): number {
  let d = actualMinutes - scheduledMinutes;
  d = ((((d + 720) % 1440) + 1440) % 1440) - 720;
  return d;
}

/**
 * Project the day: started blocks anchor to their actual start; the drift of
 * the most recent start (actual minus scheduled) shifts every block after it,
 * per the spec's cascade ("speeches run 18 over, everything downstream moves
 * 18").
 */
export function computeLive(blocks: LiveBlock[]): LiveView {
  let driftMinutes: number | null = null;
  let lastStartedIndex = -1;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].actualStart) {
      lastStartedIndex = i;
      driftMinutes = wrappedDelta(
        venueMinutes(blocks[i].actualStart as string),
        hhmmToMinutes(blocks[i].scheduledStartTime),
      );
    }
  }
  const current =
    lastStartedIndex >= 0 && !blocks[lastStartedIndex].isCompleted ? blocks[lastStartedIndex] : null;
  const allDone = blocks.length > 0 && blocks.every((b) => b.isCompleted);
  return {
    driftMinutes: driftMinutes === null ? null : Math.round(driftMinutes),
    currentId: current?.id ?? null,
    allDone,
    blocks: blocks.map((b, i) => ({
      ...b,
      projectedMinutes: b.actualStart
        ? venueMinutes(b.actualStart)
        : hhmmToMinutes(b.scheduledStartTime) +
          (i > lastStartedIndex && driftMinutes !== null ? driftMinutes : 0),
      status: b.isCompleted ? "done" : current && b.id === current.id ? "now" : "upcoming",
    })),
  };
}

/**
 * The epoch instant at which the venue's wall clock reads `hhmm` on the day
 * `dateIso` (YYYY-MM-DD), DST-correct for that date. Used by the countdown
 * hero and the dev previews so venue-local schedule times become real
 * instants regardless of the machine's own timezone.
 */
export function venueWallClockToEpoch(dateIso: string, hhmm: string): number {
  const [y, mo, d] = dateIso.split("-").map(Number);
  const [h, m] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, m);
  const venue = new Date(guess).toLocaleString("en-US", {
    timeZone: VENUE_TIME_ZONE,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  });
  const [vh, vm] = venue.split(":").map(Number);
  const diff = h * 60 + m - ((vh % 24) * 60 + vm);
  return guess + diff * 60_000;
}

export function driftLabel(driftMinutes: number | null): string {
  if (driftMinutes === null) return "Not started yet";
  if (Math.abs(driftMinutes) <= 2) return "On schedule";
  return driftMinutes > 0 ? `Running ${driftMinutes} min behind` : `Running ${-driftMinutes} min ahead`;
}

export type LiveAction = "start" | "complete" | "reset";

/**
 * The exact state transition the live API applies, as a pure function: start
 * anchors the block to now, closes everything before it, and reopens
 * everything after. Used by the dev preview to simulate the console with no
 * database, and it documents the server semantics in one place.
 */
export function applyLiveAction(
  blocks: LiveBlock[],
  action: LiveAction,
  itemId: string,
  nowIso: string,
): LiveBlock[] {
  const index = blocks.findIndex((b) => b.id === itemId);
  if (index < 0) return blocks;
  return blocks.map((b, i) => {
    if (action === "start") {
      if (i < index) return { ...b, isCompleted: true };
      if (i === index) return { ...b, actualStart: nowIso, isCompleted: false };
      return { ...b, actualStart: null, isCompleted: false };
    }
    if (action === "complete") {
      return i === index ? { ...b, isCompleted: true } : b;
    }
    // reset: this block and everything after go back to untouched.
    return i >= index ? { ...b, actualStart: null, isCompleted: false } : b;
  });
}
