// Accrual basis under US GAAP, the live-sync engine's rules, and the period
// close controls (2026-11-13). Pure: no database, no imports, so
// `node --experimental-strip-types scripts/verify-accrual.mjs` checks it.
// docs/FINANCIALS_SPEC.md is the spec.
//
// The owner's words this implements:
// - "force accrual and US GAAP ... we are not a cash basis gl"
// - "we use the matching principle"; "match revenue to expenses by job costing"
// - live sync: every entry is derived and updates with every change "until
//   things are finalized and fully approved in the proper workflow", then a
//   hard cutoff
// - "nic can't trigger cash and it takes both jake's trigger and terry's
//   approval/veto, with nic as a tie breaker"

// ── Accounts the accrual rules post to (system accounts, per tenant) ────────

export const ACCRUAL_ACCOUNTS = {
  accounts_receivable: { code: "1100", name: "Accounts receivable", type: "asset" },
  prepaid_job_costs: { code: "1300", name: "Prepaid job costs", type: "asset" },
  deferred_revenue: { code: "2300", name: "Deferred revenue (client deposits)", type: "liability" },
  accrued_job_costs: { code: "2400", name: "Accrued job costs", type: "liability" },
  reimbursements_payable: { code: "2500", name: "Reimbursements payable", type: "liability" },
  job_revenue: { code: "4500", name: "Event revenue", type: "income" },
  job_costs: { code: "5000", name: "Cost of revenue: job costs", type: "expense" },
  uncategorized_expense: { code: "6990", name: "Uncategorized expense (receipts)", type: "expense" },
} as const;
export type AccrualKey = keyof typeof ACCRUAL_ACCOUNTS;

/**
 * One journal line. `sub` is its subledger key (2026-11-13, true subledgers):
 * `job:<booking id>` on the job accounts (1100, 1300, 2300, 2400, 4500, 5000),
 * `crew:<crew member id>` on reimbursements payable (2500). A control
 * account's balance must equal the sum of its lines' keys; any amount without
 * a key is a tie-out difference and stops the close.
 */
export type Line = { accountId: string; debitCents: number; creditCents: number; sub?: string | null };

/** The accounts whose lines carry the job's key: the four control accounts plus its revenue and direct cost. */
export const JOB_DIMENSION: AccrualKey[] = ["accounts_receivable", "prepaid_job_costs", "deferred_revenue", "accrued_job_costs", "job_revenue", "job_costs"];

export const jobSub = (bookingId: string) => `job:${bookingId}`;
export const crewSub = (crewMemberId: string) => `crew:${crewMemberId}`;

/** Give every line on one of `accounts` the subledger key `sub` (lines that already have one keep it). */
export function withSub(d: Desired, accounts: Iterable<string>, sub: string): Desired {
  if (!d) return d;
  const set = new Set(accounts);
  return { ...d, lines: d.lines.map((l) => (set.has(l.accountId) && !l.sub ? { ...l, sub } : l)) };
}

/** The ids of the job-dimension accounts. */
export function jobAccounts(acct: Record<AccrualKey, string>): string[] {
  return JOB_DIMENSION.map((k) => acct[k]);
}

/** "2026-11-01" for any date in November 2026. */
export function periodOf(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Last calendar day of the period that starts on `periodStart`. */
export function periodEnd(periodStart: string): string {
  const [y, m] = periodStart.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${periodStart.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

export function nextPeriod(periodStart: string): string {
  const [y, m] = periodStart.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** A debit/credit pair; a negative amount flips the sides. Zero gives nothing. */
function pair(debitId: string, creditId: string, cents: number): Line[] {
  if (cents === 0) return [];
  return cents > 0
    ? [
        { accountId: debitId, debitCents: cents, creditCents: 0 },
        { accountId: creditId, debitCents: 0, creditCents: cents },
      ]
    : [
        { accountId: creditId, debitCents: -cents, creditCents: 0 },
        { accountId: debitId, debitCents: 0, creditCents: -cents },
      ];
}

/** Collapse lines to one per account, subledger key and side; drops zero lines. */
export function tidy(lines: Line[]): Line[] {
  const net = netOf(lines);
  return linesFromNet(net);
}

// A line's netting key: the account id alone when it has no subledger key
// (so untagged books net exactly as they always did), else account + key.
const SEP = "\u0001";
const keyOf = (l: Line) => (l.sub ? `${l.accountId}${SEP}${l.sub}` : l.accountId);

/** Net debit (positive) or credit (negative) per account and subledger key. */
export function netOf(lines: Line[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lines) m.set(keyOf(l), (m.get(keyOf(l)) ?? 0) + l.debitCents - l.creditCents);
  return m;
}

/** Net per account only, whatever the subledger keys. */
export function netByAccount(lines: Line[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.accountId, (m.get(l.accountId) ?? 0) + l.debitCents - l.creditCents);
  return m;
}

export function linesFromNet(net: Map<string, number>): Line[] {
  return [...net.entries()]
    .filter(([, v]) => v !== 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, v]) => {
      const i = key.indexOf(SEP);
      const accountId = i < 0 ? key : key.slice(0, i);
      const sub = i < 0 ? undefined : key.slice(i + 1);
      const base = v > 0 ? { accountId, debitCents: v, creditCents: 0 } : { accountId, debitCents: 0, creditCents: -v };
      return sub ? { ...base, sub } : base;
    });
}

// cyrb53 (public domain): a fast 53-bit string hash. Two seeds give about 106
// bits, plenty to tell one source's posting from its next version.
function cyrb53(s: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/**
 * The column holds 200 characters. A fingerprint that fits is stored as is
 * (so every existing one still compares equal); a longer one (many lines, or
 * subledger keys) is stored as its hash, never cut off: a cut-off fingerprint
 * can never match its own source again, which would repost it on every run.
 */
export function compactFingerprint(s: string): string {
  return s.length <= 200 ? s : `h:${s.length}:${cyrb53(s, 1)}${cyrb53(s, 2)}`;
}

// ── Bank lines matched to a job ──────────────────────────────────────────────

/**
 * Which account a matched bank line posts against instead of its category.
 * Client money before (or on) the event day is a contract liability; after it,
 * it settles the receivable the recognition entry raised. Money out to a job
 * before the event is a prepaid cost; after it, it settles the accrual. A
 * cancelled job's money is deferred until the cancellation recognizes it.
 */
export function matchedBankAccount(line: { amountCents: number; postedDate: string }, job: { eventDate: string; cancelled: boolean }): AccrualKey {
  const before = job.cancelled || line.postedDate <= job.eventDate;
  if (line.amountCents > 0) return before ? "deferred_revenue" : "accounts_receivable";
  return before ? "prepaid_job_costs" : "accrued_job_costs";
}

// ── Job recognition (ASC 606 point in time, and the matching principle) ──────

export type JobFacts = {
  totalCents: number;
  eventDate: string;
  cancelled: boolean;
  /** Calendar date the booking was cancelled, venue time; null when not cancelled or unknown. */
  cancelledOn: string | null;
  /** Client payments matched from the bank. */
  payments: { date: string; cents: number }[];
  /** Direct cost of the job: cost-plan lines (paid amount, else planned) plus job-linked receipts before the event. */
  costCents: number;
  /** Money out matched to the job, and approved job receipts, dated on or before the event. */
  prepaid: { date: string; cents: number }[];
};

export type Desired = { date: string; memo: string; lines: Line[] } | null;

const sum = (xs: { cents: number }[]) => xs.reduce((s, x) => s + x.cents, 0);

/**
 * The revenue entry for one job, as of `today`. Held job: on the event date,
 * recognize the whole contract; what was collected by then comes out of
 * deferred revenue, the rest is a receivable. Cancelled job: what was kept is
 * earned on the cancellation date. Not yet held: nothing (deposits sit in
 * deferred revenue from their own bank entries).
 */
export function jobRevenueEntry(job: JobFacts, name: string, acct: Record<AccrualKey, string>, today: string): Desired {
  if (job.cancelled) {
    const kept = sum(job.payments);
    const on = job.cancelledOn ?? job.eventDate;
    if (kept <= 0 || on > today) return null;
    return { date: on, memo: `Cancelled: ${name}, payments kept`, lines: pair(acct.deferred_revenue, acct.job_revenue, kept) };
  }
  if (job.eventDate > today || job.totalCents <= 0) return null;
  const collected = sum(job.payments.filter((p) => p.date <= job.eventDate));
  const lines = tidy([...pair(acct.deferred_revenue, acct.job_revenue, collected), ...pair(acct.accounts_receivable, acct.job_revenue, job.totalCents - collected)]);
  return { date: job.eventDate, memo: `Revenue earned: ${name}`, lines };
}

/**
 * The cost entry for one job: on the event date, expense its direct cost
 * against the revenue, releasing what was prepaid and accruing the rest. A
 * cancelled job expenses whatever was prepaid on the cancellation date.
 */
export function jobCostEntry(job: JobFacts, name: string, acct: Record<AccrualKey, string>, today: string): Desired {
  const prepaid = sum(job.prepaid);
  if (job.cancelled) {
    const on = job.cancelledOn ?? job.eventDate;
    if (prepaid <= 0 || on > today) return null;
    return { date: on, memo: `Cancelled: ${name}, prepaid costs written off`, lines: pair(acct.job_costs, acct.prepaid_job_costs, prepaid) };
  }
  if (job.eventDate > today || (job.costCents === 0 && prepaid === 0)) return null;
  const lines = tidy([...pair(acct.job_costs, acct.prepaid_job_costs, prepaid), ...pair(acct.job_costs, acct.accrued_job_costs, job.costCents - prepaid)]);
  return lines.length ? { date: job.eventDate, memo: `Job costs matched: ${name}`, lines } : null;
}

/**
 * An approved expense report. The expense is incurred when spent and owed back
 * to the person from approval: Dr the expense (or the job's prepaid cost before
 * the event, or the job's cost after it) / Cr reimbursements payable.
 */
export function claimEntry(
  claim: { amountCents: number; spentOn: string; merchant: string; claimant: string; categoryAccountId: string | null; job: { eventDate: string; cancelled: boolean; name: string } | null },
  acct: Record<AccrualKey, string>,
): Desired {
  let debit = claim.categoryAccountId ?? acct.uncategorized_expense;
  let memo = `${claim.claimant}: ${claim.merchant || "receipt"}`;
  if (claim.job) {
    debit = !claim.job.cancelled && claim.spentOn <= claim.job.eventDate ? acct.prepaid_job_costs : acct.job_costs;
    memo += ` (${claim.job.name})`;
  }
  return { date: claim.spentOn, memo, lines: pair(debit, acct.reimbursements_payable, claim.amountCents) };
}

// ── Subledger keys on every posting (2026-11-13) ─────────────────────────────
// The rules above say which accounts move; these say whose line it is, so the
// control accounts can be tied to their subledgers. postLedger calls these.

/** A bank line matched to a job: the bank against the job's control account, keyed to the job. */
export function matchedBankEntry(
  line: { amountCents: number; postedDate: string; memo: string },
  job: { id: string; eventDate: string; cancelled: boolean },
  bankAccountId: string,
  acct: Record<AccrualKey, string>,
): Desired {
  const other = acct[matchedBankAccount(line, job)];
  return withSub({ date: line.postedDate, memo: line.memo, lines: pair(bankAccountId, other, line.amountCents) }, [other], jobSub(job.id));
}

/** A job's revenue and cost entries, keyed to the job on every job account. */
export function jobEntries(job: JobFacts, id: string, name: string, acct: Record<AccrualKey, string>, today: string): { revenue: Desired; cost: Desired } {
  const accounts = jobAccounts(acct);
  return {
    revenue: withSub(jobRevenueEntry(job, name, acct, today), accounts, jobSub(id)),
    cost: withSub(jobCostEntry(job, name, acct, today), accounts, jobSub(id)),
  };
}

/** An approved expense report: the job side keyed to the job, the amount owed keyed to the person. */
export function keyedClaimEntry(
  claim: Parameters<typeof claimEntry>[0] & { jobId: string | null; personKey: string | null },
  acct: Record<AccrualKey, string>,
): Desired {
  let d = claimEntry(claim, acct);
  if (claim.jobId) d = withSub(d, jobAccounts(acct), jobSub(claim.jobId));
  if (claim.personKey) d = withSub(d, [acct.reimbursements_payable], claim.personKey);
  return d;
}

/**
 * A bank payout that repaid expense reports: credit the bank, debit what each
 * person was owed, keyed to them. A payout may cover more than the reports;
 * with one person the extra is theirs (an advance), with several nobody can
 * say whose it is, so it stays unkeyed and shows as a tie-out difference.
 */
export function payoutEntry(
  line: { amountCents: number; postedDate: string; memo: string },
  claims: { amountCents: number; personKey: string | null }[],
  bankAccountId: string,
  acct: Record<AccrualKey, string>,
): Desired {
  const rp = acct.reimbursements_payable;
  if (line.amountCents >= 0) return { date: line.postedDate, memo: line.memo, lines: pair(bankAccountId, rp, line.amountCents) };
  const paid = -line.amountCents;
  const lines: Line[] = [{ accountId: bankAccountId, debitCents: 0, creditCents: paid }];
  const people = [...new Set(claims.map((c) => c.personKey))];
  let covered = 0;
  for (const c of claims) {
    const cents = Math.min(c.amountCents, paid - covered);
    if (cents <= 0) break;
    lines.push({ accountId: rp, debitCents: cents, creditCents: 0, sub: c.personKey });
    covered += cents;
  }
  if (paid > covered) lines.push({ accountId: rp, debitCents: paid - covered, creditCents: 0, sub: people.length === 1 ? people[0] : null });
  return { date: line.postedDate, memo: line.memo, lines: tidy(lines) };
}

// ── Live sync with a hard cutoff ─────────────────────────────────────────────

export type LiveEntry = { id: string; date: string; fingerprint: string | null; lines: Line[] };

export type PostPlan = {
  void: string[];
  post: { date: string; memo: string; fingerprint: string; lines: Line[]; adjustsPeriod: string | null; kind: "original" | "adjustment" }[];
};

/** What a posting is: its date and its net lines, with subledger keys. Never longer than 200 characters. */
export function fingerprint(d: NonNullable<Desired>): string {
  return compactFingerprint(`${d.date}|${tidy(d.lines).map((l) => `${l.accountId}${l.sub ? `#${l.sub}` : ""}:${l.debitCents - l.creditCents}`).join(",")}`);
}

/**
 * Bring one source's postings in line with what it should be. While every
 * entry for the source sits in an open month, the entry simply follows the
 * source (void and repost: the live sync). Once any of them is in a locked
 * month, that history stays exactly as it is and the difference is posted as
 * one correcting entry dated `today`, naming the closed month it corrects. A
 * source that first appears dated inside a locked month posts today, saying so.
 */
export function planPosting(desired: Desired, live: LiveEntry[], locked: (date: string) => boolean, today: string): PostPlan {
  const plan: PostPlan = { void: [], post: [] };
  if (locked(today)) throw new Error("Today's month is closed; nothing can post until it is reopened");
  const want = desired ? { ...desired, lines: tidy(desired.lines) } : null;
  const fp = want && want.lines.length ? fingerprint(want) : null;
  const closed = live.filter((e) => locked(e.date));
  const open = live.filter((e) => !locked(e.date));

  if (closed.length === 0) {
    if (open.length === 1 && fp && open[0].fingerprint === fp) return plan;
    if (open.length === 0 && !fp) return plan;
    plan.void.push(...open.map((e) => e.id));
    if (want && fp) {
      const late = locked(want.date);
      plan.post.push({
        date: late ? today : want.date,
        memo: late ? `${want.memo} (dated ${want.date}, recorded after that month closed)` : want.memo,
        fingerprint: fp,
        lines: want.lines,
        adjustsPeriod: late ? periodOf(want.date) : null,
        kind: "original",
      });
    }
    return plan;
  }

  const base = netOf(closed.flatMap((e) => e.lines));
  const target = netOf(want?.lines ?? []);
  const delta = new Map<string, number>();
  for (const k of new Set([...base.keys(), ...target.keys()])) delta.set(k, (target.get(k) ?? 0) - (base.get(k) ?? 0));
  const deltaLines = linesFromNet(delta);
  const adjFp = compactFingerprint(`adj|${fp ?? "none"}`);
  if (open.length === 1 && open[0].fingerprint === adjFp) return plan;
  if (open.length === 0 && deltaLines.length === 0) return plan;
  plan.void.push(...open.map((e) => e.id));
  if (deltaLines.length) {
    const corrected = periodOf(closed.map((e) => e.date).sort()[closed.length - 1]);
    plan.post.push({
      date: today,
      memo: `Correction to ${corrected.slice(0, 7)} (closed): ${want?.memo ?? "source no longer posts"}`,
      fingerprint: adjFp,
      lines: deltaLines,
      adjustsPeriod: corrected,
      kind: "adjustment",
    });
  }
  return plan;
}

// ── The close: who may do what ───────────────────────────────────────────────

export type Role = "preparer" | "approver" | "tiebreaker";
export type PeriodStatus = "open" | "prepared" | "vetoed" | "escalated" | "closed" | "reopen_requested" | "reopen_vetoed" | "reopen_escalated";
export type CloseAction =
  | "prepare"
  | "withdraw"
  | "approve"
  | "veto"
  | "escalate"
  | "tiebreak_close"
  | "tiebreak_keep_open"
  | "request_reopen"
  | "approve_reopen"
  | "veto_reopen"
  | "escalate_reopen"
  | "tiebreak_reopen"
  | "tiebreak_keep_closed";

/** Months the database refuses to write into. */
export const LOCKED_STATUSES: PeriodStatus[] = ["closed", "reopen_requested", "reopen_vetoed", "reopen_escalated"];

const RULES: Record<CloseAction, { from: PeriodStatus[]; role: Role; to: PeriodStatus; needsNote?: boolean; notSelf?: boolean }> = {
  // Jake triggers.
  prepare: { from: ["open", "vetoed"], role: "preparer", to: "prepared" },
  withdraw: { from: ["prepared", "vetoed"], role: "preparer", to: "open" },
  escalate: { from: ["vetoed"], role: "preparer", to: "escalated", needsNote: true },
  request_reopen: { from: ["closed"], role: "preparer", to: "reopen_requested", needsNote: true },
  escalate_reopen: { from: ["reopen_vetoed"], role: "preparer", to: "reopen_escalated", needsNote: true },
  // Terry approves or vetoes. Never his own trigger.
  approve: { from: ["prepared"], role: "approver", to: "closed", notSelf: true },
  veto: { from: ["prepared"], role: "approver", to: "vetoed", needsNote: true, notSelf: true },
  approve_reopen: { from: ["reopen_requested"], role: "approver", to: "open", notSelf: true },
  veto_reopen: { from: ["reopen_requested"], role: "approver", to: "reopen_vetoed", needsNote: true, notSelf: true },
  // Nic breaks a tie, only once Jake has escalated Terry's veto.
  tiebreak_close: { from: ["escalated"], role: "tiebreaker", to: "closed", needsNote: true, notSelf: true },
  tiebreak_keep_open: { from: ["escalated"], role: "tiebreaker", to: "open", needsNote: true, notSelf: true },
  tiebreak_reopen: { from: ["reopen_escalated"], role: "tiebreaker", to: "open", needsNote: true, notSelf: true },
  tiebreak_keep_closed: { from: ["reopen_escalated"], role: "tiebreaker", to: "closed", needsNote: true, notSelf: true },
};

export const ACTION_LABEL: Record<CloseAction, string> = {
  prepare: "Prepare the close",
  withdraw: "Withdraw",
  approve: "Approve and close",
  veto: "Veto",
  escalate: "Escalate to the tie-breaker",
  tiebreak_close: "Break the tie: close",
  tiebreak_keep_open: "Break the tie: keep open",
  request_reopen: "Request a reopen",
  approve_reopen: "Approve the reopen",
  veto_reopen: "Veto the reopen",
  escalate_reopen: "Escalate to the tie-breaker",
  tiebreak_reopen: "Break the tie: reopen",
  tiebreak_keep_closed: "Break the tie: keep closed",
};

export type CloseCheck =
  | { ok: true; to: PeriodStatus }
  | { ok: false; reason: string };

/**
 * May this person take this action on this month now? `triggeredBy` is who
 * prepared the close or asked for the reopen. Blockers and the period order
 * are checked separately (closeBlockers, canCloseInOrder).
 */
export function checkCloseAction(input: {
  action: CloseAction;
  status: PeriodStatus;
  roles: Set<Role>;
  actor: string;
  triggeredBy: string | null;
  note: string;
}): CloseCheck {
  const r = RULES[input.action];
  if (!r) return { ok: false, reason: "Unknown action" };
  if (!r.from.includes(input.status)) return { ok: false, reason: `Not possible while the month is ${input.status.replace(/_/g, " ")}` };
  if (!input.roles.has(r.role)) {
    const who = r.role === "preparer" ? "the preparer (Jake)" : r.role === "approver" ? "the approver (Terry)" : "the tie-breaker (Nic)";
    return { ok: false, reason: `Only ${who} can do this` };
  }
  if (r.notSelf && input.triggeredBy && input.triggeredBy.toLowerCase() === input.actor.toLowerCase()) {
    return { ok: false, reason: "The person who triggered it cannot also approve it" };
  }
  if (r.needsNote && input.note.trim().length < 10) return { ok: false, reason: "Say why, in at least a sentence" };
  return { ok: true, to: r.to };
}

/** Actions this person could take on a month in this status (for showing buttons). */
export function availableActions(status: PeriodStatus, roles: Set<Role>): CloseAction[] {
  return (Object.keys(RULES) as CloseAction[]).filter((a) => RULES[a].from.includes(status) && roles.has(RULES[a].role));
}

/**
 * Months close in order and only once they are over: a month can be prepared
 * when it has ended and every earlier month with activity is closed. Only the
 * latest closed month can be reopened.
 */
export function canCloseInOrder(periodStart: string, today: string, earlierOpen: string[]): string | null {
  if (periodEnd(periodStart) >= today) return "This month isn't over yet";
  if (earlierOpen.length) return `Close ${earlierOpen.sort()[0].slice(0, 7)} first`;
  return null;
}

export function canReopenInOrder(periodStart: string, laterLocked: string[]): string | null {
  return laterLocked.length ? `Reopen ${laterLocked.sort().reverse()[0].slice(0, 7)} first` : null;
}

export type Blocker = { key: string; label: string; count: number; hard: boolean };

/**
 * What stands between a month and its close. Hard ones stop it; soft ones
 * must each be acknowledged in writing by whoever prepares it.
 */
export function closeBlockers(f: {
  unbalancedEntries: number;
  unreviewedLines: number;
  pendingLines: number;
  submittedClaims: number;
  uncostedJobs: number;
  jobsWithoutPlan: number;
  /** Bookings marked paid by hand with no matching bank deposit ("always deposit and match before close"). */
  unmatchedHandPayments: number;
  transfersInTransitCents: number;
  bankDifferences: number;
  /** Control accounts (1100, 1300, 2300, 2400, 2500) whose balance differs from the sum of their subledger. */
  subledgerDifferences?: number;
}): Blocker[] {
  const all: Blocker[] = [
    { key: "unbalanced", label: "Journal entries that don't balance", count: f.unbalancedEntries, hard: true },
    { key: "tie_out", label: "Control accounts that don't tie to their subledgers", count: f.subledgerDifferences ?? 0, hard: true },
    { key: "unreviewed", label: "Bank lines still waiting to be sorted", count: f.unreviewedLines, hard: true },
    { key: "claims", label: "Expense reports waiting for approval", count: f.submittedClaims, hard: true },
    { key: "uncosted", label: "Held jobs with a cost not filled in", count: f.uncostedJobs, hard: true },
    { key: "hand_payments", label: "Payments marked paid by hand that aren't deposited and matched", count: f.unmatchedHandPayments, hard: true },
    { key: "no_plan", label: "Held jobs with no cost plan at all", count: f.jobsWithoutPlan, hard: false },
    { key: "pending", label: "Bank lines still pending", count: f.pendingLines, hard: false },
    { key: "transfers", label: "Money in transfers in transit", count: f.transfersInTransitCents === 0 ? 0 : 1, hard: false },
    { key: "bank", label: "Bank accounts where the books and the bank differ today", count: f.bankDifferences, hard: false },
  ];
  return all.filter((b) => b.count > 0);
}
