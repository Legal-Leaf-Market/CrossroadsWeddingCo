import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankTransactionSplits, bankTransactions, ledgerCategories } from "@/lib/db/schema";
import { postBankLedgerQuietly } from "@/lib/books/ledger";
import { splitProblem } from "@/lib/books/logic";

// Split transactions: one bank line, several categories. A split line is
// categorized with category_id NULL and is_split true; its parts live in
// bank_transaction_splits. Any other decision on the line (sort, set aside,
// move back, match) removes the parts, through clearSplits.

/** The note left when a sync sends a split back to review. Removed once a person sorts the line again. */
export const BROKEN_SPLIT_NOTE = "The bank changed this amount after you split it, so sort it again.";
/** The line's note with the automatic broken-split sentence taken out. */
export const noteWithoutBrokenSplit = sql<string | null>`nullif(btrim(replace(coalesce(${bankTransactions.note}, ''), ${BROKEN_SPLIT_NOTE}, '')), '')`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type SplitPart = { categoryId: string; amountCents: number; note?: string | null };
export type SplitResult = { ok: true } | { ok: false; status: number; error: string };

export async function applySplit(tenantId: string, userId: string, transactionId: string, parts: SplitPart[]): Promise<SplitResult> {
  if (!UUID_RE.test(transactionId) || parts.some((p) => !UUID_RE.test(p.categoryId))) {
    return { ok: false, status: 400, error: "Pick a category for every part." };
  }
  const result = await db.transaction(async (tx): Promise<SplitResult> => {
    // Lock the line so a sync or a second tab can't change it underneath the check.
    const [line] = await tx
      .select({ id: bankTransactions.id, amountCents: bankTransactions.amountCents })
      .from(bankTransactions)
      .where(and(eq(bankTransactions.id, transactionId), eq(bankTransactions.tenantId, tenantId), isNull(bankTransactions.removedAt)))
      .for("update")
      .limit(1);
    if (!line) return { ok: false, status: 404, error: "Not found" };
    const problem = splitProblem(line.amountCents, parts);
    if (problem) return { ok: false, status: 400, error: problem };
    const ids = [...new Set(parts.map((p) => p.categoryId))];
    const cats = await tx
      .select({ id: ledgerCategories.id })
      .from(ledgerCategories)
      .where(and(eq(ledgerCategories.tenantId, tenantId), inArray(ledgerCategories.id, ids), eq(ledgerCategories.isArchived, false)));
    if (cats.length !== ids.length) return { ok: false, status: 400, error: "One of those categories isn't available." };

    await tx.delete(bankTransactionSplits).where(and(eq(bankTransactionSplits.tenantId, tenantId), eq(bankTransactionSplits.transactionId, line.id)));
    await tx.insert(bankTransactionSplits).values(
      parts.map((p, i) => ({
        tenantId,
        transactionId: line.id,
        categoryId: p.categoryId,
        amountCents: p.amountCents,
        note: p.note?.trim().slice(0, 200) || null,
        position: i,
      })),
    );
    const now = new Date();
    await tx
      .update(bankTransactions)
      .set({
        reviewStatus: "categorized",
        categoryId: null,
        isSplit: true,
        bookingId: null,
        paymentKind: null,
        reviewedAt: now,
        reviewedBy: userId,
        ruleId: null,
        rulesPaused: true,
        note: noteWithoutBrokenSplit,
        updatedAt: now,
      })
      .where(and(eq(bankTransactions.id, line.id), eq(bankTransactions.tenantId, tenantId)));
    return { ok: true };
  });
  if (result.ok) await postBankLedgerQuietly(tenantId);
  return result;
}

/** Remove the parts of these lines (another decision replaced the split). */
export async function clearSplits(tenantId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await db.delete(bankTransactionSplits).where(and(eq(bankTransactionSplits.tenantId, tenantId), inArray(bankTransactionSplits.transactionId, ids)));
  await db
    .update(bankTransactions)
    .set({ isSplit: false, updatedAt: new Date() })
    .where(and(eq(bankTransactions.tenantId, tenantId), inArray(bankTransactions.id, ids), eq(bankTransactions.isSplit, true)));
}

export type SplitView = { categoryId: string; categoryName: string; amountCents: number; note: string | null };

/** Parts per line, for the queue and the CSV. */
export async function splitsFor(tenantId: string, ids: string[]): Promise<Map<string, SplitView[]>> {
  const out = new Map<string, SplitView[]>();
  if (!ids.length) return out;
  const rows = await db
    .select({
      transactionId: bankTransactionSplits.transactionId,
      categoryId: bankTransactionSplits.categoryId,
      categoryName: ledgerCategories.name,
      amountCents: bankTransactionSplits.amountCents,
      note: bankTransactionSplits.note,
    })
    .from(bankTransactionSplits)
    .innerJoin(ledgerCategories, eq(bankTransactionSplits.categoryId, ledgerCategories.id))
    .where(and(eq(bankTransactionSplits.tenantId, tenantId), inArray(bankTransactionSplits.transactionId, ids)))
    .orderBy(asc(bankTransactionSplits.position));
  for (const r of rows) out.set(r.transactionId, [...(out.get(r.transactionId) ?? []), r]);
  return out;
}

/**
 * After a sync: a split whose parts no longer add up to the line (the bank
 * changed the amount) goes back to review with a note. Posting numbers that
 * disagree with the bank would be worse than asking again. Returns how many.
 */
export async function reopenBrokenSplits(tenantId: string): Promise<number> {
  const res = await db.execute(sql`
    WITH broken AS (
      SELECT t.id
        FROM bank_transactions t
        LEFT JOIN bank_transaction_splits s ON s.transaction_id = t.id AND s.tenant_id = t.tenant_id
       WHERE t.tenant_id = ${tenantId} AND t.is_split
       GROUP BY t.id, t.amount_cents
      HAVING coalesce(sum(s.amount_cents), 0) <> t.amount_cents
    ), cleared AS (
      DELETE FROM bank_transaction_splits WHERE tenant_id = ${tenantId} AND transaction_id IN (SELECT id FROM broken)
    )
    UPDATE bank_transactions
       SET is_split = false, review_status = 'unreviewed', category_id = NULL, reviewed_at = NULL, reviewed_by = NULL,
           note = left(concat_ws(' ', ${BROKEN_SPLIT_NOTE}::text, note), 1000),
           updated_at = now()
     WHERE tenant_id = ${tenantId} AND id IN (SELECT id FROM broken)
  `);
  return res.rowCount ?? 0;
}
