import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankAccounts, bankTransactions, crewMembers, expenseClaims, ledgerCategories, receipts, weddings, type ExpenseClaim } from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import { postBankLedgerQuietly } from "@/lib/books/ledger";
import { crewIdFromExpenseToken } from "@/lib/expense-token";
import { DAILY_CLAIM_LIMIT, decide, payoutBlock, type ClaimState, type Role } from "@/lib/expense-logic";
import { rolesFor } from "@/lib/finance-roles";
import { VENUE_TIME_ZONE } from "@/lib/site";

// Expense capture, server side (2026-11-13). Two doors in: a crew member's
// capture link (lib/expense-token.ts) and a signed-in books user
// (getBooksWorkspace). Every query carries the tenant id, from the crew row
// for the link and from the session for the books pages, never from the browser.
// The ledger reads expense_claims; this file only keeps the claims straight and
// asks the ledger to catch up after every change.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: VENUE_TIME_ZONE });
}

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The crew member a capture token opens, active only. */
export async function crewForToken(token: string) {
  const id = crewIdFromExpenseToken(token);
  if (!id) return null;
  const [c] = await db.select().from(crewMembers).where(and(eq(crewMembers.id, id), isNull(crewMembers.retiredAt))).limit(1);
  return c ?? null;
}

/** Jobs a claim can be tied to: the tenant's live events from 30 days back to 60 ahead. */
export async function captureJobs(tenantId: string) {
  const t = todayLocal();
  return db
    .select({ id: weddings.id, name: weddings.coupleNames, eventDate: weddings.eventDate })
    .from(weddings)
    .where(
      and(
        eq(weddings.tenantId, tenantId),
        isNull(weddings.archivedAt),
        ne(weddings.status, "cancelled"),
        gte(weddings.eventDate, shiftDays(t, -30)),
        lte(weddings.eventDate, shiftDays(t, 60)),
      ),
    )
    .orderBy(asc(weddings.eventDate));
}

export async function expenseCategories(tenantId: string) {
  return db
    .select({ id: ledgerCategories.id, name: ledgerCategories.name })
    .from(ledgerCategories)
    .where(and(eq(ledgerCategories.tenantId, tenantId), eq(ledgerCategories.kind, "expense"), eq(ledgerCategories.isArchived, false)))
    .orderBy(asc(ledgerCategories.sortOrder), asc(ledgerCategories.name));
}

async function ownJob(tenantId: string, id: string | null) {
  if (!id || !UUID_RE.test(id)) return null;
  const [w] = await db.select({ id: weddings.id }).from(weddings).where(and(eq(weddings.id, id), eq(weddings.tenantId, tenantId))).limit(1);
  return w?.id ?? null;
}

async function ownExpenseCategory(tenantId: string, id: string | null) {
  if (!id || !UUID_RE.test(id)) return null;
  const [c] = await db
    .select({ id: ledgerCategories.id })
    .from(ledgerCategories)
    .where(and(eq(ledgerCategories.id, id), eq(ledgerCategories.tenantId, tenantId), eq(ledgerCategories.kind, "expense")))
    .limit(1);
  return c?.id ?? null;
}

export type ReceiptUpload = { fileName: string; mimeType: string; data: Buffer };

/** A claim from a capture link. Refuses past the daily limit. */
export async function submitClaim(
  crew: { id: string; tenantId: string; name: string },
  input: { amountCents: number; spentOn: string; merchant: string; description: string; weddingId: string | null; categoryId: string | null; receipt: ReceiptUpload | null },
): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  const [count] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(expenseClaims)
    .where(and(eq(expenseClaims.crewMemberId, crew.id), sql`${expenseClaims.submittedAt} > now() - interval '1 day'`));
  if ((count?.n ?? 0) >= DAILY_CLAIM_LIMIT) {
    return { ok: false, error: `That's ${DAILY_CLAIM_LIMIT} claims in a day. Send the rest tomorrow or to the owners directly.`, status: 429 };
  }
  const [weddingId, categoryId] = await Promise.all([ownJob(crew.tenantId, input.weddingId), ownExpenseCategory(crew.tenantId, input.categoryId)]);
  const id = await db.transaction(async (tx) => {
    let receiptId: string | null = null;
    if (input.receipt) {
      const [r] = await tx
        .insert(receipts)
        .values({ tenantId: crew.tenantId, fileName: input.receipt.fileName, mimeType: input.receipt.mimeType, byteSize: input.receipt.data.byteLength, data: input.receipt.data })
        .returning({ id: receipts.id });
      receiptId = r.id;
    }
    const [row] = await tx
      .insert(expenseClaims)
      .values({
        tenantId: crew.tenantId,
        crewMemberId: crew.id,
        claimantName: crew.name,
        kind: "reimbursement",
        merchant: input.merchant,
        description: input.description,
        amountCents: input.amountCents,
        spentOn: input.spentOn,
        categoryId,
        weddingId,
        receiptId,
      })
      .returning();
    await audit(tx, {
      tenantId: crew.tenantId,
      actor: `crew:${crew.id} (${crew.name}, capture link)`,
      action: "expense_claim.submit",
      entityType: "expense_claim",
      entityId: row.id,
      after: { ...row, receipt: receiptId ? { id: receiptId, mimeType: input.receipt?.mimeType, bytes: input.receipt?.data.byteLength } : null },
    });
    return row.id;
  });
  return { ok: true, id };
}

/** The claimant's own recent claims, for their capture page. */
export async function claimsForCrew(crewMemberId: string, limit = 20) {
  return db
    .select({
      id: expenseClaims.id,
      amountCents: expenseClaims.amountCents,
      spentOn: expenseClaims.spentOn,
      merchant: expenseClaims.merchant,
      description: expenseClaims.description,
      status: expenseClaims.status,
      decisionNote: expenseClaims.decisionNote,
      payoutStatus: expenseClaims.payoutStatus,
      reimbursed: sql<boolean>`${expenseClaims.reimbursedBankTransactionId} is not null`,
      hasReceipt: sql<boolean>`${expenseClaims.receiptId} is not null`,
    })
    .from(expenseClaims)
    .where(and(eq(expenseClaims.crewMemberId, crewMemberId), eq(expenseClaims.kind, "reimbursement")))
    .orderBy(desc(expenseClaims.submittedAt))
    .limit(limit);
}

export type ClaimRow = Awaited<ReturnType<typeof listClaims>>[number];

/** Every reimbursement claim for the tenant, newest first, with what the reviewer needs. */
export async function listClaims(tenantId: string) {
  return db
    .select({
      id: expenseClaims.id,
      crewMemberId: expenseClaims.crewMemberId,
      claimantName: expenseClaims.claimantName,
      claimantEmail: crewMembers.email,
      kind: expenseClaims.kind,
      merchant: expenseClaims.merchant,
      description: expenseClaims.description,
      amountCents: expenseClaims.amountCents,
      spentOn: expenseClaims.spentOn,
      categoryName: ledgerCategories.name,
      jobName: weddings.coupleNames,
      jobDate: weddings.eventDate,
      receiptId: expenseClaims.receiptId,
      status: expenseClaims.status,
      decidedBy: expenseClaims.decidedBy,
      decidedAt: expenseClaims.decidedAt,
      decisionNote: expenseClaims.decisionNote,
      reimbursedBankTransactionId: expenseClaims.reimbursedBankTransactionId,
      payoutStatus: expenseClaims.payoutStatus,
      payoutDecidedBy: expenseClaims.payoutDecidedBy,
      payoutNote: expenseClaims.payoutNote,
      submittedAt: expenseClaims.submittedAt,
    })
    .from(expenseClaims)
    .leftJoin(crewMembers, eq(expenseClaims.crewMemberId, crewMembers.id))
    .leftJoin(ledgerCategories, eq(expenseClaims.categoryId, ledgerCategories.id))
    .leftJoin(weddings, eq(expenseClaims.weddingId, weddings.id))
    .where(and(eq(expenseClaims.tenantId, tenantId), eq(expenseClaims.kind, "reimbursement")))
    .orderBy(desc(expenseClaims.submittedAt))
    .limit(300);
}

/** Money-out bank lines that could be a reimbursement payout, newest first. */
export async function payoutCandidates(tenantId: string) {
  return db
    .select({
      id: bankTransactions.id,
      postedDate: bankTransactions.postedDate,
      amountCents: bankTransactions.amountCents,
      merchant: bankTransactions.merchant,
      description: bankTransactions.description,
      accountName: bankAccounts.name,
    })
    .from(bankTransactions)
    .innerJoin(bankAccounts, eq(bankTransactions.bankAccountId, bankAccounts.id))
    .where(
      and(
        eq(bankTransactions.tenantId, tenantId),
        isNull(bankTransactions.removedAt),
        eq(bankTransactions.pending, false),
        sql`${bankTransactions.amountCents} < 0`,
        sql`${bankTransactions.postedDate} >= current_date - 180`,
      ),
    )
    .orderBy(desc(bankTransactions.postedDate))
    .limit(150);
}

async function loadClaim(tenantId: string, id: string) {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .select({ claim: expenseClaims, claimantEmail: crewMembers.email })
    .from(expenseClaims)
    .leftJoin(crewMembers, eq(expenseClaims.crewMemberId, crewMembers.id))
    .where(and(eq(expenseClaims.id, id), eq(expenseClaims.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

type Result = { ok: true } | { ok: false; error: string; status: number };

export type Approver = { email: string; fullName: string | null };

/** The rules' view of a claim: its states plus who the claimant and the last payout decider are. */
async function stateOf(tenantId: string, claim: ExpenseClaim, claimantEmail: string | null): Promise<ClaimState> {
  const [claimantRoles, deciderRoles] = await Promise.all([
    claimantEmail ? rolesFor(tenantId, claimantEmail) : Promise.resolve(new Set<Role>()),
    claim.payoutStatus === "vetoed" && claim.payoutDecidedBy ? rolesFor(tenantId, claim.payoutDecidedBy) : Promise.resolve(new Set<Role>()),
  ]);
  return {
    kind: claim.kind,
    status: claim.status,
    payoutStatus: claim.payoutStatus,
    reimbursed: !!claim.reimbursedBankTransactionId,
    claimantEmail,
    claimantRoles,
    vetoFinal: deciderRoles.has("tiebreaker"),
  };
}

const ROLE_ACTIONS = ["approve", "reject", "void", "payout_approve", "payout_veto", "payout_escalate"] as const;
export type DecideAction = (typeof ROLE_ACTIONS)[number];

/**
 * One decision on one claim by a signed-in user: the report (approve, reject,
 * void) or its payout (approve, veto, escalate). Every rule is decide() in
 * lib/expense-logic.ts. The write is a conditional UPDATE on the old states,
 * so two people acting at once cannot both win, and the loser is told.
 */
export async function decideClaim(tenantId: string, user: Approver, id: string, action: DecideAction, note: string): Promise<Result> {
  const found = await loadClaim(tenantId, id);
  if (!found) return { ok: false, error: "Not found", status: 404 };
  const { claim, claimantEmail } = found;
  const roles = await rolesFor(tenantId, user.email);
  const d = decide({ email: user.email, roles }, await stateOf(tenantId, claim, claimantEmail), action, note);
  if (!d.ok) return { ok: false, error: d.error, status: 403 };
  const now = new Date();
  const set: Partial<typeof expenseClaims.$inferInsert> = { updatedAt: now };
  if (d.status) Object.assign(set, { status: d.status, decidedBy: user.email, decidedAt: now, decisionNote: note.trim() });
  if (d.payoutStatus) Object.assign(set, { payoutStatus: d.payoutStatus, payoutDecidedBy: user.email, payoutDecidedAt: now, payoutNote: note.trim() });
  const ok = await db.transaction(async (tx) => {
    const updated = await tx
      .update(expenseClaims)
      .set(set)
      .where(
        and(
          eq(expenseClaims.id, id),
          eq(expenseClaims.tenantId, tenantId),
          eq(expenseClaims.status, claim.status),
          eq(expenseClaims.payoutStatus, claim.payoutStatus),
        ),
      )
      .returning();
    if (!updated.length) return false;
    await audit(tx, {
      tenantId,
      actor: `user:${user.email} (${[...roles].join(", ") || "no finance role"})`,
      action: `expense_claim.${action}`,
      entityType: "expense_claim",
      entityId: id,
      before: claim,
      after: updated[0],
      reason: note.trim() || null,
    });
    return true;
  });
  if (!ok) return { ok: false, error: "Someone else just changed this claim. Refresh to see it.", status: 409 };
  await postBankLedgerQuietly(tenantId);
  return { ok: true };
}

/**
 * Link (or unlink with null) one bank payout to the claims it repaid. Only
 * claims whose payout was approved, never your own, never by the tiebreaker.
 */
export async function linkReimbursement(tenantId: string, user: Approver, claimIds: string[], bankTransactionId: string | null): Promise<Result> {
  const ids = [...new Set(claimIds)].filter((x) => UUID_RE.test(x));
  if (ids.length === 0) return { ok: false, error: "Pick at least one claim.", status: 400 };
  const claims = await db
    .select({ claim: expenseClaims, claimantEmail: crewMembers.email })
    .from(expenseClaims)
    .leftJoin(crewMembers, eq(expenseClaims.crewMemberId, crewMembers.id))
    .where(and(eq(expenseClaims.tenantId, tenantId), inArray(expenseClaims.id, ids)));
  if (claims.length !== ids.length) return { ok: false, error: "Not found", status: 404 };
  const roles = await rolesFor(tenantId, user.email);
  for (const c of claims) {
    const d = decide({ email: user.email, roles }, await stateOf(tenantId, c.claim, c.claimantEmail), bankTransactionId ? "link" : "unlink");
    if (!d.ok) return { ok: false, error: `${c.claim.claimantName}: ${d.error}`, status: 403 };
  }

  if (bankTransactionId !== null) {
    if (!UUID_RE.test(bankTransactionId)) return { ok: false, error: "Not found", status: 404 };
    const [line] = await db
      .select({ id: bankTransactions.id, amountCents: bankTransactions.amountCents })
      .from(bankTransactions)
      .where(and(eq(bankTransactions.id, bankTransactionId), eq(bankTransactions.tenantId, tenantId), isNull(bankTransactions.removedAt)))
      .limit(1);
    if (!line) return { ok: false, error: "Not found", status: 404 };
    // A payout can repay claims linked earlier too: count what it already covers.
    const already = await db
      .select({ amountCents: expenseClaims.amountCents })
      .from(expenseClaims)
      .where(and(eq(expenseClaims.tenantId, tenantId), eq(expenseClaims.reimbursedBankTransactionId, bankTransactionId), ne(expenseClaims.status, "void")));
    const covered = already.reduce((s, c) => s + c.amountCents, 0);
    const block = payoutBlock({ amountCents: line.amountCents + covered }, claims.map((c) => c.claim));
    if (block) return { ok: false, error: block, status: 400 };
  }

  await db.transaction(async (tx) => {
    for (const c of claims) {
      const [after] = await tx
        .update(expenseClaims)
        .set({ reimbursedBankTransactionId: bankTransactionId, updatedAt: new Date() })
        .where(and(eq(expenseClaims.id, c.claim.id), eq(expenseClaims.tenantId, tenantId)))
        .returning();
      await audit(tx, {
        tenantId,
        actor: `user:${user.email} (${[...roles].join(", ") || "no finance role"})`,
        action: bankTransactionId ? "expense_claim.link_reimbursement" : "expense_claim.unlink_reimbursement",
        entityType: "expense_claim",
        entityId: c.claim.id,
        before: { reimbursedBankTransactionId: c.claim.reimbursedBankTransactionId },
        after: { reimbursedBankTransactionId: after.reimbursedBankTransactionId },
      });
    }
  });
  await postBankLedgerQuietly(tenantId);
  return { ok: true };
}

/**
 * A receipt for a charge already on the bank feed (company card or account).
 * Proof only: it posts nothing. A second upload for the same line replaces the
 * receipt on the existing record rather than adding another.
 */
export async function attachCardReceipt(
  tenantId: string,
  user: { email: string; fullName: string | null },
  bankTransactionId: string,
  receipt: ReceiptUpload,
): Promise<Result & { claimId?: string }> {
  if (!UUID_RE.test(bankTransactionId)) return { ok: false, error: "Not found", status: 404 };
  const [line] = await db
    .select({ id: bankTransactions.id, amountCents: bankTransactions.amountCents, postedDate: bankTransactions.postedDate, merchant: bankTransactions.merchant, description: bankTransactions.description, categoryId: bankTransactions.categoryId })
    .from(bankTransactions)
    .where(and(eq(bankTransactions.id, bankTransactionId), eq(bankTransactions.tenantId, tenantId), isNull(bankTransactions.removedAt)))
    .limit(1);
  if (!line) return { ok: false, error: "Not found", status: 404 };
  if (line.amountCents >= 0) return { ok: false, error: "Receipts go on money going out.", status: 400 };
  const claimId = await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(receipts)
      .values({ tenantId, fileName: receipt.fileName, mimeType: receipt.mimeType, byteSize: receipt.data.byteLength, data: receipt.data })
      .returning({ id: receipts.id });
    const [existing] = await tx
      .select()
      .from(expenseClaims)
      .where(and(eq(expenseClaims.tenantId, tenantId), eq(expenseClaims.bankTransactionId, line.id), eq(expenseClaims.kind, "card_receipt"), ne(expenseClaims.status, "void")))
      .limit(1);
    if (existing) {
      const [after] = await tx.update(expenseClaims).set({ receiptId: r.id, updatedAt: new Date() }).where(eq(expenseClaims.id, existing.id)).returning();
      await audit(tx, { tenantId, actor: `user:${user.email}`, action: "receipt.replace", entityType: "expense_claim", entityId: existing.id, before: { receiptId: existing.receiptId }, after: { receiptId: after.receiptId } });
      return existing.id;
    }
    const [row] = await tx
      .insert(expenseClaims)
      .values({
        tenantId,
        claimantName: user.fullName || user.email,
        kind: "card_receipt",
        bankTransactionId: line.id,
        merchant: (line.merchant ?? line.description ?? "").slice(0, 160),
        amountCents: Math.abs(line.amountCents),
        spentOn: line.postedDate,
        categoryId: line.categoryId,
        receiptId: r.id,
        status: "approved",
        decidedBy: user.email,
        decidedAt: new Date(),
      })
      .returning();
    await audit(tx, { tenantId, actor: `user:${user.email}`, action: "receipt.attach", entityType: "expense_claim", entityId: row.id, after: row });
    return row.id;
  });
  return { ok: true, claimId };
}

/** Bank line id to its receipt claim, for the lines on a transactions page. */
export async function receiptsForLines(tenantId: string, lineIds: string[]): Promise<Record<string, string>> {
  const ids = lineIds.filter((x) => UUID_RE.test(x));
  if (!ids.length) return {};
  const rows = await db
    .select({ lineId: expenseClaims.bankTransactionId, id: expenseClaims.id })
    .from(expenseClaims)
    .where(
      and(
        eq(expenseClaims.tenantId, tenantId),
        eq(expenseClaims.kind, "card_receipt"),
        ne(expenseClaims.status, "void"),
        sql`${expenseClaims.receiptId} is not null`,
        inArray(expenseClaims.bankTransactionId, ids),
      ),
    );
  return Object.fromEntries(rows.filter((r) => r.lineId).map((r) => [r.lineId as string, r.id]));
}

/** A claim's receipt bytes, for the tenant (and optionally only one crew member's claims). */
export async function receiptFor(tenantId: string, claimId: string, crewMemberId?: string) {
  if (!UUID_RE.test(claimId)) return null;
  const conds = [eq(expenseClaims.id, claimId), eq(expenseClaims.tenantId, tenantId)];
  if (crewMemberId) conds.push(eq(expenseClaims.crewMemberId, crewMemberId));
  const [row] = await db
    .select({ fileName: receipts.fileName, mimeType: receipts.mimeType, data: receipts.data })
    .from(expenseClaims)
    .innerJoin(receipts, and(eq(expenseClaims.receiptId, receipts.id), eq(receipts.tenantId, tenantId)))
    .where(and(...conds))
    .limit(1);
  return row ?? null;
}

/** Read and check an uploaded receipt from a form. Missing is allowed (null) unless required. */
export async function receiptFromForm(
  form: FormData,
  required: boolean,
): Promise<{ receipt: ReceiptUpload | null } | { error: string; status: number }> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return required ? { error: "Add a photo or PDF of the receipt.", status: 400 } : { receipt: null };
  }
  const { ALLOWED_RECEIPT_TYPES, MAX_RECEIPT_BYTES } = await import("@/lib/expense-logic");
  if (!ALLOWED_RECEIPT_TYPES[file.type]) return { error: "Receipts can be a photo (JPG, PNG, WEBP, HEIC) or a PDF.", status: 415 };
  if (file.size > MAX_RECEIPT_BYTES) return { error: "That file is over 4 MB. Try a smaller photo.", status: 413 };
  const data = Buffer.from(await file.arrayBuffer());
  if (data.byteLength > MAX_RECEIPT_BYTES) return { error: "That file is too large.", status: 413 };
  return { receipt: { fileName: file.name.slice(0, 255), mimeType: file.type, data } };
}

/** The locked-down response every receipt is served with (same as wedding documents). */
export function receiptResponse(r: { fileName: string; mimeType: string; data: Buffer }): Response {
  const safeName = r.fileName.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "receipt";
  return new Response(new Uint8Array(r.data), {
    headers: {
      "Content-Type": r.mimeType,
      "Content-Length": String(r.data.byteLength),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
