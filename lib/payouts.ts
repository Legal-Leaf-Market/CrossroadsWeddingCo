import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankAccounts, bankTransactions, crewMembers, expenseClaims, ledgerCategories, payoutRequests, type PayoutRequest } from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import { postBankLedgerQuietly } from "@/lib/books/ledger";
import { rolesFor } from "@/lib/finance-roles";
import { canRequest, decideRequest, requestLinkBlock, type PayoutKind, type RequestAction, type RequestState, type Role } from "@/lib/payout-logic";
import { commissionsByPerson } from "@/lib/sales";
import { HOUSE_TENANT_ID } from "@/lib/tenant-constants";

// Cash payout requests, server side (2026-11-27, finance task 9). Signed-in
// books users only (getBooksWorkspace); the tenant id comes from the session,
// never the browser. Every rule is in lib/payout-logic.ts; this file applies
// them with conditional updates (two people acting at once cannot both win),
// writes the audit log, and asks the ledger to catch up. The bank line's own
// journal entry carries the payout (cashPayoutEntry), so nothing here posts.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Result = { ok: true; id?: string } | { ok: false; error: string; status: number };
export type Requester = { email: string };

const actorLabel = (email: string, roles: Set<Role>) => `user:${email} (${[...roles].join(", ") || "no finance role"})`;

/** Every request for the tenant, newest first, with what the reviewer needs. */
export async function listRequests(tenantId: string) {
  return db
    .select({
      id: payoutRequests.id,
      kind: payoutRequests.kind,
      crewMemberId: payoutRequests.crewMemberId,
      payeeName: payoutRequests.payeeName,
      payeeEmail: crewMembers.email,
      amountCents: payoutRequests.amountCents,
      purpose: payoutRequests.purpose,
      categoryName: ledgerCategories.name,
      status: payoutRequests.status,
      requestedBy: payoutRequests.requestedBy,
      requestedAt: payoutRequests.requestedAt,
      decidedBy: payoutRequests.decidedBy,
      decisionNote: payoutRequests.decisionNote,
      bankTransactionId: payoutRequests.bankTransactionId,
      linkedBy: payoutRequests.linkedBy,
      voidedBy: payoutRequests.voidedBy,
      voidNote: payoutRequests.voidNote,
      linePostedDate: bankTransactions.postedDate,
      lineMerchant: bankTransactions.merchant,
      lineDescription: bankTransactions.description,
    })
    .from(payoutRequests)
    .leftJoin(crewMembers, eq(payoutRequests.crewMemberId, crewMembers.id))
    .leftJoin(ledgerCategories, eq(payoutRequests.categoryId, ledgerCategories.id))
    .leftJoin(bankTransactions, eq(payoutRequests.bankTransactionId, bankTransactions.id))
    .where(eq(payoutRequests.tenantId, tenantId))
    .orderBy(desc(payoutRequests.requestedAt))
    .limit(300);
}
export type RequestRow = Awaited<ReturnType<typeof listRequests>>[number];

/**
 * Who money can go to: the active crew, plus anyone retired who still has
 * commission ready to pay. Leaving the crew (Terry, 2026-11-27) does not cancel
 * what was earned, so a retired person stays payable until they are paid up.
 */
export async function payees(tenantId: string) {
  const [rows, ready] = await Promise.all([
    db
      .select({ id: crewMembers.id, name: crewMembers.name, email: crewMembers.email, retiredAt: crewMembers.retiredAt })
      .from(crewMembers)
      .where(eq(crewMembers.tenantId, tenantId))
      .orderBy(asc(crewMembers.sort), asc(crewMembers.createdAt)),
    commissionsReady(tenantId),
  ]);
  return rows
    .filter((r) => !r.retiredAt || (ready.get(r.id)?.readyCents ?? 0) > 0 || (ready.get(r.id)?.owedCents ?? 0) > 0)
    .map((r) => ({ id: r.id, name: r.retiredAt ? `${r.name} (former crew)` : r.name, email: r.email }));
}

/** What an "other" payout can pay down: expense categories, and equity ones (an owner draw). */
export async function payoutCategories(tenantId: string) {
  return db
    .select({ id: ledgerCategories.id, name: ledgerCategories.name, kind: ledgerCategories.kind })
    .from(ledgerCategories)
    .where(and(eq(ledgerCategories.tenantId, tenantId), inArray(ledgerCategories.kind, ["expense", "equity"]), eq(ledgerCategories.isArchived, false)))
    .orderBy(asc(ledgerCategories.sortOrder), asc(ledgerCategories.name));
}

/** Commission free to request, per crew member (the house account only; commissions are house sales). */
export async function commissionsReady(tenantId: string): Promise<Map<string, { name: string; readyCents: number; owedCents: number }>> {
  if (tenantId !== HOUSE_TENANT_ID) return new Map();
  const rows = await commissionsByPerson(tenantId);
  return new Map(rows.map((r) => [r.crewId, { name: r.name, readyCents: r.readyCents, owedCents: r.owedCents }]));
}

export type NewRequest = {
  kind: PayoutKind;
  crewMemberId: string | null;
  payeeName: string;
  amountCents: number;
  purpose: string;
  categoryId: string | null;
};

/**
 * Open a request. Only the preparer may. A commission names a crew member and
 * may not ask for more than is ready to pay (earned, client paid in full, not
 * already paid or requested); requests are serialized per tenant so two at
 * once cannot both take the same dollars.
 */
export async function createRequest(tenantId: string, user: Requester, input: NewRequest): Promise<Result> {
  const roles = await rolesFor(tenantId, user.email);
  const block = canRequest({ email: user.email, roles });
  if (block) return { ok: false, error: block, status: 403 };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: "Enter the amount.", status: 400 };

  let crew: { id: string; name: string } | null = null;
  if (input.crewMemberId) {
    if (!UUID_RE.test(input.crewMemberId)) return { ok: false, error: "Not found", status: 404 };
    const [c] = await db
      .select({ id: crewMembers.id, name: crewMembers.name })
      .from(crewMembers)
      .where(and(eq(crewMembers.id, input.crewMemberId), eq(crewMembers.tenantId, tenantId)))
      .limit(1);
    if (!c) return { ok: false, error: "Not found", status: 404 };
    crew = c;
  }

  let categoryId: string | null = null;
  if (input.kind === "commission") {
    if (!crew) return { ok: false, error: "Pick who the commission is for.", status: 400 };
    if (tenantId !== HOUSE_TENANT_ID) return { ok: false, error: "This account has no commissions.", status: 400 };
  } else {
    if (!input.categoryId || !UUID_RE.test(input.categoryId)) return { ok: false, error: "Pick what this money pays for.", status: 400 };
    const [cat] = await db
      .select({ id: ledgerCategories.id })
      .from(ledgerCategories)
      .where(and(eq(ledgerCategories.id, input.categoryId), eq(ledgerCategories.tenantId, tenantId), inArray(ledgerCategories.kind, ["expense", "equity"]), eq(ledgerCategories.isArchived, false)))
      .limit(1);
    if (!cat) return { ok: false, error: "Pick one of this account's expense or owner categories.", status: 400 };
    categoryId = cat.id;
  }
  const payeeName = (crew?.name ?? input.payeeName).trim().slice(0, 160);
  if (payeeName.length < 2) return { ok: false, error: "Say who the money goes to.", status: 400 };
  const purpose = input.purpose.trim().slice(0, 1000);
  if (purpose.length < 3) return { ok: false, error: "Say what the payout is for.", status: 400 };

  const out = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`payout_requests:${tenantId}`}))`);
    if (input.kind === "commission") {
      // Read after the lock: an earlier request that held it is committed by now.
      const ready = (await commissionsReady(tenantId)).get(crew!.id)?.readyCents ?? 0;
      if (input.amountCents > ready) return { error: `Only ${(ready / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} of ${crew!.name}'s commissions is ready to pay.` };
    }
    const [row] = await tx
      .insert(payoutRequests)
      .values({ tenantId, kind: input.kind, crewMemberId: crew?.id ?? null, payeeName, amountCents: input.amountCents, purpose, categoryId, requestedBy: user.email })
      .returning();
    await audit(tx, { tenantId, actor: actorLabel(user.email, roles), action: "payout_request.request", entityType: "payout_request", entityId: row.id, after: row, reason: purpose });
    return { id: row.id };
  });
  if ("error" in out) return { ok: false, error: out.error!, status: 400 };
  return { ok: true, id: out.id };
}

async function loadRequest(tenantId: string, id: string) {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .select({ req: payoutRequests, payeeEmail: crewMembers.email })
    .from(payoutRequests)
    .leftJoin(crewMembers, eq(payoutRequests.crewMemberId, crewMembers.id))
    .where(and(eq(payoutRequests.id, id), eq(payoutRequests.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

/** The rules' view of a request: its state plus who the payee and the last decider are. */
export async function stateOf(tenantId: string, req: PayoutRequest, payeeEmail: string | null): Promise<RequestState> {
  const [payeeRoles, deciderRoles] = await Promise.all([
    payeeEmail ? rolesFor(tenantId, payeeEmail) : Promise.resolve(new Set<Role>()),
    req.status === "vetoed" && req.decidedBy ? rolesFor(tenantId, req.decidedBy) : Promise.resolve(new Set<Role>()),
  ]);
  return {
    status: req.status,
    paid: !!req.bankTransactionId,
    requestedBy: req.requestedBy,
    payeeEmail,
    payeeRoles,
    vetoFinal: deciderRoles.has("tiebreaker"),
  };
}

export const DECIDE_ACTIONS = ["approve", "veto", "escalate", "void"] as const;
export type DecideRequestAction = (typeof DECIDE_ACTIONS)[number];

/** One decision on one request: approve, veto, escalate a veto, or void. */
export async function decidePayoutRequest(tenantId: string, user: Requester, id: string, action: DecideRequestAction, note: string): Promise<Result> {
  const found = await loadRequest(tenantId, id);
  if (!found) return { ok: false, error: "Not found", status: 404 };
  const { req, payeeEmail } = found;
  const roles = await rolesFor(tenantId, user.email);
  const d = decideRequest({ email: user.email, roles }, await stateOf(tenantId, req, payeeEmail), action as RequestAction, note);
  if (!d.ok) return { ok: false, error: d.error, status: 403 };
  const now = new Date();
  const set: Partial<typeof payoutRequests.$inferInsert> = { status: d.status, updatedAt: now };
  if (action === "void") Object.assign(set, { voidedBy: user.email, voidedAt: now, voidNote: note.trim() });
  else Object.assign(set, { decidedBy: user.email, decidedAt: now, decisionNote: note.trim() });
  const ok = await db.transaction(async (tx) => {
    const updated = await tx
      .update(payoutRequests)
      .set(set)
      .where(and(eq(payoutRequests.id, id), eq(payoutRequests.tenantId, tenantId), eq(payoutRequests.status, req.status), isNull(payoutRequests.bankTransactionId)))
      .returning();
    if (!updated.length) return false;
    await audit(tx, {
      tenantId,
      actor: actorLabel(user.email, roles),
      action: `payout_request.${action}`,
      entityType: "payout_request",
      entityId: id,
      before: req,
      after: updated[0],
      reason: note.trim() || null,
    });
    return true;
  });
  if (!ok) return { ok: false, error: "Someone else just changed this request. Refresh to see it.", status: 409 };
  return { ok: true };
}

/**
 * Match approved requests to the bank line that paid them (or unmatch with
 * null). The line's journal entry then pays down 2600 (or the category) for
 * each request instead of whatever it posted before.
 */
export async function linkPayoutRequests(tenantId: string, user: Requester, ids: string[], bankTransactionId: string | null): Promise<Result> {
  const unique = [...new Set(ids)].filter((x) => UUID_RE.test(x));
  if (unique.length === 0) return { ok: false, error: "Pick at least one request.", status: 400 };
  const rows = await db
    .select({ req: payoutRequests, payeeEmail: crewMembers.email })
    .from(payoutRequests)
    .leftJoin(crewMembers, eq(payoutRequests.crewMemberId, crewMembers.id))
    .where(and(eq(payoutRequests.tenantId, tenantId), inArray(payoutRequests.id, unique)));
  if (rows.length !== unique.length) return { ok: false, error: "Not found", status: 404 };
  const roles = await rolesFor(tenantId, user.email);
  for (const r of rows) {
    const d = decideRequest({ email: user.email, roles }, await stateOf(tenantId, r.req, r.payeeEmail), bankTransactionId ? "link" : "unlink");
    if (!d.ok) return { ok: false, error: `${r.req.payeeName}: ${d.error}`, status: 403 };
  }

  if (bankTransactionId !== null && !UUID_RE.test(bankTransactionId)) return { ok: false, error: "Not found", status: 404 };

  const result = await db.transaction(async (tx): Promise<Result> => {
    // Serialize with request creation and other links on this tenant.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`payout_requests:${tenantId}`}))`);
    if (bankTransactionId !== null) {
      const [line] = await tx
        .select({ id: bankTransactions.id, amountCents: bankTransactions.amountCents, bookingId: bankTransactions.bookingId })
        .from(bankTransactions)
        .where(and(eq(bankTransactions.id, bankTransactionId), eq(bankTransactions.tenantId, tenantId), isNull(bankTransactions.removedAt), eq(bankTransactions.pending, false)))
        .limit(1);
      if (!line) return { ok: false, error: "Not found", status: 404 };
      const [claims] = await tx
        .select({ cents: sql<number>`coalesce(sum(${expenseClaims.amountCents}),0)::int` })
        .from(expenseClaims)
        .where(and(eq(expenseClaims.tenantId, tenantId), eq(expenseClaims.reimbursedBankTransactionId, bankTransactionId), ne(expenseClaims.status, "void")));
      const [linked] = await tx
        .select({ cents: sql<number>`coalesce(sum(${payoutRequests.amountCents}),0)::int` })
        .from(payoutRequests)
        .where(and(eq(payoutRequests.tenantId, tenantId), eq(payoutRequests.bankTransactionId, bankTransactionId)));
      const block = requestLinkBlock(
        { amountCents: line.amountCents, bookingId: line.bookingId, claimsCents: Number(claims?.cents ?? 0), requestsCents: Number(linked?.cents ?? 0) },
        rows.map((r) => ({ status: r.req.status, paid: !!r.req.bankTransactionId, amountCents: r.req.amountCents })),
      );
      if (block) return { ok: false, error: block, status: 400 };
    }
    const now = new Date();
    for (const r of rows) {
      const updated = await tx
        .update(payoutRequests)
        .set(bankTransactionId ? { bankTransactionId, linkedBy: user.email, linkedAt: now, updatedAt: now } : { bankTransactionId: null, linkedBy: null, linkedAt: null, updatedAt: now })
        .where(
          and(
            eq(payoutRequests.id, r.req.id),
            eq(payoutRequests.tenantId, tenantId),
            eq(payoutRequests.status, "approved"),
            bankTransactionId ? isNull(payoutRequests.bankTransactionId) : eq(payoutRequests.bankTransactionId, r.req.bankTransactionId!),
          ),
        )
        .returning();
      if (!updated.length) throw new Conflict();
      await audit(tx, {
        tenantId,
        actor: actorLabel(user.email, roles),
        action: bankTransactionId ? "payout_request.link" : "payout_request.unlink",
        entityType: "payout_request",
        entityId: r.req.id,
        before: { bankTransactionId: r.req.bankTransactionId },
        after: { bankTransactionId: updated[0].bankTransactionId },
      });
    }
    return { ok: true };
  }).catch((err) => {
    if (err instanceof Conflict) return { ok: false, error: "Someone else just changed one of these. Refresh to see it.", status: 409 } as Result;
    throw err;
  });
  if (result.ok) await postBankLedgerQuietly(tenantId, { actor: user.email, cause: bankTransactionId ? "payout matched to a bank line" : "payout unmatched" });
  return result;
}

class Conflict extends Error {}

/** Money-out bank lines a payout could be matched to: posted, not removed, not tied to a booking, newest first. */
export async function payoutLines(tenantId: string) {
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
        isNull(bankTransactions.bookingId),
        eq(bankTransactions.pending, false),
        sql`${bankTransactions.amountCents} < 0`,
        sql`${bankTransactions.postedDate} >= current_date - 180`,
      ),
    )
    .orderBy(desc(bankTransactions.postedDate))
    .limit(150);
}
