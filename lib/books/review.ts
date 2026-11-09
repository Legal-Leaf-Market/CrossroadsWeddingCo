import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankAccounts, bankTransactions, categorizationRules, ledgerCategories } from "@/lib/db/schema";
import { postBankLedgerQuietly } from "@/lib/books/ledger";
import { STARTER_CATEGORIES, normalizeMatchText, type ReviewStatus } from "@/lib/books/categories";

// The bank review queue. Every function takes the tenant id from the session
// (or, for afterSync, from the connection Plaid signed for) and carries it in
// every WHERE, so one account can never read or sort another's money.
//
// What a review is: a person (or a rule a person made) saying what a bank line
// IS. It is not a ledger posting. The ledger layer reads categorized rows and
// posts them by its own rules; nothing here writes debits or credits.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isUuid = (s: string) => UUID_RE.test(s);

/** Seed the starter list once. Safe to call on every visit: existing names are left alone. */
export async function ensureDefaultCategories(tenantId: string): Promise<void> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(ledgerCategories)
    .where(eq(ledgerCategories.tenantId, tenantId));
  if (n > 0) return; // an account that has deleted down to its own list keeps its own list
  await db
    .insert(ledgerCategories)
    .values(STARTER_CATEGORIES.map((c, i) => ({ tenantId, name: c.name, kind: c.kind, taxLine: c.taxLine, sortOrder: (i + 1) * 10 })))
    .onConflictDoNothing();
}

export async function listCategories(tenantId: string, opts: { includeArchived?: boolean } = {}) {
  return db
    .select()
    .from(ledgerCategories)
    .where(and(eq(ledgerCategories.tenantId, tenantId), opts.includeArchived ? undefined : eq(ledgerCategories.isArchived, false)))
    .orderBy(asc(ledgerCategories.sortOrder), asc(ledgerCategories.name));
}

async function ownCategory(tenantId: string, id: string) {
  if (!isUuid(id)) return null;
  const [c] = await db
    .select()
    .from(ledgerCategories)
    .where(and(eq(ledgerCategories.id, id), eq(ledgerCategories.tenantId, tenantId)))
    .limit(1);
  return c ?? null;
}

export type QueueRow = {
  id: string;
  postedDate: string;
  amountCents: number;
  merchant: string | null;
  description: string;
  rawCategory: string | null;
  pending: boolean;
  reviewStatus: string;
  categoryId: string | null;
  categoryName: string | null;
  note: string | null;
  sortedByRule: boolean;
  accountName: string;
  mask: string | null;
};

export async function listQueue(tenantId: string, status: ReviewStatus, limit = 200): Promise<QueueRow[]> {
  const rows = await db
    .select({
      id: bankTransactions.id,
      postedDate: bankTransactions.postedDate,
      amountCents: bankTransactions.amountCents,
      merchant: bankTransactions.merchant,
      description: bankTransactions.description,
      rawCategory: bankTransactions.rawCategory,
      pending: bankTransactions.pending,
      reviewStatus: bankTransactions.reviewStatus,
      categoryId: bankTransactions.categoryId,
      categoryName: ledgerCategories.name,
      note: bankTransactions.note,
      ruleId: bankTransactions.ruleId,
      reviewedBy: bankTransactions.reviewedBy,
      accountName: bankAccounts.name,
      mask: bankAccounts.mask,
    })
    .from(bankTransactions)
    .innerJoin(bankAccounts, eq(bankTransactions.bankAccountId, bankAccounts.id))
    .leftJoin(ledgerCategories, eq(bankTransactions.categoryId, ledgerCategories.id))
    .where(
      and(
        eq(bankTransactions.tenantId, tenantId),
        isNull(bankTransactions.removedAt),
        eq(bankTransactions.reviewStatus, status),
      ),
    )
    // The queue is worked oldest first, like a pile; sorted and excluded read newest first.
    .orderBy(status === "unreviewed" ? asc(bankTransactions.postedDate) : desc(bankTransactions.postedDate), asc(bankTransactions.createdAt))
    .limit(limit);
  return rows.map(({ ruleId, reviewedBy, ...r }) => ({ ...r, sortedByRule: !!ruleId && !reviewedBy }));
}

export async function queueCounts(tenantId: string): Promise<Record<ReviewStatus, number>> {
  const rows = await db
    .select({ status: bankTransactions.reviewStatus, n: sql<number>`count(*)::int` })
    .from(bankTransactions)
    .where(and(eq(bankTransactions.tenantId, tenantId), isNull(bankTransactions.removedAt)))
    .groupBy(bankTransactions.reviewStatus);
  const out: Record<ReviewStatus, number> = { unreviewed: 0, categorized: 0, excluded: 0 };
  for (const r of rows) if (r.status in out) out[r.status as ReviewStatus] = r.n;
  return out;
}

export type ReviewAction =
  | { action: "categorize"; ids: string[]; categoryId: string; note?: string }
  | { action: "exclude"; ids: string[]; note?: string }
  | { action: "reopen"; ids: string[] }
  | { action: "note"; ids: string[]; note: string };

export type ReviewResult = { ok: true; updated: number } | { ok: false; status: number; error: string };

/**
 * A person sorts one or more rows. Ids that are not this account's (or not
 * real) are simply not touched, and the count says how many were. A person's
 * decision always pauses rules on that row, so a later sync can never undo it.
 */
export async function applyReview(tenantId: string, userId: string, input: ReviewAction): Promise<ReviewResult> {
  const ids = [...new Set(input.ids.filter(isUuid))];
  if (!ids.length) return { ok: false, status: 400, error: "Pick at least one transaction." };
  const scope = and(eq(bankTransactions.tenantId, tenantId), inArray(bankTransactions.id, ids), isNull(bankTransactions.removedAt));
  const now = new Date();
  const note = "note" in input && input.note !== undefined ? input.note.trim().slice(0, 1000) || null : undefined;

  let set: Partial<typeof bankTransactions.$inferInsert>;
  if (input.action === "categorize") {
    const cat = await ownCategory(tenantId, input.categoryId);
    if (!cat || cat.isArchived) return { ok: false, status: 400, error: "That category isn't available." };
    set = { reviewStatus: "categorized", categoryId: cat.id, reviewedAt: now, reviewedBy: userId, ruleId: null, rulesPaused: true };
  } else if (input.action === "exclude") {
    set = { reviewStatus: "excluded", categoryId: null, reviewedAt: now, reviewedBy: userId, ruleId: null, rulesPaused: true };
  } else if (input.action === "reopen") {
    set = { reviewStatus: "unreviewed", categoryId: null, reviewedAt: null, reviewedBy: null, ruleId: null, rulesPaused: true };
  } else {
    set = {};
  }
  if (note !== undefined) set.note = note;
  if (!Object.keys(set).length) return { ok: true, updated: 0 };

  const res = await db
    .update(bankTransactions)
    .set({ ...set, updatedAt: now })
    .where(scope)
    .returning({ id: bankTransactions.id });
  if (res.length && input.action !== "note") await postBankLedgerQuietly(tenantId);
  return { ok: true, updated: res.length };
}

// ── Categories ──────────────────────────────────────────────────────────────

export async function createCategory(tenantId: string, input: { name: string; kind: string }) {
  const name = input.name.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!name) return { ok: false as const, error: "Give it a name." };
  const [row] = await db
    .insert(ledgerCategories)
    .values({ tenantId, name, kind: input.kind, sortOrder: 1000 })
    .onConflictDoNothing()
    .returning();
  if (!row) return { ok: false as const, error: "You already have a category with that name." };
  return { ok: true as const, category: row };
}

/** Archive hides a category from new sorting; rows already sorted keep it. Never deleted. */
export async function setCategoryArchived(tenantId: string, id: string, archived: boolean): Promise<boolean> {
  if (!isUuid(id)) return false;
  const res = await db
    .update(ledgerCategories)
    .set({ isArchived: archived, updatedAt: new Date() })
    .where(and(eq(ledgerCategories.id, id), eq(ledgerCategories.tenantId, tenantId)))
    .returning({ id: ledgerCategories.id });
  return res.length > 0;
}

// ── Rules ───────────────────────────────────────────────────────────────────

export type RuleInput = {
  matchField: "merchant" | "description";
  matchType: "equals" | "contains";
  pattern: string;
  direction: "any" | "in" | "out";
  action: "categorize" | "exclude";
  categoryId?: string | null;
};

export async function listRules(tenantId: string) {
  return db
    .select({
      id: categorizationRules.id,
      matchField: categorizationRules.matchField,
      matchType: categorizationRules.matchType,
      pattern: categorizationRules.pattern,
      direction: categorizationRules.direction,
      action: categorizationRules.action,
      categoryName: ledgerCategories.name,
      appliedCount: categorizationRules.appliedCount,
      createdAt: categorizationRules.createdAt,
    })
    .from(categorizationRules)
    .leftJoin(ledgerCategories, eq(categorizationRules.categoryId, ledgerCategories.id))
    .where(eq(categorizationRules.tenantId, tenantId))
    .orderBy(desc(categorizationRules.createdAt));
}

/** Create a rule, then sort every waiting row it matches. Returns how many it sorted. */
export async function createRule(tenantId: string, userId: string, input: RuleInput) {
  const pattern = normalizeMatchText(input.pattern).slice(0, 200);
  if (pattern.length < 3) return { ok: false as const, error: "Match on at least 3 characters, or the rule will catch too much." };
  let categoryId: string | null = null;
  if (input.action === "categorize") {
    const cat = input.categoryId ? await ownCategory(tenantId, input.categoryId) : null;
    if (!cat || cat.isArchived) return { ok: false as const, error: "Pick a category for the rule." };
    categoryId = cat.id;
  }
  // The same rule twice is one rule: refuse the duplicate rather than stack them.
  const [dupe] = await db
    .select({ id: categorizationRules.id })
    .from(categorizationRules)
    .where(
      and(
        eq(categorizationRules.tenantId, tenantId),
        eq(categorizationRules.matchField, input.matchField),
        eq(categorizationRules.matchType, input.matchType),
        eq(categorizationRules.pattern, pattern),
        eq(categorizationRules.direction, input.direction),
      ),
    )
    .limit(1);
  if (dupe) return { ok: false as const, error: "You already have a rule for that." };
  const [rule] = await db
    .insert(categorizationRules)
    .values({ tenantId, matchField: input.matchField, matchType: input.matchType, pattern, direction: input.direction, action: input.action, categoryId, createdBy: userId })
    .returning();
  const sorted = await runRules(tenantId);
  if (sorted) await postBankLedgerQuietly(tenantId);
  return { ok: true as const, rule, sorted };
}

/** Deleting a rule leaves the rows it already sorted exactly as they are. */
export async function deleteRule(tenantId: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const res = await db
    .delete(categorizationRules)
    .where(and(eq(categorizationRules.id, id), eq(categorizationRules.tenantId, tenantId)))
    .returning({ id: categorizationRules.id });
  return res.length > 0;
}

type RuleRow = typeof categorizationRules.$inferSelect;

/** Pure: does this rule match this bank line? Exported for the verify script. */
export function ruleMatches(
  rule: Pick<RuleRow, "matchField" | "matchType" | "pattern" | "direction">,
  tx: { merchant: string | null; description: string; amountCents: number },
): boolean {
  if (rule.direction === "in" && tx.amountCents <= 0) return false;
  if (rule.direction === "out" && tx.amountCents >= 0) return false;
  const text = normalizeMatchText(rule.matchField === "merchant" ? tx.merchant : tx.description);
  if (!text) return false;
  return rule.matchType === "equals" ? text === rule.pattern : text.includes(rule.pattern);
}

/** Most specific first: exact before contains, longer patterns before shorter, newest breaks ties. */
export function orderRules<T extends Pick<RuleRow, "matchType" | "pattern" | "createdAt">>(rules: T[]): T[] {
  return [...rules].sort(
    (a, b) =>
      (a.matchType === "equals" ? 0 : 1) - (b.matchType === "equals" ? 0 : 1) ||
      b.pattern.length - a.pattern.length ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

/**
 * Sort waiting rows by this account's rules. Touches only rows that are
 * unreviewed, not removed, and not paused by a person. Each update re-checks
 * those conditions in its WHERE, so a person sorting the same row at the same
 * moment wins.
 */
export async function runRules(tenantId: string): Promise<number> {
  const rules = orderRules(await db.select().from(categorizationRules).where(eq(categorizationRules.tenantId, tenantId)));
  if (!rules.length) return 0;
  const waiting = await db
    .select({ id: bankTransactions.id, merchant: bankTransactions.merchant, description: bankTransactions.description, amountCents: bankTransactions.amountCents })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.tenantId, tenantId),
        eq(bankTransactions.reviewStatus, "unreviewed"),
        eq(bankTransactions.rulesPaused, false),
        isNull(bankTransactions.removedAt),
      ),
    )
    .limit(5000);
  const byRule = new Map<string, string[]>();
  for (const tx of waiting) {
    const rule = rules.find((r) => ruleMatches(r, tx));
    if (rule) byRule.set(rule.id, [...(byRule.get(rule.id) ?? []), tx.id]);
  }
  let total = 0;
  for (const rule of rules) {
    const ids = byRule.get(rule.id);
    if (!ids?.length) continue;
    const res = await db
      .update(bankTransactions)
      .set({
        reviewStatus: rule.action === "exclude" ? "excluded" : "categorized",
        categoryId: rule.action === "exclude" ? null : rule.categoryId,
        ruleId: rule.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bankTransactions.tenantId, tenantId),
          inArray(bankTransactions.id, ids),
          eq(bankTransactions.reviewStatus, "unreviewed"),
          eq(bankTransactions.rulesPaused, false),
        ),
      )
      .returning({ id: bankTransactions.id });
    if (res.length) {
      total += res.length;
      await db
        .update(categorizationRules)
        .set({ appliedCount: sql`${categorizationRules.appliedCount} + ${res.length}` })
        .where(eq(categorizationRules.id, rule.id));
    }
  }
  return total;
}

/**
 * When a pending charge posts, Plaid removes the pending line and adds a new
 * one carrying pending_transaction_id. If a person already sorted the pending
 * line, the posted one inherits that decision instead of landing back in the
 * pile. Only unreviewed posted rows are filled; nothing a person did is overwritten.
 */
export async function carryPendingReviews(tenantId: string): Promise<number> {
  const res = await db.execute(sql`
    UPDATE bank_transactions AS posted
       SET review_status = old.review_status,
           category_id   = old.category_id,
           note          = COALESCE(posted.note, old.note),
           reviewed_at   = old.reviewed_at,
           reviewed_by   = old.reviewed_by,
           rule_id       = old.rule_id,
           rules_paused  = old.rules_paused,
           updated_at    = now()
      FROM bank_transactions AS old
     WHERE posted.tenant_id = ${tenantId}
       AND old.tenant_id = ${tenantId}
       AND posted.pending_external_id IS NOT NULL
       AND old.bank_account_id = posted.bank_account_id
       AND old.external_id = posted.pending_external_id
       AND posted.review_status = 'unreviewed'
       AND posted.removed_at IS NULL
       AND old.review_status <> 'unreviewed'
  `);
  return res.rowCount ?? 0;
}

/** Called by the bank feed after every successful sync. */
export async function afterSync(tenantId: string): Promise<void> {
  await carryPendingReviews(tenantId);
  await runRules(tenantId);
  // Posting is derived, so it runs after every sync: a bank correcting an
  // amount or withdrawing a line voids and reposts here.
  await postBankLedgerQuietly(tenantId);
}

/** Every reviewed row as CSV for the owner's accountant. Amounts in dollars, money in positive. */
export async function exportCsv(tenantId: string): Promise<string> {
  const rows = await db
    .select({
      postedDate: bankTransactions.postedDate,
      accountName: bankAccounts.name,
      mask: bankAccounts.mask,
      merchant: bankTransactions.merchant,
      description: bankTransactions.description,
      amountCents: bankTransactions.amountCents,
      status: bankTransactions.reviewStatus,
      category: ledgerCategories.name,
      kind: ledgerCategories.kind,
      taxLine: ledgerCategories.taxLine,
      note: bankTransactions.note,
    })
    .from(bankTransactions)
    .innerJoin(bankAccounts, eq(bankTransactions.bankAccountId, bankAccounts.id))
    .leftJoin(ledgerCategories, eq(bankTransactions.categoryId, ledgerCategories.id))
    .where(and(eq(bankTransactions.tenantId, tenantId), isNull(bankTransactions.removedAt)))
    .orderBy(asc(bankTransactions.postedDate));
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    // A cell starting with = + - @ runs as a formula in a spreadsheet; neutralize it.
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["Date", "Account", "Merchant", "Description", "Amount", "Status", "Category", "Type", "Tax line hint", "Note"];
  const lines = rows.map((r) =>
    [
      r.postedDate,
      `${r.accountName}${r.mask ? ` ${r.mask}` : ""}`,
      r.merchant,
      r.description,
      (r.amountCents / 100).toFixed(2),
      r.status,
      r.category,
      r.kind,
      r.taxLine,
      r.note,
    ]
      .map(cell)
      .join(","),
  );
  return [head.join(","), ...lines].join("\r\n") + "\r\n";
}
