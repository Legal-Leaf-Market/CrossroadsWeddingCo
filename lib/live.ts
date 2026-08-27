// The "Crossroads Live" drift engine, pure and client-safe: both live pages
// (the hub's control view and the vendor's read-only view) compute drift on
// the device so wall-clock math happens in the venue's own timezone, and the
// server only stores raw facts (scheduled TIME, actual timestamptz, done).

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
    /** Minutes since local midnight the block is now expected to start. */
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

function localMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/**
 * Project the day: started blocks anchor to their actual start; the drift of
 * the most recent start (actual minus scheduled) shifts every block after it,
 * per the spec's cascade ("speeches run 18 over, everything downstream moves
 * 18"). Assumes blocks are ordered and a single-day event.
 */
export function computeLive(blocks: LiveBlock[]): LiveView {
  let driftMinutes: number | null = null;
  let lastStartedIndex = -1;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].actualStart) {
      lastStartedIndex = i;
      driftMinutes = localMinutes(blocks[i].actualStart as string) - hhmmToMinutes(blocks[i].scheduledStartTime);
    }
  }
  const current = lastStartedIndex >= 0 && !blocks[lastStartedIndex].isCompleted ? blocks[lastStartedIndex] : null;
  const allDone = blocks.length > 0 && blocks.every((b) => b.isCompleted);
  return {
    driftMinutes: driftMinutes === null ? null : Math.round(driftMinutes),
    currentId: current?.id ?? null,
    allDone,
    blocks: blocks.map((b, i) => ({
      ...b,
      projectedMinutes: b.actualStart
        ? localMinutes(b.actualStart)
        : hhmmToMinutes(b.scheduledStartTime) + (i > lastStartedIndex && driftMinutes !== null ? driftMinutes : 0),
      status: b.isCompleted ? "done" : current && b.id === current.id ? "now" : "upcoming",
    })),
  };
}

export function driftLabel(driftMinutes: number | null): string {
  if (driftMinutes === null) return "Not started yet";
  if (Math.abs(driftMinutes) <= 2) return "On schedule";
  return driftMinutes > 0 ? `Running ${driftMinutes} min behind` : `Running ${-driftMinutes} min ahead`;
}
