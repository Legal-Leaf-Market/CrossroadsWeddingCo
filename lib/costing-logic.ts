// Project costing and resource planning, the arithmetic (2026-11-13). Pure: no
// database, no clock. `node --experimental-strip-types scripts/verify-costing.mjs`
// checks it. All money is integer cents; percents and shares are basis points
// (10000 = 100%); time is whole minutes.
//
// The model is the owner's own (2026-11-13): Jake and Terry are owners who
// split what each event leaves after every cost; Nic is paid per project for
// shadowing. So an owner line is never a cost. It records hours, and the
// summary turns the owners' share of what is left into an hourly figure.
// Every amount is entered by the owner; a line whose rate is not set is
// reported as missing, never guessed.

export const PAY_METHODS = ["project", "hour", "percent", "owner"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

export const PAY_METHOD_LABELS: Record<PayMethod, string> = {
  project: "Per project",
  hour: "Hourly",
  percent: "% of event",
  owner: "Owner split",
};

export function isPayMethod(v: unknown): v is PayMethod {
  return typeof v === "string" && (PAY_METHODS as readonly string[]).includes(v);
}

export type CostLine = {
  kind: "labor" | "material";
  crewMemberId: string | null;
  label: string;
  role: string;
  payMethod: PayMethod | null;
  rateCents: number | null;
  percentBps: number | null;
  plannedMinutes: number | null;
  actualMinutes: number | null;
  unitCostCents: number | null;
  plannedQty: number | null;
  actualQty: number | null;
  /** What was really paid; wins over any arithmetic. */
  actualCostCents: number | null;
};

export type LineCost = {
  /** Planned cost, null when it cannot be worked out (see missing). */
  planned: number | null;
  /** Actual cost when known: the paid amount, or arithmetic on actual quantities. */
  actual: number | null;
  /** Why planned is null, for the "needs a number" list. */
  missing: string | null;
};

const round = (n: number) => Math.round(n);

export function lineCost(line: CostLine, revenueCents: number): LineCost {
  if (line.kind === "material") {
    const unit = line.unitCostCents;
    const qty = line.plannedQty ?? 0;
    const planned = qty === 0 ? 0 : unit == null ? null : round(unit * qty);
    const actual =
      line.actualCostCents ?? (line.actualQty != null && unit != null ? round(unit * line.actualQty) : null);
    return { planned, actual, missing: planned == null ? "unit cost not set" : null };
  }
  switch (line.payMethod) {
    case "owner":
      return { planned: 0, actual: line.actualCostCents ?? 0, missing: null };
    case "project": {
      const planned = line.rateCents;
      return { planned, actual: line.actualCostCents ?? planned, missing: planned == null ? "pay not set" : null };
    }
    case "hour": {
      if (line.rateCents == null) return { planned: null, actual: line.actualCostCents, missing: "hourly rate not set" };
      const planned = round((line.rateCents * (line.plannedMinutes ?? 0)) / 60);
      const actual =
        line.actualCostCents ?? (line.actualMinutes != null ? round((line.rateCents * line.actualMinutes) / 60) : null);
      return { planned, actual, missing: null };
    }
    case "percent": {
      if (line.percentBps == null) return { planned: null, actual: line.actualCostCents, missing: "percent not set" };
      const planned = round((revenueCents * line.percentBps) / 10000);
      return { planned, actual: line.actualCostCents ?? planned, missing: null };
    }
    default:
      return { planned: null, actual: line.actualCostCents, missing: "pay type not set" };
  }
}

export type Owner = { id: string; name: string; shareBps: number | null };

/**
 * Each owner's slice of what is left, in basis points. Set shares are used as
 * written; owners with no share split whatever the set ones leave, evenly. Two
 * owners with nothing set is 50/50, which is "splitting" as the owner said it.
 */
export function ownerShares(owners: Owner[]): { id: string; name: string; bps: number }[] {
  const set = owners.filter((o) => o.shareBps != null);
  const unset = owners.filter((o) => o.shareBps == null);
  const used = set.reduce((s, o) => s + (o.shareBps ?? 0), 0);
  const rest = Math.max(0, 10000 - used);
  const each = unset.length ? rest / unset.length : 0;
  return owners.map((o) => ({ id: o.id, name: o.name, bps: o.shareBps ?? each }));
}

export type PersonRow = {
  crewMemberId: string | null;
  name: string;
  owner: boolean;
  plannedMinutes: number;
  actualMinutes: number | null;
  /** Pay for non-owners, owner share for owners; planned and best known. */
  plannedPay: number | null;
  actualPay: number | null;
  /** Pay per hour worked, planned and actual; null without hours or pay. */
  plannedPerHour: number | null;
  actualPerHour: number | null;
};

export type EventCosting = {
  revenue: number;
  planned: { labor: number; material: number; total: number; left: number };
  /** Best known: actual where known, planned otherwise. */
  actual: { labor: number; material: number; total: number; left: number };
  /** True once every line has an actual figure. */
  actualComplete: boolean;
  /** Planned margin as a fraction of revenue; null with no revenue. */
  plannedMargin: number | null;
  actualMargin: number | null;
  missing: { label: string; reason: string }[];
  people: PersonRow[];
  owners: { id: string; name: string; bps: number; planned: number; actual: number }[];
  /** Set shares that add up to more than 100%. */
  sharesOver: boolean;
};

const perHour = (pay: number | null, minutes: number | null) =>
  pay == null || minutes == null || minutes <= 0 ? null : round((pay * 60) / minutes);

export function costEvent(input: {
  revenueCents: number;
  lines: CostLine[];
  owners: Owner[];
  /** Display names by crew id, for the per-person rows. */
  names: Record<string, string>;
}): EventCosting {
  const { revenueCents, lines } = input;
  const planned = { labor: 0, material: 0, total: 0, left: 0 };
  const actual = { labor: 0, material: 0, total: 0, left: 0 };
  const missing: EventCosting["missing"] = [];
  let actualComplete = lines.length > 0;

  const costs = lines.map((l) => lineCost(l, revenueCents));
  lines.forEach((l, i) => {
    const c = costs[i];
    const bucket = l.kind === "material" ? "material" : "labor";
    if (c.missing) missing.push({ label: l.label || l.role || "Line", reason: c.missing });
    planned[bucket] += c.planned ?? 0;
    actual[bucket] += c.actual ?? c.planned ?? 0;
    if (c.actual == null) actualComplete = false;
  });
  planned.total = planned.labor + planned.material;
  actual.total = actual.labor + actual.material;
  planned.left = revenueCents - planned.total;
  actual.left = revenueCents - actual.total;

  const shares = ownerShares(input.owners);
  const sharesOver = input.owners.reduce((s, o) => s + (o.shareBps ?? 0), 0) > 10000;
  const owners = shares.map((o) => ({
    ...o,
    planned: round((Math.max(0, planned.left) * o.bps) / 10000),
    actual: round((Math.max(0, actual.left) * o.bps) / 10000),
  }));
  const ownerById = new Map(owners.map((o) => [o.id, o]));

  // One row per person on the event (labor lines grouped by crew member).
  const byPerson = new Map<string, PersonRow>();
  lines.forEach((l, i) => {
    if (l.kind !== "labor") return;
    const key = l.crewMemberId ?? `line:${i}`;
    const isOwner = l.payMethod === "owner";
    const row =
      byPerson.get(key) ??
      ({
        crewMemberId: l.crewMemberId,
        name: (l.crewMemberId && input.names[l.crewMemberId]) || l.label || "Crew",
        owner: isOwner,
        plannedMinutes: 0,
        actualMinutes: 0,
        plannedPay: isOwner ? null : 0,
        actualPay: isOwner ? null : 0,
        plannedPerHour: null,
        actualPerHour: null,
      } satisfies PersonRow);
    row.plannedMinutes += l.plannedMinutes ?? 0;
    row.actualMinutes = l.actualMinutes == null || row.actualMinutes == null ? null : row.actualMinutes + l.actualMinutes;
    if (!isOwner) {
      const c = costs[i];
      row.plannedPay = row.plannedPay == null || c.planned == null ? null : row.plannedPay + c.planned;
      row.actualPay = row.actualPay == null || c.actual == null ? null : row.actualPay + c.actual;
    }
    byPerson.set(key, row);
  });
  const people = [...byPerson.values()].map((r) => {
    if (r.owner && r.crewMemberId) {
      const o = ownerById.get(r.crewMemberId);
      r.plannedPay = o ? o.planned : null;
      r.actualPay = o ? o.actual : null;
    }
    return {
      ...r,
      plannedPerHour: perHour(r.plannedPay, r.plannedMinutes),
      actualPerHour: perHour(r.actualPay, r.actualMinutes),
    };
  });

  return {
    revenue: revenueCents,
    planned,
    actual,
    actualComplete,
    plannedMargin: revenueCents > 0 ? planned.left / revenueCents : null,
    actualMargin: revenueCents > 0 ? actual.left / revenueCents : null,
    missing,
    people,
    owners,
    sharesOver,
  };
}

export type ScheduledLine = {
  weddingId: string;
  eventName: string;
  eventDate: string;
  crewMemberId: string | null;
  plannedMinutes: number | null;
};

export type CrewMonth = { key: string; minutes: number; events: number };

/**
 * Hours each person is planned for, month by month, and the days someone is
 * on two different events. Lines with no person are skipped.
 */
export function crewLoad(
  lines: ScheduledLine[],
  monthKeys: string[],
): {
  byPerson: Record<string, CrewMonth[]>;
  conflicts: { crewMemberId: string; date: string; events: string[] }[];
} {
  const byPerson: Record<string, CrewMonth[]> = {};
  const seen = new Map<string, Set<string>>(); // person|month -> wedding ids
  const days = new Map<string, Map<string, string>>(); // person|date -> wedding id -> name
  for (const l of lines) {
    if (!l.crewMemberId) continue;
    const month = l.eventDate.slice(0, 7);
    const idx = monthKeys.indexOf(month);
    if (idx >= 0) {
      byPerson[l.crewMemberId] ??= monthKeys.map((key) => ({ key, minutes: 0, events: 0 }));
      const cell = byPerson[l.crewMemberId][idx];
      cell.minutes += l.plannedMinutes ?? 0;
      const sk = `${l.crewMemberId}|${month}`;
      const set = seen.get(sk) ?? new Set<string>();
      if (!set.has(l.weddingId)) {
        set.add(l.weddingId);
        cell.events += 1;
      }
      seen.set(sk, set);
    }
    const dk = `${l.crewMemberId}|${l.eventDate}`;
    const m = days.get(dk) ?? new Map<string, string>();
    m.set(l.weddingId, l.eventName);
    days.set(dk, m);
  }
  const conflicts = [...days.entries()]
    .filter(([, m]) => m.size > 1)
    .map(([k, m]) => {
      const [crewMemberId, date] = k.split("|");
      return { crewMemberId, date, events: [...m.values()].sort() };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  return { byPerson, conflicts };
}

/** "$1,234" from cents; "$12.50" when there are cents worth showing. */
export function centsLabel(c: number | null): string {
  if (c == null) return "not set";
  const neg = c < 0;
  const abs = Math.abs(c);
  const s = abs % 100 === 0 ? (abs / 100).toLocaleString("en-US") : (abs / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${neg ? "-" : ""}$${s}`;
}

/** "6.5h" from minutes. */
export function hoursLabel(min: number | null): string {
  if (min == null) return "";
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(h * 4 === Math.round(h * 4) ? 2 : 1).replace(/0$/, "")}h`;
}

// Job costing on an accrual basis under US GAAP (2026-11-13, Jake: "force
// accrual and US GAAP ... we are not a cash basis gl"; "we use the matching
// principle"; "match revenue to expenses by job costing"; "and accruals").
// Pure: `node --experimental-strip-types scripts/verify-costing.mjs` checks it.
//
// The rules, per job (one booking is one job):
// - Revenue is recognized when the performance obligation is satisfied, which
//   for an event is the event date (ASC 606, point in time). Before then,
//   money collected is a contract liability (deferred revenue), not income.
// - Direct job costs (non-owner labor, materials) are matched to that revenue:
//   expensed as cost of revenue in the event's period, whenever they are paid.
//   Paid before the event, they sit as prepaid job costs; still unpaid after
//   it, they are accrued job costs.
// - Earned but not collected is accounts receivable.
// - The owners' split is what the job leaves; it is not a job cost.
// "Paid" on a cost line is the amount that actually went out. A line without
// it counts at its planned cost.

export type Job = {
  id: string;
  name: string;
  eventDate: string;
  cancelled: boolean;
  revenueCents: number;
  /** Cash received from the client so far. */
  collectedCents: number;
  lines: CostLine[];
};

export type JobRow = {
  id: string;
  name: string;
  eventDate: string;
  /** Earned: the event date has come. */
  earned: boolean;
  revenue: number;
  /** Direct cost: actual where paid, planned otherwise. */
  cost: number;
  grossProfit: number;
  margin: number | null;
  /** Lines with no way to cost them yet (rate not set). */
  missing: number;
  hasPlan: boolean;
  deferredRevenue: number;
  receivable: number;
  prepaidCost: number;
  accruedCost: number;
};

export type PeriodRow = { key: string; jobs: number; revenue: number; cost: number; grossProfit: number; earned: boolean };

export type JobLedger = {
  jobs: JobRow[];
  /** Balance-sheet positions as of `today`. */
  balances: { deferredRevenue: number; receivable: number; prepaidCost: number; accruedCost: number };
  /** Recognized (earned) jobs grouped by event month: the job-costed P&L. */
  periods: PeriodRow[];
  /** Jobs not yet earned: contracted revenue and planned cost still ahead. */
  backlog: { jobs: number; revenue: number; cost: number; grossProfit: number };
};

export function jobRow(job: Job, today: string): JobRow {
  const earned = job.eventDate <= today;
  let cost = 0;
  let paid = 0;
  let unpaid = 0;
  let missing = 0;
  for (const l of job.lines) {
    const c = lineCost(l, job.revenueCents);
    if (c.missing) missing++;
    const incurred = l.actualCostCents ?? c.planned ?? 0;
    cost += incurred;
    if (l.actualCostCents != null) paid += l.actualCostCents;
    else unpaid += c.planned ?? 0;
  }
  const collected = Math.max(0, job.collectedCents);
  return {
    id: job.id,
    name: job.name,
    eventDate: job.eventDate,
    earned,
    revenue: job.revenueCents,
    cost,
    grossProfit: job.revenueCents - cost,
    margin: job.revenueCents > 0 ? (job.revenueCents - cost) / job.revenueCents : null,
    missing,
    hasPlan: job.lines.length > 0,
    deferredRevenue: earned ? 0 : collected,
    receivable: earned ? Math.max(0, job.revenueCents - collected) : 0,
    prepaidCost: earned ? 0 : paid,
    accruedCost: earned ? unpaid : 0,
  };
}

export function jobLedger(jobs: Job[], today: string): JobLedger {
  const rows = jobs.filter((j) => !j.cancelled).map((j) => jobRow(j, today));
  rows.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const balances = { deferredRevenue: 0, receivable: 0, prepaidCost: 0, accruedCost: 0 };
  const backlog = { jobs: 0, revenue: 0, cost: 0, grossProfit: 0 };
  const byMonth = new Map<string, PeriodRow>();
  for (const r of rows) {
    balances.deferredRevenue += r.deferredRevenue;
    balances.receivable += r.receivable;
    balances.prepaidCost += r.prepaidCost;
    balances.accruedCost += r.accruedCost;
    if (r.earned) {
      const key = r.eventDate.slice(0, 7);
      const p = byMonth.get(key) ?? { key, jobs: 0, revenue: 0, cost: 0, grossProfit: 0, earned: true };
      p.jobs += 1;
      p.revenue += r.revenue;
      p.cost += r.cost;
      p.grossProfit += r.grossProfit;
      byMonth.set(key, p);
    } else {
      backlog.jobs += 1;
      backlog.revenue += r.revenue;
      backlog.cost += r.cost;
      backlog.grossProfit += r.grossProfit;
    }
  }
  return { jobs: rows, balances, periods: [...byMonth.values()].sort((a, b) => b.key.localeCompare(a.key)), backlog };
}
