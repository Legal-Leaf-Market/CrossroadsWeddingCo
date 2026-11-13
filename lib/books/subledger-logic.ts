// Subledgers and the control-account tie-out (2026-11-13, handoff task 3:
// "true subledgers" and "a tie-out report ... make any difference a HARD
// close blocker"). Pure: no database and no runtime imports, so
// `node --experimental-strip-types scripts/verify-subledger.mjs` checks it.
//
// How it works: every journal line on a control account carries a subledger
// key (`job:<booking id>` or `crew:<crew member id>`, set by the posting rules
// in lib/books/accrual.ts). A control account's subledger is its lines grouped
// by key. The control balance and the subledger sum can only differ by lines
// that carry no key, or the wrong kind of key, and either one means the books
// can't say whose money it is. That is the tie-out difference.

export type SubSum = { accountId: string; sub: string | null; debit: number; credit: number };
export type AccountMeta = { id: string; code: string; name: string; type: string; systemKey: string | null };

/** The control accounts, by system key, and what their subledger is kept by. */
export const CONTROL_ACCOUNTS = {
  undeposited_funds: "job",
  accounts_receivable: "job",
  prepaid_job_costs: "job",
  deferred_revenue: "job",
  accrued_job_costs: "job",
  reimbursements_payable: "crew",
  commissions_payable: "crew",
} as const;
export type ControlKey = keyof typeof CONTROL_ACCOUNTS;
export type SubKind = (typeof CONTROL_ACCOUNTS)[ControlKey];

export const isControlKey = (k: string | null): k is ControlKey => !!k && k in CONTROL_ACCOUNTS;

/** "job" for "job:abc", "crew" for "crew:abc", null otherwise. */
export function subKind(sub: string | null): string | null {
  if (!sub) return null;
  const i = sub.indexOf(":");
  return i > 0 ? sub.slice(0, i) : null;
}

export function subId(sub: string): string {
  return sub.slice(sub.indexOf(":") + 1);
}

/** Balance in the account's natural direction: assets and expenses are debits, the rest credits. */
export function natural(type: string, debit: number, credit: number): number {
  return type === "asset" || type === "expense" ? debit - credit : credit - debit;
}

export type TieOutRow = {
  accountId: string;
  code: string;
  name: string;
  systemKey: ControlKey;
  by: SubKind;
  /** The general ledger balance of the control account. */
  control: number;
  /** The sum of its subledger: every keyed line, by key. */
  subledger: number;
  /** control minus subledger. Anything but zero stops the close. */
  difference: number;
  /** Lines with no key, or a key of the wrong kind, net. Equal to the difference. */
  unkeyed: number;
  /** Each subledger party with a balance, largest first. */
  parties: { sub: string; balance: number }[];
};

/** Tie every control account to its subledger. Accounts not yet created are left out. */
export function tieOut(sums: SubSum[], accounts: AccountMeta[]): TieOutRow[] {
  const out: TieOutRow[] = [];
  for (const a of accounts) {
    if (!isControlKey(a.systemKey)) continue;
    const by = CONTROL_ACCOUNTS[a.systemKey];
    let control = 0;
    let unkeyed = 0;
    const per = new Map<string, number>();
    for (const s of sums) {
      if (s.accountId !== a.id) continue;
      const v = natural(a.type, s.debit, s.credit);
      control += v;
      if (s.sub && subKind(s.sub) === by) per.set(s.sub, (per.get(s.sub) ?? 0) + v);
      else unkeyed += v;
    }
    const subledger = [...per.values()].reduce((x, y) => x + y, 0);
    out.push({
      accountId: a.id,
      code: a.code,
      name: a.name,
      systemKey: a.systemKey,
      by,
      control,
      subledger,
      difference: control - subledger,
      unkeyed,
      parties: [...per.entries()]
        .filter(([, v]) => v !== 0)
        .map(([sub, balance]) => ({ sub, balance }))
        .sort((x, y) => Math.abs(y.balance) - Math.abs(x.balance) || x.sub.localeCompare(y.sub)),
    });
  }
  return out.sort((x, y) => x.code.localeCompare(y.code));
}

/** How many control accounts don't tie: the hard close blocker. */
export function tieOutDifferences(rows: TieOutRow[]): number {
  return rows.filter((r) => r.difference !== 0).length;
}

export type JobBalance = {
  jobId: string;
  /** Cash and checks marked paid by hand, not yet matched to a bank deposit (1050). */
  undeposited: number;
  deferredRevenue: number;
  receivable: number;
  prepaidCost: number;
  accruedCost: number;
  /** Revenue recognized on the job (4500), and its matched direct cost (5000). */
  revenue: number;
  cost: number;
};

const JOB_FIELD: Record<string, keyof Omit<JobBalance, "jobId">> = {
  undeposited_funds: "undeposited",
  deferred_revenue: "deferredRevenue",
  accounts_receivable: "receivable",
  prepaid_job_costs: "prepaidCost",
  accrued_job_costs: "accruedCost",
  job_revenue: "revenue",
  job_costs: "cost",
  sales_commissions: "cost",
};

/** Every job's balances, read from the journal lines keyed to it. */
export function jobBalances(sums: SubSum[], accounts: AccountMeta[]): Map<string, JobBalance> {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const out = new Map<string, JobBalance>();
  for (const s of sums) {
    if (subKind(s.sub) !== "job") continue;
    const a = byId.get(s.accountId);
    const field = a?.systemKey ? JOB_FIELD[a.systemKey] : undefined;
    if (!a || !field) continue;
    const id = subId(s.sub!);
    const row = out.get(id) ?? { jobId: id, undeposited: 0, deferredRevenue: 0, receivable: 0, prepaidCost: 0, accruedCost: 0, revenue: 0, cost: 0 };
    row[field] += natural(a.type, s.debit, s.credit);
    out.set(id, row);
  }
  return out;
}

// ── The job costing page, from the ledger ───────────────────────────────────

export type JobInfo = {
  id: string;
  name: string;
  eventDate: string;
  cancelled: boolean;
  archived: boolean;
  /** Contract total, and the cost plan's planned figures (for jobs not yet held). */
  contractCents: number;
  plannedCostCents: number;
  missing: number;
  hasPlan: boolean;
};

export type JobsPageRow = JobInfo & JobBalance & { earned: boolean; grossProfit: number; margin: number | null };

export type JobsPage = {
  rows: JobsPageRow[];
  /** Sum of the rows: what the page shows as each balance. */
  totals: { undeposited: number; deferredRevenue: number; receivable: number; prepaidCost: number; accruedCost: number };
  /** The general ledger balance of each control account, and whether the page ties to it. */
  ledger: { undeposited: number; deferredRevenue: number; receivable: number; prepaidCost: number; accruedCost: number };
  ties: boolean;
  periods: { key: string; jobs: number; revenue: number; cost: number; grossProfit: number }[];
  backlog: { jobs: number; revenue: number; cost: number; grossProfit: number };
};

const ZERO = { undeposited: 0, deferredRevenue: 0, receivable: 0, prepaidCost: 0, accruedCost: 0, revenue: 0, cost: 0 };

/**
 * The job costing page's numbers. Held jobs show what the ledger recognized;
 * jobs still ahead show the contract and the planned cost (nothing is
 * recognized before the event). Every job with a balance is listed, archived or
 * cancelled ones included, so the page's totals are the ledger's balances.
 */
export function jobsPage(jobs: JobInfo[], balances: Map<string, JobBalance>, tie: TieOutRow[], today: string): JobsPage {
  const info = new Map(jobs.map((j) => [j.id, j]));
  const ids = new Set<string>([...jobs.filter((j) => !j.archived && !j.cancelled).map((j) => j.id), ...balances.keys()]);
  const rows: JobsPageRow[] = [];
  for (const id of ids) {
    const j = info.get(id) ?? { id, name: "Unknown booking", eventDate: "", cancelled: false, archived: false, contractCents: 0, plannedCostCents: 0, missing: 0, hasPlan: false };
    const b = balances.get(id) ?? { jobId: id, ...ZERO };
    const earned = !j.cancelled && !!j.eventDate && j.eventDate <= today;
    const revenue = earned || j.cancelled ? b.revenue : j.contractCents;
    const cost = earned || j.cancelled ? b.cost : j.plannedCostCents;
    rows.push({
      ...j,
      ...b,
      earned,
      revenue,
      cost,
      grossProfit: revenue - cost,
      margin: revenue > 0 ? (revenue - cost) / revenue : null,
    });
  }
  rows.sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.name.localeCompare(b.name));
  const totals = { undeposited: 0, deferredRevenue: 0, receivable: 0, prepaidCost: 0, accruedCost: 0 };
  for (const r of rows) {
    totals.undeposited += r.undeposited;
    totals.deferredRevenue += r.deferredRevenue;
    totals.receivable += r.receivable;
    totals.prepaidCost += r.prepaidCost;
    totals.accruedCost += r.accruedCost;
  }
  const ctl = (k: ControlKey) => tie.find((t) => t.systemKey === k)?.control ?? 0;
  const ledger = {
    undeposited: ctl("undeposited_funds"),
    deferredRevenue: ctl("deferred_revenue"),
    receivable: ctl("accounts_receivable"),
    prepaidCost: ctl("prepaid_job_costs"),
    accruedCost: ctl("accrued_job_costs"),
  };
  const ties = (Object.keys(totals) as (keyof typeof totals)[]).every((k) => totals[k] === ledger[k]);

  const byMonth = new Map<string, { key: string; jobs: number; revenue: number; cost: number; grossProfit: number }>();
  const backlog = { jobs: 0, revenue: 0, cost: 0, grossProfit: 0 };
  for (const r of rows) {
    if (r.cancelled) continue;
    if (r.earned) {
      const key = r.eventDate.slice(0, 7);
      const p = byMonth.get(key) ?? { key, jobs: 0, revenue: 0, cost: 0, grossProfit: 0 };
      p.jobs += 1;
      p.revenue += r.revenue;
      p.cost += r.cost;
      p.grossProfit += r.grossProfit;
      byMonth.set(key, p);
    } else if (!r.archived && r.eventDate) {
      backlog.jobs += 1;
      backlog.revenue += r.revenue;
      backlog.cost += r.cost;
      backlog.grossProfit += r.grossProfit;
    }
  }
  return { rows, totals, ledger, ties, periods: [...byMonth.values()].sort((a, b) => b.key.localeCompare(a.key)), backlog };
}

// ── Account registers ───────────────────────────────────────────────────────

export type RegisterLine = { entryId: string; date: string; memo: string; sub: string | null; debit: number; credit: number; createdAt: string };

/**
 * An account's register: oldest first, each line with the running balance in
 * the account's natural direction, starting from the balance brought forward.
 */
export function register(type: string, broughtForward: number, lines: RegisterLine[]): (RegisterLine & { balance: number })[] {
  let bal = broughtForward;
  return [...lines]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.entryId.localeCompare(b.entryId))
    .map((l) => {
      bal += natural(type, l.debit, l.credit);
      return { ...l, balance: bal };
    });
}

// ── CSV out (ETL first: every report has a way out) ─────────────────────────

/** One CSV cell. A cell a spreadsheet would run as a formula is prefixed with ' (numbers stay numbers). */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvOf(head: string[], rows: unknown[][]): string {
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Cents as a plain decimal for a spreadsheet: 123456 -> "1234.56". */
export const dollars = (c: number) => (c / 100).toFixed(2);
