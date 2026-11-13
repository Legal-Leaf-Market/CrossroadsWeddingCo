// The owner dashboard's command center (2026-11-13, Jake: "ramp this the hell
// up"). Pure: it takes the rows the dashboard already loads plus `today`, and
// returns totals, a ranked to-do list, and the month-by-month season. Nothing
// here reads the database or the clock, so
// `node --experimental-strip-types scripts/verify-admin-insights.mjs` checks it
// directly. Type-only imports keep it runnable that way.
import type { AdminCall, AdminWedding } from "./admin";

/** Smallest slice of a wedding this module reads, so tests stay short. */
export type InsightWedding = Pick<
  AdminWedding,
  | "id"
  | "coupleNames"
  | "eventDate"
  | "status"
  | "packageType"
  | "totalAmount"
  | "depositAmount"
  | "isDepositPaid"
  | "isBalancePaid"
  | "contactEmail"
  | "unreadMessages"
  | "contractAcceptedAt"
  | "contractCountersignedAt"
  | "accessToken"
  | "officiant"
>;

export type ActionLevel = "now" | "soon" | "fyi";

export type Action = {
  level: ActionLevel;
  /** Sort key inside a level: lower is first. Days until the event or call. */
  rank: number;
  title: string;
  detail: string;
  /** Path relative to the dashboard ("" = the dashboard itself), or an absolute "/hub/..." path. */
  href: string;
  /** True when href is under the dashboard's own base path. */
  underBase: boolean;
};

export type MonthCell = {
  /** "2027-06" */
  key: string;
  /** "Jun" */
  label: string;
  year: number;
  booked: number;
  pending: number;
  /** Total contract value of booked events that month, whole dollars. */
  bookedRevenue: number;
};

export type Insights = {
  /** Booked events still ahead (deposit in, or moved past inquiry), and what they are worth. */
  bookedAhead: { count: number; revenue: number };
  /** Inquiries still ahead with no deposit, and what they would be worth. */
  pipeline: { count: number; revenue: number };
  /** Money received on every non-cancelled booking we can see. */
  collected: number;
  /** Still to come in on booked events (balances, plus deposits marked booked but unpaid). */
  owed: number;
  /** Balances past their due time: the event has happened and the balance is not marked paid. */
  pastDue: { count: number; amount: number };
  unreadMessages: number;
  actions: Action[];
  months: MonthCell[];
  /** Weddings booked per calendar year against the pacing cap, this year and next. */
  seasons: { year: number; booked: number; cap: number }[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Whole days from `today` to `date` (both YYYY-MM-DD); negative once passed. */
export function daysBetween(today: string, date: string): number {
  const ms = Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** A date is held: money is in, or the owner moved it past inquiry by hand. */
export function isBooked(w: Pick<InsightWedding, "status" | "isDepositPaid">): boolean {
  if (w.status === "cancelled") return false;
  return w.isDepositPaid || w.status !== "inquiry";
}

/** What has actually come in on one booking, in dollars. */
export function collectedOn(w: Pick<InsightWedding, "totalAmount" | "depositAmount" | "isDepositPaid" | "isBalancePaid" | "status">): number {
  if (w.status === "cancelled") return 0;
  const total = num(w.totalAmount);
  if (w.isBalancePaid) return total;
  return w.isDepositPaid ? Math.min(num(w.depositAmount), total) : 0;
}

function when(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function buildInsights(input: {
  weddings: InsightWedding[];
  calls: Pick<AdminCall, "id" | "name" | "startsAt">[];
  /** YYYY-MM-DD in the venue's time zone. */
  today: string;
  /** Wall-clock date of each call in the venue's time zone, by call id. */
  callDates?: Record<string, string>;
  /** Weddings per calendar year the business has agreed to take. */
  yearCap: number;
}): Insights {
  const { weddings, calls, today, yearCap } = input;
  const live = weddings.filter((w) => w.status !== "cancelled");
  const ahead = live.filter((w) => w.eventDate >= today);

  const bookedAhead = { count: 0, revenue: 0 };
  const pipeline = { count: 0, revenue: 0 };
  for (const w of ahead) {
    const bucket = isBooked(w) ? bookedAhead : pipeline;
    bucket.count += 1;
    bucket.revenue += num(w.totalAmount);
  }

  let collected = 0;
  let owed = 0;
  const pastDue = { count: 0, amount: 0 };
  for (const w of live) {
    const got = collectedOn(w);
    collected += got;
    if (!isBooked(w)) continue;
    const left = Math.max(0, num(w.totalAmount) - got);
    owed += left;
    // The balance is due 24 hours after the start time (lib/site.ts), so it is
    // late from the day after the event. The deposit is owed regardless.
    if (left > 0 && w.eventDate < today) {
      pastDue.count += 1;
      pastDue.amount += left;
    }
  }

  const actions: Action[] = [];
  const add = (a: Action) => actions.push(a);

  for (const w of live) {
    const d = daysBetween(today, w.eventDate);
    const name = w.coupleNames;
    const corporate = w.packageType === "corporate";
    const booked = isBooked(w);
    const left = Math.max(0, num(w.totalAmount) - collectedOn(w));

    if (w.unreadMessages > 0) {
      add({
        level: "now",
        rank: -1000 + d,
        title: `Reply to ${name}`,
        detail: `${w.unreadMessages} unread message${w.unreadMessages === 1 ? "" : "s"}`,
        href: `/messages/${w.id}`,
        underBase: true,
      });
    }

    if (d < 0) {
      if (booked && left > 0) {
        add({
          level: "now",
          rank: d,
          title: `Collect ${usd(left)} from ${name}`,
          detail: `Event was ${when(d)}; the balance was due 24 hours after the start`,
          href: `/invoice/${w.id}`,
          underBase: true,
        });
      }
      continue;
    }

    if (!corporate && w.contractAcceptedAt && !w.contractCountersignedAt) {
      add({
        level: "now",
        rank: d,
        title: `Sign ${name}'s DJ agreement`,
        detail: `They signed; it needs yours. Event ${when(d)}`,
        href: `/contract/${w.id}`,
        underBase: true,
      });
    }
    if (w.officiant && w.officiant.acceptedAt && !w.officiant.countersignedAt) {
      add({
        level: "now",
        rank: d,
        title: `Sign ${name}'s officiant agreement`,
        detail: `They accepted; it needs a signature. Event ${when(d)}`,
        href: `/officiant/${w.id}`,
        underBase: true,
      });
    }

    if (!w.isDepositPaid) {
      // An unpaid deposit on a date that is close is a date nobody is holding.
      const close = d <= 60;
      add({
        level: close ? "now" : "soon",
        rank: d,
        title: booked ? `Deposit not marked received: ${name}` : `Lock in ${name}`,
        detail: `${usd(Math.min(num(w.depositAmount), num(w.totalAmount)))} deposit due. Event ${when(d)}`,
        href: `/invoice/${w.id}`,
        underBase: true,
      });
    }

    if (!corporate && !w.contactEmail) {
      add({
        level: "soon",
        rank: d,
        title: `Get an email for ${name}`,
        detail: "Without one they cannot pull up their hub link at /my-wedding",
        href: `/hub/${w.accessToken}`,
        underBase: false,
      });
    }

    if (!corporate && booked && !w.contractAcceptedAt) {
      add({
        level: d <= 30 ? "now" : "soon",
        rank: d,
        title: `${name} hasn't signed the DJ agreement`,
        detail: `Nudge them from Messages. Event ${when(d)}`,
        href: `/messages/${w.id}`,
        underBase: true,
      });
    }

    if (booked && d <= 14) {
      add({
        level: "fyi",
        rank: d,
        title: `${name} is ${when(d)}`,
        detail: "Check the run sheet with the couple",
        href: `/hub/${w.accessToken}/runsheet`,
        underBase: false,
      });
    }
  }

  for (const c of calls) {
    const date = input.callDates?.[c.id] ?? c.startsAt.slice(0, 10);
    const d = daysBetween(today, date);
    if (d < 0 || d > 1) continue;
    add({
      level: "fyi",
      rank: d - 0.5,
      title: `Intro call with ${c.name} ${when(d)}`,
      detail: "Details under Booked intro calls",
      href: "#calls",
      underBase: false,
    });
  }

  const order: Record<ActionLevel, number> = { now: 0, soon: 1, fyi: 2 };
  actions.sort((a, b) => order[a.level] - order[b.level] || a.rank - b.rank || a.title.localeCompare(b.title));

  // Twelve months starting with this one.
  const [ty, tm] = today.split("-").map(Number);
  const months: MonthCell[] = [];
  for (let i = 0; i < 12; i++) {
    const m0 = tm - 1 + i;
    const year = ty + Math.floor(m0 / 12);
    const month = (m0 % 12) + 1;
    months.push({
      key: `${year}-${String(month).padStart(2, "0")}`,
      label: MONTHS[month - 1],
      year,
      booked: 0,
      pending: 0,
      bookedRevenue: 0,
    });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const w of ahead) {
    const cell = byKey.get(w.eventDate.slice(0, 7));
    if (!cell) continue;
    if (isBooked(w)) {
      cell.booked += 1;
      cell.bookedRevenue += num(w.totalAmount);
    } else {
      cell.pending += 1;
    }
  }

  // The cap is about weddings (2027 pacing); corporate nights don't count.
  const seasons = [ty, ty + 1].map((year) => ({
    year,
    cap: yearCap,
    booked: live.filter((w) => w.packageType !== "corporate" && isBooked(w) && w.eventDate.startsWith(`${year}-`)).length,
  }));

  return {
    bookedAhead,
    pipeline,
    collected,
    owed,
    pastDue,
    unreadMessages: live.reduce((s, w) => s + w.unreadMessages, 0),
    actions,
    months,
    seasons,
  };
}
