import { createHash } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ledgerPeriods, type LedgerPeriod } from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import {
  canCloseInOrder,
  canReopenInOrder,
  checkCloseAction,
  closeBlockers,
  LOCKED_STATUSES,
  nextPeriod,
  periodEnd,
  periodOf,
  type Blocker,
  type CloseAction,
  type PeriodStatus,
} from "@/lib/books/accrual";
import { ledgerToday, postLedger, reconciliation } from "@/lib/books/ledger";
import { rolesFor } from "@/lib/finance-roles";
import { tieOutReport } from "@/lib/books/subledger";
import { tieOutDifferences } from "@/lib/books/subledger-logic";
import { isPayMethod, lineCost } from "@/lib/costing-logic";

// The month-end close (2026-11-13). Jake prepares, Terry approves or vetoes,
// Nic breaks a tie once Jake escalates a veto. The rules are pure in
// lib/books/accrual.ts; this file gathers the facts, freezes the month's
// numbers with a hash, and writes every step to the audit log. The database
// enforces the lock itself (ledger_period_locked in phase1-schema.sql).

export type PeriodRow = { periodStart: string; status: PeriodStatus; row: LedgerPeriod | null; entries: number };

/** Every month from the first one with books through this one, newest first. */
export async function listPeriods(tenantId: string): Promise<PeriodRow[]> {
  const today = ledgerToday();
  const [first] = (
    await db.execute(sql`
      select least(
        (select min(entry_date) from journal_entries where tenant_id = ${tenantId} and status = 'posted'),
        (select min(posted_date) from bank_transactions where tenant_id = ${tenantId})
      )::text as d`)
  ).rows as { d: string | null }[];
  const counts = (
    await db.execute(sql`
      select date_trunc('month', entry_date)::date::text as p, count(*)::int as n
      from journal_entries where tenant_id = ${tenantId} and status = 'posted' group by 1`)
  ).rows as { p: string; n: number }[];
  const countBy = new Map(counts.map((c) => [c.p, c.n]));
  const rows = await db.select().from(ledgerPeriods).where(eq(ledgerPeriods.tenantId, tenantId)).orderBy(asc(ledgerPeriods.periodStart));
  const rowBy = new Map(rows.map((r) => [r.periodStart, r]));
  const out: PeriodRow[] = [];
  let p = periodOf(first?.d ?? today);
  const last = periodOf(today);
  while (p <= last) {
    const row = rowBy.get(p) ?? null;
    out.push({ periodStart: p, status: (row?.status as PeriodStatus) ?? "open", row, entries: countBy.get(p) ?? 0 });
    p = nextPeriod(p);
  }
  return out.reverse();
}

/**
 * The month's frozen numbers: posted activity per account (debits, credits)
 * and the ids of every posted entry dated in it. Its hash is what the
 * approver signs; if anything in the month moves after the preparer froze
 * it, the hashes differ and the approval is refused.
 */
export async function periodSnapshot(tenantId: string, periodStart: string) {
  const end = periodEnd(periodStart);
  const accounts = (
    await db.execute(sql`
      select a.code, a.name, a.type, coalesce(sum(l.debit_cents),0)::bigint::text as debit, coalesce(sum(l.credit_cents),0)::bigint::text as credit
      from journal_lines l
      join journal_entries e on e.id = l.entry_id
      join ledger_accounts a on a.id = l.account_id
      where e.tenant_id = ${tenantId} and e.status = 'posted' and e.entry_date between ${periodStart} and ${end}
      group by a.code, a.name, a.type order by a.code`)
  ).rows as { code: string; name: string; type: string; debit: string; credit: string }[];
  const ids = (
    await db.execute(sql`
      select id::text from journal_entries
      where tenant_id = ${tenantId} and status = 'posted' and entry_date between ${periodStart} and ${end} order by id`)
  ).rows as { id: string }[];
  const snapshot = {
    period: periodStart,
    accounts: accounts.map((a) => ({ code: a.code, name: a.name, type: a.type, debit: Number(a.debit), credit: Number(a.credit) })),
    entries: ids.map((r) => r.id),
  };
  const hash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  return { snapshot, hash };
}

/** What stands between this month and its close, from the books as they are now. */
export async function periodBlockers(tenantId: string, periodStart: string): Promise<Blocker[]> {
  const end = periodEnd(periodStart);
  const one = async <T,>(q: ReturnType<typeof sql>) => ((await db.execute(q)).rows[0] as T) ?? ({} as T);
  const unbalanced = await one<{ n: number }>(sql`
    select count(*)::int as n from (
      select e.id from journal_entries e join journal_lines l on l.entry_id = e.id
      where e.tenant_id = ${tenantId} and e.status = 'posted' and e.entry_date between ${periodStart} and ${end}
      group by e.id having sum(l.debit_cents) <> sum(l.credit_cents)) x`);
  const lines = await one<{ unreviewed: number; pending: number }>(sql`
    select count(*) filter (where review_status = 'unreviewed' and not pending and posted_date <= ${end})::int as unreviewed,
           count(*) filter (where pending and posted_date between ${periodStart} and ${end})::int as pending
    from bank_transactions where tenant_id = ${tenantId} and removed_at is null`);
  const hasClaims = Boolean(((await db.execute(sql`select to_regclass('expense_claims') is not null as ok`)).rows[0] as { ok: boolean }).ok);
  const claims = hasClaims
    ? await one<{ n: number }>(sql`select count(*)::int as n from expense_claims where tenant_id = ${tenantId} and status = 'submitted' and spent_on <= ${end}`)
    : { n: 0 };
  // Held jobs in the month: is every cost filled in, and is there a plan at all?
  const jobs = (
    await db.execute(sql`
      select w.id, w.total_amount::text as total,
        (select count(*) from event_resources r where r.wedding_id = w.id and r.voided_at is null)::int as lines
      from weddings w
      where w.tenant_id = ${tenantId} and w.status <> 'cancelled' and w.books_excluded_at is null and w.event_date between ${periodStart} and ${end}`)
  ).rows as { id: string; total: string; lines: number }[];
  let uncosted = 0;
  let noPlan = 0;
  for (const j of jobs) {
    if (j.lines === 0) {
      noPlan++;
      continue;
    }
    const rows = (await db.execute(sql`select * from event_resources where wedding_id = ${j.id} and voided_at is null`)).rows as Record<string, unknown>[];
    const revenue = Math.round(Number(j.total) * 100) || 0;
    const missing = rows.some((r) => {
      const c = lineCost(
        {
          kind: r.kind === "material" ? "material" : "labor",
          crewMemberId: (r.crew_member_id as string) ?? null,
          label: String(r.label ?? ""),
          role: String(r.role ?? ""),
          payMethod: isPayMethod(r.pay_method) ? r.pay_method : null,
          rateCents: (r.rate_cents as number) ?? null,
          percentBps: (r.percent_bps as number) ?? null,
          plannedMinutes: (r.planned_minutes as number) ?? null,
          actualMinutes: (r.actual_minutes as number) ?? null,
          unitCostCents: (r.unit_cost_cents as number) ?? null,
          plannedQty: r.planned_qty == null ? null : Number(r.planned_qty),
          actualQty: r.actual_qty == null ? null : Number(r.actual_qty),
          actualCostCents: (r.actual_cost_cents as number) ?? null,
        },
        revenue,
      );
      return c.missing !== null && (r.actual_cost_cents == null);
    });
    if (missing) uncosted++;
  }
  // "Always deposit and match before close": a booking marked paid by hand
  // must have the bank money matched to it.
  const hand = await one<{ n: number }>(sql`
    select count(*)::int as n from weddings w
    where w.tenant_id = ${tenantId} and w.status <> 'cancelled' and w.books_excluded_at is null and w.created_at::date <= ${end}
      and (coalesce(w.is_deposit_paid,false) or coalesce(w.is_balance_paid,false))
      and coalesce((select sum(t.amount_cents) from bank_transactions t
                    where t.booking_id = w.id and t.amount_cents > 0 and t.removed_at is null and not t.pending), 0)
          < round(case when coalesce(w.is_balance_paid,false) then w.total_amount else least(w.deposit_amount, w.total_amount) end * 100)`);
  const clearing = await one<{ bal: string | null }>(sql`
    select coalesce(sum(l.debit_cents - l.credit_cents),0)::bigint::text as bal
    from journal_lines l join journal_entries e on e.id = l.entry_id join ledger_accounts a on a.id = l.account_id
    where e.tenant_id = ${tenantId} and e.status = 'posted' and e.entry_date <= ${end} and a.system_key = 'transfers_clearing'`);
  const recon = await reconciliation(tenantId);
  // Every control account must equal the sum of its subledger at the month's end.
  const tie = await tieOutReport(tenantId, end);
  return closeBlockers({
    unbalancedEntries: unbalanced.n ?? 0,
    unreviewedLines: lines.unreviewed ?? 0,
    pendingLines: lines.pending ?? 0,
    submittedClaims: claims.n ?? 0,
    uncostedJobs: uncosted,
    jobsWithoutPlan: noPlan,
    unmatchedHandPayments: hand.n ?? 0,
    transfersInTransitCents: Number(clearing.bal ?? 0),
    bankDifferences: recon.filter((r) => r.difference !== null && r.difference !== 0).length,
    subledgerDifferences: tieOutDifferences(tie.rows),
  });
}

export type CloseResult = { ok: true; status: PeriodStatus } | { ok: false; status: number; error: string; blockers?: Blocker[] };

/**
 * Take one step in a month's close. Brings the books current first (the live
 * sync), then checks the person's seat, the order of months, the blockers and
 * (for an approval) that nothing moved since the preparer froze the numbers.
 */
export async function closeStep(input: {
  tenantId: string;
  periodStart: string;
  action: CloseAction;
  actorEmail: string;
  note: string;
  acknowledged: string[];
}): Promise<CloseResult> {
  const { tenantId, periodStart, action, actorEmail } = input;
  if (!/^\d{4}-\d{2}-01$/.test(periodStart)) return { ok: false, status: 400, error: "Pick a month" };
  await postLedger(tenantId, { actor: actorEmail, cause: `close: ${action}` });

  const today = ledgerToday();
  const periods = await listPeriods(tenantId);
  const current = periods.find((p) => p.periodStart === periodStart);
  if (!current) return { ok: false, status: 404, error: "No books in that month" };
  const roles = await rolesFor(tenantId, actorEmail);
  const reopenFlow = ["request_reopen", "approve_reopen", "veto_reopen", "escalate_reopen", "tiebreak_reopen", "tiebreak_keep_closed"].includes(action);
  const triggeredBy = reopenFlow ? current.row?.reopenRequestedBy ?? null : current.row?.preparedBy ?? null;
  const check = checkCloseAction({ action, status: current.status, roles, actor: actorEmail, triggeredBy: action === "prepare" || action === "request_reopen" ? null : triggeredBy, note: input.note });
  if (!check.ok) return { ok: false, status: 403, error: check.reason };

  if (action === "prepare" || action === "approve" || action === "tiebreak_close") {
    const earlierOpen = periods
      .filter((p) => p.periodStart < periodStart && p.entries > 0 && !LOCKED_STATUSES.includes(p.status))
      .map((p) => p.periodStart);
    const order = canCloseInOrder(periodStart, today, earlierOpen);
    if (order) return { ok: false, status: 409, error: order };
    const blockers = await periodBlockers(tenantId, periodStart);
    const hard = blockers.filter((b) => b.hard);
    if (hard.length) return { ok: false, status: 409, error: "Clear these first", blockers: hard };
    if (action === "prepare") {
      const unacked = blockers.filter((b) => !input.acknowledged.includes(b.key));
      if (unacked.length) return { ok: false, status: 409, error: "Acknowledge each of these in writing first", blockers: unacked };
    }
  }
  if (action === "request_reopen") {
    const laterLocked = periods.filter((p) => p.periodStart > periodStart && LOCKED_STATUSES.includes(p.status)).map((p) => p.periodStart);
    const order = canReopenInOrder(periodStart, laterLocked);
    if (order) return { ok: false, status: 409, error: order };
  }

  const { snapshot, hash } = await periodSnapshot(tenantId, periodStart);
  if ((action === "approve" || action === "tiebreak_close") && current.row?.preparedHash !== hash) {
    return { ok: false, status: 409, error: "The books for this month changed after it was prepared. It has to be prepared again." };
  }

  const now = new Date();
  const set: Partial<LedgerPeriod> = { status: check.to, updatedAt: now };
  switch (action) {
    case "prepare":
      Object.assign(set, { preparedBy: actorEmail, preparedAt: now, preparedHash: hash, preparedNote: input.note, acknowledged: input.acknowledged, decidedBy: null, decidedAt: null, decisionNote: "" });
      break;
    case "withdraw":
      Object.assign(set, { preparedHash: null });
      break;
    case "approve":
    case "tiebreak_close":
    case "tiebreak_keep_closed":
      Object.assign(set, { decidedBy: actorEmail, decidedAt: now, decisionNote: input.note, closedHash: hash, closedSnapshot: snapshot, closedAt: now, reopenRequestedBy: null, reopenRequestedAt: null, reopenReason: "" });
      break;
    case "veto":
    case "escalate":
    case "veto_reopen":
    case "escalate_reopen":
    case "tiebreak_keep_open":
      Object.assign(set, { decidedBy: actorEmail, decidedAt: now, decisionNote: input.note });
      break;
    case "request_reopen":
      Object.assign(set, { reopenRequestedBy: actorEmail, reopenRequestedAt: now, reopenReason: input.note });
      break;
    case "approve_reopen":
    case "tiebreak_reopen":
      Object.assign(set, { decidedBy: actorEmail, decidedAt: now, decisionNote: input.note, preparedHash: null, closedHash: null, closedAt: null });
      break;
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"ledger:" + tenantId}, 0))`);
    const [before] = await tx.select().from(ledgerPeriods).where(and(eq(ledgerPeriods.tenantId, tenantId), eq(ledgerPeriods.periodStart, periodStart))).limit(1);
    if ((before?.status ?? "open") !== current.status) throw new Error("The month changed while you were deciding. Reload and try again.");
    if (before) {
      await tx.update(ledgerPeriods).set(set).where(and(eq(ledgerPeriods.tenantId, tenantId), eq(ledgerPeriods.periodStart, periodStart)));
    } else {
      await tx.insert(ledgerPeriods).values({ tenantId, periodStart, ...set } as typeof ledgerPeriods.$inferInsert);
    }
    await audit(tx, {
      tenantId,
      actor: actorEmail,
      action: `period.${action}`,
      entityType: "period",
      entityId: periodStart,
      before: before ? { status: before.status, preparedBy: before.preparedBy, preparedHash: before.preparedHash, closedHash: before.closedHash } : { status: "open" },
      after: { status: check.to, hash, acknowledged: action === "prepare" ? input.acknowledged : undefined },
      reason: input.note || null,
    });
  });
  return { ok: true, status: check.to };
}
