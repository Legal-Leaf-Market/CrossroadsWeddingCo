import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bankAccounts,
  bankTransactions,
  journalEntries,
  journalLines,
  ledgerAccounts,
  ledgerCategories,
  type LedgerAccount,
} from "@/lib/db/schema";
import { ACCOUNT_RANGES, accountTypeForBank, type AccountType } from "@/lib/books/ledger-constants";

// The ledger: double entry, cash basis, append-only. The spec is
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

type LineInput = { accountId: string; debitCents: number; creditCents: number };

/** Debit and credit for one bank line, by the spec's posting table. Pure; exported for the verify script. */
export function bankLinePosting(amountCents: number, bankAccountLedgerId: string, categoryLedgerId: string): LineInput[] {
  const abs = Math.abs(amountCents);
  return amountCents > 0
    ? [
        { accountId: bankAccountLedgerId, debitCents: abs, creditCents: 0 },
        { accountId: categoryLedgerId, debitCents: 0, creditCents: abs },
      ]
    : [
        { accountId: categoryLedgerId, debitCents: abs, creditCents: 0 },
        { accountId: bankAccountLedgerId, debitCents: 0, creditCents: abs },
      ];
}

async function insertEntry(
  tx: Tx,
  tenantId: string,
  e: { entryDate: string; memo: string; sourceType: string; sourceId: string; fingerprint: string; createdBy?: string | null },
  lines: LineInput[],
) {
  const d = lines.reduce((s, l) => s + l.debitCents, 0);
  const c = lines.reduce((s, l) => s + l.creditCents, 0);
  if (d !== c || lines.length < 2) throw new Error("Refusing to post an unbalanced entry");
  const [entry] = await tx
    .insert(journalEntries)
    .values({ tenantId, entryDate: e.entryDate, memo: e.memo.slice(0, 500), sourceType: e.sourceType, sourceId: e.sourceId, fingerprint: e.fingerprint, createdBy: e.createdBy ?? null })
    .returning({ id: journalEntries.id });
  await tx.insert(journalLines).values(lines.map((l) => ({ ...l, entryId: entry.id, tenantId })));
}

async function lockTenant(tx: Tx, tenantId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"ledger:" + tenantId}, 0))`);
}

/**
 * Bring the journal in line with the bank lines. Voids entries whose bank line
 * no longer qualifies or has changed, posts entries for lines that qualify and
 * have none. One transaction, serialized per tenant.
 */
export async function postBankLedger(tenantId: string): Promise<{ posted: number; voided: number }> {
  return db.transaction(async (tx) => {
    await lockTenant(tx, tenantId);
    await ensureLedger(tx, tenantId);

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
      })
      .from(bankTransactions)
      .innerJoin(bankAccounts, eq(bankTransactions.bankAccountId, bankAccounts.id))
      .leftJoin(ledgerCategories, eq(bankTransactions.categoryId, ledgerCategories.id))
      .where(eq(bankTransactions.tenantId, tenantId));

    const live = await tx
      .select({ id: journalEntries.id, sourceId: journalEntries.sourceId, fingerprint: journalEntries.fingerprint })
      .from(journalEntries)
      .where(and(eq(journalEntries.tenantId, tenantId), eq(journalEntries.sourceType, "bank_transaction"), eq(journalEntries.status, "posted")));
    const liveBySource = new Map(live.map((e) => [e.sourceId, e]));

    const toVoid: { id: string; reason: string }[] = [];
    const toPost: typeof lines = [];
    for (const l of lines) {
      const qualifies =
        l.reviewStatus === "categorized" && !l.pending && !l.removedAt && l.amountCents !== 0 && !!l.bankLedgerId && !!l.catLedgerId;
      const fp = qualifies ? `${l.postedDate}|${l.bankLedgerId}|${l.catLedgerId}|${l.amountCents}` : null;
      const existing = liveBySource.get(l.id);
      if (existing && existing.fingerprint === fp) continue;
      if (existing) {
        const reason = !qualifies
          ? l.removedAt
            ? "The bank withdrew the transaction"
            : l.reviewStatus === "excluded"
              ? "Marked not business"
              : l.reviewStatus === "unreviewed"
                ? "Moved back to review"
                : "No longer posts"
          : "Category, date or amount changed";
        toVoid.push({ id: existing.id, reason });
      }
      if (qualifies) toPost.push(l);
    }

    if (toVoid.length) {
      for (const v of toVoid) {
        await tx
          .update(journalEntries)
          .set({ status: "void", voidedAt: new Date(), voidReason: v.reason })
          .where(and(eq(journalEntries.id, v.id), eq(journalEntries.tenantId, tenantId), eq(journalEntries.status, "posted")));
      }
    }
    for (const l of toPost) {
      await insertEntry(
        tx,
        tenantId,
        {
          entryDate: l.postedDate,
          memo: l.merchant || l.description || "Bank transaction",
          sourceType: "bank_transaction",
          sourceId: l.id,
          fingerprint: `${l.postedDate}|${l.bankLedgerId}|${l.catLedgerId}|${l.amountCents}`,
        },
        bankLinePosting(l.amountCents, l.bankLedgerId!, l.catLedgerId!),
      );
    }
    return { posted: toPost.length, voided: toVoid.length };
  });
}

/** Post the ledger and never throw: a failed post heals on the next one. */
export async function postBankLedgerQuietly(tenantId: string): Promise<void> {
  try {
    await postBankLedger(tenantId);
  } catch (err) {
    console.error("[ledger] posting failed, will retry on the next sort or page load:", err instanceof Error ? err.message : err);
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
