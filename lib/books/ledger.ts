import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bankAccounts,
  bankTransactions,
  eventResources,
  journalEntries,
  journalLines,
  ledgerAccounts,
  ledgerCategories,
  ledgerPeriods,
  weddings,
  type LedgerAccount,
} from "@/lib/db/schema";
import { randomUUID } from "node:crypto";
import { audit } from "@/lib/audit";
import {
  ACCRUAL_ACCOUNTS,
  crewSub,
  jobEntries,
  keyedClaimEntry,
  LOCKED_STATUSES,
  matchedBankEntry,
  payoutEntry,
  periodOf,
  planPosting,
  type AccrualKey,
  type Desired,
  type JobFacts,
  type Line,
  type LiveEntry,
} from "@/lib/books/accrual";
import { ACCOUNT_RANGES, accountTypeForBank, type AccountType } from "@/lib/books/ledger-constants";
import { bankLinePosting, type LineInput } from "@/lib/books/logic";
import { isPayMethod, lineCost } from "@/lib/costing-logic";
export { bankLinePosting } from "@/lib/books/logic";

// The ledger: double entry, ACCRUAL basis under US GAAP (2026-11-13; it was cash
// basis until then), append-only. The spec is
// docs/FINANCIALS_SPEC.md; this file is its implementation, and where they
// disagree, the spec is what was decided.
//
// Entries are DERIVED from sorted bank lines by postBankLedger(), which can be
// run any number of times: it voids entries whose source changed and posts
// what is missing. That is what makes it safe to call after every sort, every
// rule run and every sync, and to run again on page load to heal anything a
// failed call left behind.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = typeof db | Tx;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function nextCode(taken: Set<string>, type: keyof typeof ACCOUNT_RANGES): string {
  const [start, end] = ACCOUNT_RANGES[type];
  for (let n = start; n <= end; n += 10) {
    const code = String(n);
    if (!taken.has(code)) {
      taken.add(code);
      return code;
    }
  }
  // A full range is thousands of accounts; fall back to single steps rather than fail a sort.
  for (let n = start; n <= end; n++) {
    const code = String(n);
    if (!taken.has(code)) {
      taken.add(code);
      return code;
    }
  }
  throw new Error(`No ${type} account codes left`);
}

async function systemAccount(ex: Exec, tenantId: string, key: "transfers_clearing" | "opening_equity", taken: Set<string>) {
  const [found] = await ex
    .select()
    .from(ledgerAccounts)
    .where(and(eq(ledgerAccounts.tenantId, tenantId), eq(ledgerAccounts.systemKey, key)))
    .limit(1);
  if (found) return found;
  const spec =
    key === "transfers_clearing"
      ? { code: "1900", name: "Transfers in transit", type: "asset" as AccountType }
      : { code: "3900", name: "Opening balance equity", type: "equity" as AccountType };
  const code = taken.has(spec.code) ? nextCode(taken, spec.type) : spec.code;
  taken.add(code);
  const [row] = await ex
    .insert(ledgerAccounts)
    .values({ tenantId, code, name: spec.name, type: spec.type, systemKey: key })
    .onConflictDoNothing()
    .returning();
  if (row) return row;
  const [again] = await ex
    .select()
    .from(ledgerAccounts)
    .where(and(eq(ledgerAccounts.tenantId, tenantId), eq(ledgerAccounts.systemKey, key)))
    .limit(1);
  return again;
}

/**
 * Make sure every category and every bank account this tenant has is mapped to
 * a ledger account, creating accounts as needed. Idempotent.
 */
export async function ensureLedger(ex: Exec, tenantId: string): Promise<void> {
  const existing = await ex.select({ code: ledgerAccounts.code }).from(ledgerAccounts).where(eq(ledgerAccounts.tenantId, tenantId));
  const taken = new Set(existing.map((a) => a.code));
  const clearing = await systemAccount(ex, tenantId, "transfers_clearing", taken);
  await systemAccount(ex, tenantId, "opening_equity", taken);

  const cats = await ex
    .select()
    .from(ledgerCategories)
    .where(and(eq(ledgerCategories.tenantId, tenantId), isNull(ledgerCategories.ledgerAccountId)))
    .orderBy(asc(ledgerCategories.sortOrder), asc(ledgerCategories.name));
  for (const c of cats) {
    let accountId: string;
    let code: string;
    if (c.kind === "transfer") {
      accountId = clearing.id;
      code = clearing.code;
    } else {
      const type = c.kind as AccountType;
      code = nextCode(taken, type);
      const [acct] = await ex.insert(ledgerAccounts).values({ tenantId, code, name: c.name.slice(0, 120), type }).returning();
      accountId = acct.id;
    }
    await ex
      .update(ledgerCategories)
      .set({ ledgerAccountId: accountId, glCode: code, updatedAt: new Date() })
      .where(and(eq(ledgerCategories.id, c.id), eq(ledgerCategories.tenantId, tenantId)));
  }

  const banks = await ex
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.tenantId, tenantId), isNull(bankAccounts.ledgerAccountId)));
  for (const b of banks) {
    const type = accountTypeForBank(b.type);
    const code = nextCode(taken, type);
    const name = `${b.name}${b.mask ? ` ${b.mask}` : ""}`.slice(0, 120);
    const [acct] = await ex.insert(ledgerAccounts).values({ tenantId, code, name, type }).returning();
    await ex
      .update(bankAccounts)
      .set({ ledgerAccountId: acct.id, updatedAt: new Date() })
      .where(and(eq(bankAccounts.id, b.id), eq(bankAccounts.tenantId, tenantId)));
  }
}



async function insertEntry(
  tx: Tx,
  tenantId: string,
  e: { entryDate: string; memo: string; sourceType: string; sourceId: string; fingerprint: string; createdBy?: string | null; sourceRef?: string; adjustsPeriod?: string | null },
  lines: (LineInput & { sub?: string | null })[],
): Promise<string> {
  const d = lines.reduce((s, l) => s + l.debitCents, 0);
  const c = lines.reduce((s, l) => s + l.creditCents, 0);
  if (d !== c || lines.length < 2) throw new Error("Refusing to post an unbalanced entry");
  const [entry] = await tx
    .insert(journalEntries)
    .values({
      tenantId,
      entryDate: e.entryDate,
      memo: e.memo.slice(0, 500),
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      sourceRef: e.sourceRef ?? `${e.sourceType}:${e.sourceId}`,
      adjustsPeriod: e.adjustsPeriod ?? null,
      fingerprint: e.fingerprint.slice(0, 200),
      createdBy: e.createdBy ?? null,
    })
    .returning({ id: journalEntries.id });
  await tx.insert(journalLines).values(
    lines.map((l) => ({
      entryId: entry.id,
      tenantId,
      accountId: l.accountId,
      debitCents: l.debitCents,
      creditCents: l.creditCents,
      subRef: l.sub ? l.sub.slice(0, 80) : null,
    })),
  );
  return entry.id;
}

async function lockTenant(tx: Tx, tenantId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"ledger:" + tenantId}, 0))`);
}

// ── Accrual posting: the live sync ─────────────────────────────────────────
// Every entry below is DERIVED from a source and rebuilt on every call, so the
// books follow every change while a month is open. planPosting (pure, in
// lib/books/accrual.ts) decides, per source, whether to leave it, void and
// repost it, or, once its month is locked, post a dated correction instead.
// The database refuses any write into a locked month regardless.

const DERIVED_TYPES = ["bank_transaction", "job_revenue", "job_cost", "expense_claim", "adjustment"];

async function accrualAccounts(ex: Exec, tenantId: string): Promise<Record<AccrualKey, string>> {
  const existing = await ex.select({ code: ledgerAccounts.code }).from(ledgerAccounts).where(eq(ledgerAccounts.tenantId, tenantId));
  const taken = new Set(existing.map((a) => a.code));
  const out = {} as Record<AccrualKey, string>;
  for (const key of Object.keys(ACCRUAL_ACCOUNTS) as AccrualKey[]) {
    const [found] = await ex
      .select({ id: ledgerAccounts.id })
      .from(ledgerAccounts)
      .where(and(eq(ledgerAccounts.tenantId, tenantId), eq(ledgerAccounts.systemKey, key)))
      .limit(1);
    if (found) {
      out[key] = found.id;
      continue;
    }
    const spec = ACCRUAL_ACCOUNTS[key];
    const code = taken.has(spec.code) ? nextCode(taken, spec.type === "expense" ? "expense" : spec.type) : spec.code;
    taken.add(code);
    const [row] = await ex
      .insert(ledgerAccounts)
      .values({ tenantId, code, name: spec.name, type: spec.type, systemKey: key })
      .onConflictDoNothing()
      .returning({ id: ledgerAccounts.id });
    out[key] = row?.id ?? (await ex.select({ id: ledgerAccounts.id }).from(ledgerAccounts).where(and(eq(ledgerAccounts.tenantId, tenantId), eq(ledgerAccounts.systemKey, key))).limit(1))[0].id;
  }
  return out;
}

/** Today as a calendar date in the venue's time zone (bank dates are calendar dates). */
export function ledgerToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Indiana/Indianapolis" }).format(new Date());
}

async function tableExists(ex: Exec, name: string): Promise<boolean> {
  const r = await ex.execute(sql`select to_regclass(${name}) is not null as ok`);
  return Boolean((r.rows[0] as { ok?: boolean } | undefined)?.ok);
}

type Source = { ref: string; type: string; id: string; desired: Desired };

/**
 * Bring the whole journal in line with its sources: bank lines, jobs (revenue
 * and matched costs), and approved expense reports. Serialized per tenant,
 * one transaction, every post, void and correction written to the audit log.
 */
export async function postLedger(
  tenantId: string,
  opts: { actor?: string; cause?: string } = {},
): Promise<{ posted: number; voided: number; corrected: number }> {
  return db.transaction(async (tx) => {
    await lockTenant(tx, tenantId);
    await ensureLedger(tx, tenantId);
    const acct = await accrualAccounts(tx, tenantId);
    const today = ledgerToday();
    const lockedRows = await tx
      .select({ p: ledgerPeriods.periodStart })
      .from(ledgerPeriods)
      .where(and(eq(ledgerPeriods.tenantId, tenantId), inArray(ledgerPeriods.status, LOCKED_STATUSES)));
    const lockedSet = new Set(lockedRows.map((r) => r.p));
    const locked = (d: string) => lockedSet.has(periodOf(d));

    const jobs = await tx.select().from(weddings).where(eq(weddings.tenantId, tenantId));
    const jobById = new Map(jobs.map((j) => [j.id, j]));
    const cancelledOn = (j: (typeof jobs)[number]) =>
      j.cancelledAt ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Indiana/Indianapolis" }).format(j.cancelledAt) : null;

    const lines = await tx
      .select({
        id: bankTransactions.id,
        postedDate: bankTransactions.postedDate,
        amountCents: bankTransactions.amountCents,
        merchant: bankTransactions.merchant,
        description: bankTransactions.description,
        pending: bankTransactions.pending,
        removedAt: bankTransactions.removedAt,
        reviewStatus: bankTransactions.reviewStatus,
        bankLedgerId: bankAccounts.ledgerAccountId,
        catLedgerId: ledgerCategories.ledgerAccountId,
        bookingId: bankTransactions.bookingId,
        paymentKind: bankTransactions.paymentKind,
      })
      .from(bankTransactions)
      .innerJoin(bankAccounts, eq(bankTransactions.bankAccountId, bankAccounts.id))
      .leftJoin(ledgerCategories, eq(bankTransactions.categoryId, ledgerCategories.id))
      .where(eq(bankTransactions.tenantId, tenantId));

    // Expense reports (built alongside; the table may not exist on an older database).
    type Claim = { id: string; amount_cents: number; spent_on: string; merchant: string; claimant_name: string; cat_ledger_id: string | null; wedding_id: string | null; reimbursed_bank_transaction_id: string | null; crew_member_id: string | null };
    const claims: Claim[] = (await tableExists(tx, "expense_claims"))
      ? ((
          await tx.execute(sql`
            select c.id, c.amount_cents, c.spent_on::text as spent_on, c.merchant, c.claimant_name, lc.ledger_account_id as cat_ledger_id,
                   c.wedding_id, c.reimbursed_bank_transaction_id, c.crew_member_id
            from expense_claims c left join ledger_categories lc on lc.id = c.category_id
            where c.tenant_id = ${tenantId} and c.kind = 'reimbursement' and c.status = 'approved'
            order by c.submitted_at, c.id`)
        ).rows as Claim[])
      : [];
    // Whose money a claim is: the crew member (crew rows are never deleted, so the id holds).
    const personKey = (c: Claim) => (c.crew_member_id ? crewSub(c.crew_member_id) : null);
    const reimbursing = new Map<string, Claim[]>();
    for (const c of claims) {
      if (c.reimbursed_bank_transaction_id) reimbursing.set(c.reimbursed_bank_transaction_id, [...(reimbursing.get(c.reimbursed_bank_transaction_id) ?? []), c]);
    }

    const sources: Source[] = [];
    const payments = new Map<string, { date: string; cents: number }[]>();
    const prepaid = new Map<string, { date: string; cents: number }[]>();
    const push = (m: Map<string, { date: string; cents: number }[]>, k: string, v: { date: string; cents: number }) => m.set(k, [...(m.get(k) ?? []), v]);

    for (const l of lines) {
      const live = !l.pending && !l.removedAt && l.amountCents !== 0 && l.reviewStatus !== "excluded" && !!l.bankLedgerId;
      const job = l.bookingId ? jobById.get(l.bookingId) : undefined;
      let desired: Desired = null;
      if (live && job) {
        desired = matchedBankEntry(
          {
            amountCents: l.amountCents,
            postedDate: l.postedDate,
            memo: `${l.merchant || l.description || "Bank transaction"} (${job.coupleNames}, ${l.amountCents > 0 ? (l.paymentKind === "deposit" ? "deposit" : "payment") : "job cost"})`,
          },
          { id: job.id, eventDate: job.eventDate, cancelled: job.status === "cancelled" },
          l.bankLedgerId!,
          acct,
        );
        if (l.amountCents > 0) push(payments, job.id, { date: l.postedDate, cents: l.amountCents });
        else if (l.postedDate <= job.eventDate) push(prepaid, job.id, { date: l.postedDate, cents: -l.amountCents });
      } else if (live && reimbursing.has(l.id)) {
        desired = payoutEntry(
          { amountCents: l.amountCents, postedDate: l.postedDate, memo: `${l.merchant || l.description || "Reimbursement"} (expense reimbursement)` },
          (reimbursing.get(l.id) ?? []).map((c) => ({ amountCents: c.amount_cents, personKey: personKey(c) })),
          l.bankLedgerId!,
          acct,
        );
      } else if (live && l.reviewStatus === "categorized" && l.catLedgerId) {
        desired = { date: l.postedDate, memo: l.merchant || l.description || "Bank transaction", lines: bankLinePosting(l.amountCents, l.bankLedgerId!, l.catLedgerId) };
      }
      sources.push({ ref: `bank_transaction:${l.id}`, type: "bank_transaction", id: l.id, desired });
    }

    for (const c of claims) {
      const j = c.wedding_id ? jobById.get(c.wedding_id) : undefined;
      const job = j ? { eventDate: j.eventDate, cancelled: j.status === "cancelled", name: j.coupleNames } : null;
      if (j && !job!.cancelled && c.spent_on <= j.eventDate) push(prepaid, j.id, { date: c.spent_on, cents: c.amount_cents });
      sources.push({
        ref: `expense_claim:${c.id}`,
        type: "expense_claim",
        id: c.id,
        desired: keyedClaimEntry(
          { amountCents: c.amount_cents, spentOn: c.spent_on, merchant: c.merchant, claimant: c.claimant_name, categoryAccountId: c.cat_ledger_id, job, jobId: j ? j.id : null, personKey: personKey(c) },
          acct,
        ),
      });
    }

    // Direct job cost from the cost plan: the paid (actual) amount, else the plan.
    const planRows = await tx
      .select()
      .from(eventResources)
      .where(and(eq(eventResources.tenantId, tenantId), isNull(eventResources.voidedAt)));
    const planCost = new Map<string, number>();
    for (const r of planRows) {
      const j = jobById.get(r.weddingId);
      const revenue = j ? Math.round(Number(j.totalAmount) * 100) || 0 : 0;
      const line = {
        kind: (r.kind === "material" ? "material" : "labor") as "labor" | "material",
        crewMemberId: r.crewMemberId,
        label: r.label,
        role: r.role,
        payMethod: isPayMethod(r.payMethod) ? r.payMethod : null,
        rateCents: r.rateCents,
        percentBps: r.percentBps,
        plannedMinutes: r.plannedMinutes,
        actualMinutes: r.actualMinutes,
        unitCostCents: r.unitCostCents,
        plannedQty: r.plannedQty == null ? null : Number(r.plannedQty),
        actualQty: r.actualQty == null ? null : Number(r.actualQty),
        actualCostCents: r.actualCostCents,
      };
      const c = lineCost(line, revenue);
      planCost.set(r.weddingId, (planCost.get(r.weddingId) ?? 0) + (line.actualCostCents ?? c.actual ?? c.planned ?? 0));
    }
    for (const j of jobs) {
      const jobClaims = claims.filter((c) => c.wedding_id === j.id && c.spent_on <= j.eventDate).reduce((s, c) => s + c.amount_cents, 0);
      const facts: JobFacts = {
        totalCents: Math.round(Number(j.totalAmount) * 100) || 0,
        eventDate: j.eventDate,
        cancelled: j.status === "cancelled",
        cancelledOn: cancelledOn(j),
        payments: payments.get(j.id) ?? [],
        costCents: (planCost.get(j.id) ?? 0) + (j.status === "cancelled" ? 0 : jobClaims),
        prepaid: prepaid.get(j.id) ?? [],
      };
      const entries = jobEntries(facts, j.id, j.coupleNames, acct, today);
      sources.push({ ref: `job_revenue:${j.id}`, type: "job_revenue", id: j.id, desired: entries.revenue });
      sources.push({ ref: `job_cost:${j.id}`, type: "job_cost", id: j.id, desired: entries.cost });
    }

    // Everything already posted from these sources, with its lines.
    const liveEntries = await tx
      .select({ id: journalEntries.id, date: journalEntries.entryDate, fingerprint: journalEntries.fingerprint, ref: journalEntries.sourceRef })
      .from(journalEntries)
      .where(and(eq(journalEntries.tenantId, tenantId), eq(journalEntries.status, "posted"), inArray(journalEntries.sourceType, DERIVED_TYPES)));
    const entryLines = liveEntries.length
      ? await tx
          .select({ entryId: journalLines.entryId, accountId: journalLines.accountId, debitCents: journalLines.debitCents, creditCents: journalLines.creditCents, sub: journalLines.subRef })
          .from(journalLines)
          .where(and(eq(journalLines.tenantId, tenantId), inArray(journalLines.entryId, liveEntries.map((e) => e.id))))
      : [];
    const linesByEntry = new Map<string, Line[]>();
    for (const l of entryLines) linesByEntry.set(l.entryId, [...(linesByEntry.get(l.entryId) ?? []), { accountId: l.accountId, debitCents: l.debitCents, creditCents: l.creditCents, sub: l.sub }]);
    const liveByRef = new Map<string, LiveEntry[]>();
    for (const e of liveEntries) {
      const ref = e.ref ?? "";
      liveByRef.set(ref, [...(liveByRef.get(ref) ?? []), { id: e.id, date: e.date, fingerprint: e.fingerprint, lines: linesByEntry.get(e.id) ?? [] }]);
    }
    const known = new Set(sources.map((s) => s.ref));
    for (const ref of liveByRef.keys()) {
      if (known.has(ref) || !ref) continue;
      const [type, id] = ref.split(":");
      sources.push({ ref, type, id, desired: null });
    }

    const actor = opts.actor ?? "system";
    const cause = opts.cause ?? "live sync";
    let posted = 0;
    let voided = 0;
    let corrected = 0;
    for (const s of sources) {
      const plan = planPosting(s.desired, liveByRef.get(s.ref) ?? [], locked, today);
      for (const id of plan.void) {
        await tx
          .update(journalEntries)
          .set({ status: "void", voidedAt: new Date(), voidReason: "Its source changed" })
          .where(and(eq(journalEntries.id, id), eq(journalEntries.tenantId, tenantId), eq(journalEntries.status, "posted")));
        await audit(tx, { tenantId, actor, action: "journal.void", entityType: "journal_entry", entityId: id, before: { lines: (liveByRef.get(s.ref) ?? []).find((e) => e.id === id)?.lines }, reason: "Its source changed", cause: `${cause}; source ${s.ref}` });
        voided++;
      }
      for (const p of plan.post) {
        const id = await insertEntry(tx, tenantId, {
          entryDate: p.date,
          memo: p.memo,
          sourceType: p.kind === "adjustment" ? "adjustment" : s.type,
          sourceId: p.kind === "adjustment" ? randomUUID() : s.id,
          sourceRef: s.ref,
          adjustsPeriod: p.adjustsPeriod,
          fingerprint: p.fingerprint,
        }, p.lines);
        await audit(tx, { tenantId, actor, action: p.kind === "adjustment" ? "journal.correct" : "journal.post", entityType: "journal_entry", entityId: id, after: { date: p.date, memo: p.memo, lines: p.lines, adjustsPeriod: p.adjustsPeriod }, cause: `${cause}; source ${s.ref}` });
        if (p.kind === "adjustment") corrected++;
        else posted++;
      }
    }
    return { posted, voided, corrected };
  });
}

/** The old name; every caller now gets the full accrual sync. */
export const postBankLedger = (tenantId: string) => postLedger(tenantId);

/** Post the ledger and never throw: a failed post heals on the next one. */
export async function postBankLedgerQuietly(tenantId: string, opts: { actor?: string; cause?: string } = {}): Promise<void> {
  try {
    await postLedger(tenantId, opts);
  } catch (err) {
    console.error("[ledger] posting failed, will retry on the next change or page load:", err instanceof Error ? err.message : err);
  }
}

/**
 * The owner states a statement balance on a date. Replaces any earlier opening
 * balance for that bank account (voided, kept). For a card, the balance is the
 * amount OWED, as a positive number, the way a statement prints it.
 */
export async function setOpeningBalance(
  tenantId: string,
  userId: string,
  bankAccountId: string,
  entryDate: string,
  balanceCents: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_RE.test(bankAccountId)) return { ok: false, error: "Not found" };
  return db.transaction(async (tx) => {
    await lockTenant(tx, tenantId);
    await ensureLedger(tx, tenantId);
    const [bank] = await tx
      .select({ id: bankAccounts.id, name: bankAccounts.name, ledgerAccountId: bankAccounts.ledgerAccountId, type: bankAccounts.type })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.tenantId, tenantId)))
      .limit(1);
    if (!bank?.ledgerAccountId) return { ok: false as const, error: "Not found" };
    const [equity] = await tx
      .select()
      .from(ledgerAccounts)
      .where(and(eq(ledgerAccounts.tenantId, tenantId), eq(ledgerAccounts.systemKey, "opening_equity")))
      .limit(1);
    await tx
      .update(journalEntries)
      .set({ status: "void", voidedAt: new Date(), voidReason: "Opening balance replaced" })
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntries.sourceType, "opening_balance"),
          eq(journalEntries.sourceId, bank.id),
          eq(journalEntries.status, "posted"),
        ),
      );
    if (balanceCents !== 0) {
      const isLiability = accountTypeForBank(bank.type) === "liability";
      // An asset's balance is a debit; a liability's (amount owed) is a credit. A negative flips it.
      const bankDebit = isLiability ? balanceCents < 0 : balanceCents > 0;
      const abs = Math.abs(balanceCents);
      const lines: LineInput[] = bankDebit
        ? [
            { accountId: bank.ledgerAccountId, debitCents: abs, creditCents: 0 },
            { accountId: equity.id, debitCents: 0, creditCents: abs },
          ]
        : [
            { accountId: equity.id, debitCents: abs, creditCents: 0 },
            { accountId: bank.ledgerAccountId, debitCents: 0, creditCents: abs },
          ];
      await insertEntry(
        tx,
        tenantId,
        { entryDate, memo: `Opening balance, ${bank.name}`, sourceType: "opening_balance", sourceId: bank.id, fingerprint: `${entryDate}|${balanceCents}`, createdBy: userId },
        lines,
      );
    }
    return { ok: true as const };
  });
}

// ── Reports ─────────────────────────────────────────────────────────────────

export type AccountTotal = { id: string; code: string; name: string; type: AccountType; systemKey: string | null; debit: number; credit: number };

/** Debit and credit totals per account over posted entries, optionally within dates. */
export async function accountTotals(tenantId: string, opts: { from?: string; to?: string } = {}): Promise<AccountTotal[]> {
  const conds = [eq(journalEntries.tenantId, tenantId), eq(journalEntries.status, "posted")];
  if (opts.from) conds.push(gte(journalEntries.entryDate, opts.from));
  if (opts.to) conds.push(lte(journalEntries.entryDate, opts.to));
  const sums = await db
    .select({
      accountId: journalLines.accountId,
      debit: sql<string>`coalesce(sum(${journalLines.debitCents}),0)`,
      credit: sql<string>`coalesce(sum(${journalLines.creditCents}),0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(and(...conds, eq(journalLines.tenantId, tenantId)))
    .groupBy(journalLines.accountId);
  const byId = new Map(sums.map((s) => [s.accountId, s]));
  const accounts = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.tenantId, tenantId)).orderBy(asc(ledgerAccounts.code));
  return accounts.map((a: LedgerAccount) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type as AccountType,
    systemKey: a.systemKey,
    debit: Number(byId.get(a.id)?.debit ?? 0),
    credit: Number(byId.get(a.id)?.credit ?? 0),
  }));
}

/** The balance in the account's own natural direction: assets and expenses debit, the rest credit. */
export function naturalBalance(t: Pick<AccountTotal, "type" | "debit" | "credit">): number {
  return t.type === "asset" || t.type === "expense" ? t.debit - t.credit : t.credit - t.debit;
}

export async function profitAndLoss(tenantId: string, from: string, to: string) {
  const totals = (await accountTotals(tenantId, { from, to })).filter((t) => t.debit || t.credit);
  const income = totals.filter((t) => t.type === "income").map((t) => ({ ...t, amount: naturalBalance(t) }));
  const expense = totals.filter((t) => t.type === "expense").map((t) => ({ ...t, amount: naturalBalance(t) }));
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expense.reduce((s, t) => s + t.amount, 0);
  return { income, expense, totalIncome, totalExpense, net: totalIncome - totalExpense };
}

export async function balances(tenantId: string) {
  const totals = await accountTotals(tenantId);
  const pick = (type: AccountType) =>
    totals.filter((t) => t.type === type && (t.debit || t.credit)).map((t) => ({ ...t, amount: naturalBalance(t) }));
  const assets = pick("asset");
  const liabilities = pick("liability");
  const equity = pick("equity");
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);
  const earnings = sum(pick("income")) - sum(pick("expense"));
  return {
    assets,
    liabilities,
    equity,
    earnings,
    totalAssets: sum(assets),
    totalLiabilities: sum(liabilities),
    totalEquity: sum(equity) + earnings,
  };
}

/** Per connected account: what the books say next to what the bank says. */
export async function reconciliation(tenantId: string) {
  const totals = new Map((await accountTotals(tenantId)).map((t) => [t.id, t]));
  const banks = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.tenantId, tenantId))
    .orderBy(asc(bankAccounts.name));
  if (!banks.length) return [];
  const ids = banks.map((b) => b.id);
  const waiting = await db
    .select({
      bankAccountId: bankTransactions.bankAccountId,
      unreviewed: sql<number>`count(*) filter (where ${bankTransactions.reviewStatus} = 'unreviewed')::int`,
      excluded: sql<number>`count(*) filter (where ${bankTransactions.reviewStatus} = 'excluded')::int`,
      pending: sql<number>`count(*) filter (where ${bankTransactions.pending})::int`,
      earliest: sql<string | null>`min(${bankTransactions.postedDate})::text`,
    })
    .from(bankTransactions)
    .where(and(eq(bankTransactions.tenantId, tenantId), inArray(bankTransactions.bankAccountId, ids), isNull(bankTransactions.removedAt)))
    .groupBy(bankTransactions.bankAccountId);
  const opening = await db
    .select({ sourceId: journalEntries.sourceId, entryDate: journalEntries.entryDate })
    .from(journalEntries)
    .where(and(eq(journalEntries.tenantId, tenantId), eq(journalEntries.sourceType, "opening_balance"), eq(journalEntries.status, "posted")));
  const openingBy = new Map(opening.map((o) => [o.sourceId, o.entryDate]));
  const waitBy = new Map(waiting.map((w) => [w.bankAccountId, w]));
  return banks.map((b) => {
    const t = b.ledgerAccountId ? totals.get(b.ledgerAccountId) : undefined;
    const books = t ? naturalBalance(t) : 0;
    const bank = b.currentBalanceCents;
    const w = waitBy.get(b.id);
    return {
      id: b.id,
      name: b.name,
      mask: b.mask,
      isLiability: accountTypeForBank(b.type) === "liability",
      books,
      bank,
      difference: bank === null ? null : bank - books,
      unreviewed: w?.unreviewed ?? 0,
      excluded: w?.excluded ?? 0,
      pending: w?.pending ?? 0,
      earliest: w?.earliest ?? null,
      openingDate: openingBy.get(b.id) ?? null,
    };
  });
}

/** Every posted journal line, oldest first, as CSV. */
export async function generalLedgerCsv(tenantId: string): Promise<string> {
  const rows = await db
    .select({
      date: journalEntries.entryDate,
      entryId: journalEntries.id,
      memo: journalEntries.memo,
      source: journalEntries.sourceType,
      code: ledgerAccounts.code,
      account: ledgerAccounts.name,
      type: ledgerAccounts.type,
      debit: journalLines.debitCents,
      credit: journalLines.creditCents,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
    .where(and(eq(journalLines.tenantId, tenantId), eq(journalEntries.tenantId, tenantId), eq(journalEntries.status, "posted")))
    .orderBy(asc(journalEntries.entryDate), asc(journalEntries.createdAt), asc(journalLines.debitCents));
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["Date", "Entry", "Memo", "Source", "Account code", "Account", "Type", "Debit", "Credit"];
  const lines = rows.map((r) =>
    [r.date, r.entryId.slice(0, 8), r.memo, r.source, r.code, r.account, r.type, r.debit ? (r.debit / 100).toFixed(2) : "", r.credit ? (r.credit / 100).toFixed(2) : ""]
      .map(cell)
      .join(","),
  );
  return [head.join(","), ...lines].join("\r\n") + "\r\n";
}
