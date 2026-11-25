import { and, asc, eq, gt, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankAccounts, bankTransactions, ledgerCategories, weddings } from "@/lib/db/schema";
import { postBankLedgerQuietly } from "@/lib/books/ledger";
import { auditQuietly } from "@/lib/audit";
import { creditFor, type OpenBooking, type PaymentKind } from "@/lib/books/logic";
export { PAYMENT_KINDS, suggestFor, creditFor, type OpenBooking, type PaymentKind, type Suggestion } from "@/lib/books/logic";

// Matching money that came in to the booking it was for. A match is a link on
// the bank line (booking_id + payment_kind) and a sort into an income category
// in one step, so the ledger posts it as income exactly as before; cash basis
// does not change because a deposit has a name on it.
//
// Nothing is matched automatically. Suggestions are shown, a person picks,
// for the same reason the category picker preselects nothing.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const toCents = (numeric: string | null | undefined) => Math.round(Number(numeric ?? 0) * 100);


/** Received through the bank per booking: matched lines the bank has not withdrawn. */
async function receivedByBooking(tenantId: string, ids?: string[]) {
  const rows = await db
    .select({
      bookingId: bankTransactions.bookingId,
      cents: sql<string>`coalesce(sum(${bankTransactions.amountCents}),0)`,
      depositLines: sql<number>`count(*) filter (where ${bankTransactions.paymentKind} = 'deposit')::int`,
    })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.tenantId, tenantId),
        isNotNull(bankTransactions.bookingId),
        isNull(bankTransactions.removedAt),
        ids ? inArray(bankTransactions.bookingId, ids) : undefined,
      ),
    )
    .groupBy(bankTransactions.bookingId);
  return new Map(rows.map((r) => [r.bookingId!, { cents: Number(r.cents), depositLines: r.depositLines }]));
}


/** Bookings that can take a payment: not archived, not cancelled. Soonest event first. */
export async function openBookings(tenantId: string): Promise<OpenBooking[]> {
  const rows = await db
    .select({
      id: weddings.id,
      name: weddings.coupleNames,
      eventDate: weddings.eventDate,
      total: weddings.totalAmount,
      deposit: weddings.depositAmount,
      isDepositPaid: weddings.isDepositPaid,
      isBalancePaid: weddings.isBalancePaid,
    })
    .from(weddings)
    .where(and(eq(weddings.tenantId, tenantId), isNull(weddings.archivedAt), isNull(weddings.booksExcludedAt), ne(weddings.status, "cancelled")))
    .orderBy(asc(weddings.eventDate));
  const received = await receivedByBooking(tenantId);
  return rows.map((r) => {
    const totalCents = toCents(r.total);
    const depositCents = toCents(r.deposit);
    const bank = received.get(r.id) ?? { cents: 0, depositLines: 0 };
    const c = creditFor({
      totalCents,
      depositCents,
      isDepositPaid: !!r.isDepositPaid,
      isBalancePaid: !!r.isBalancePaid,
      bankCents: bank.cents,
      bankDepositLines: bank.depositLines,
    });
    return {
      id: r.id,
      name: r.name,
      eventDate: r.eventDate,
      totalCents,
      depositCents,
      receivedCents: bank.cents,
      depositOutsideBankCents: c.depositOutsideBankCents,
      depositDueCents: c.depositDueCents,
      balanceDueCents: c.balanceDueCents,
    };
  });
}




async function defaultIncomeCategory(tenantId: string): Promise<string | null> {
  const cats = await db
    .select({ id: ledgerCategories.id, name: ledgerCategories.name })
    .from(ledgerCategories)
    .where(and(eq(ledgerCategories.tenantId, tenantId), eq(ledgerCategories.kind, "income"), eq(ledgerCategories.isArchived, false)))
    .orderBy(asc(ledgerCategories.sortOrder), asc(ledgerCategories.name));
  return (cats.find((c) => c.name.toLowerCase() === "event income") ?? cats[0])?.id ?? null;
}

export type MatchResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Tie one money-in line to one booking. Sorts it into an income category
 * (the one given, or "Event income"), pauses rules on it, then marks the
 * booking's deposit or balance paid when what has come in covers it, and posts.
 */
export async function matchLine(
  tenantId: string,
  userId: string,
  input: { transactionId: string; bookingId: string; kind: PaymentKind; categoryId?: string | null },
): Promise<MatchResult> {
  if (!UUID_RE.test(input.transactionId) || !UUID_RE.test(input.bookingId)) return { ok: false, status: 404, error: "Not found" };
  const [booking] = await db
    .select({ id: weddings.id, status: weddings.status })
    .from(weddings)
    .where(and(eq(weddings.id, input.bookingId), eq(weddings.tenantId, tenantId)))
    .limit(1);
  if (!booking) return { ok: false, status: 404, error: "That booking isn't available." };

  let categoryId = input.categoryId ?? null;
  if (categoryId) {
    const [c] = await db
      .select({ id: ledgerCategories.id, kind: ledgerCategories.kind, isArchived: ledgerCategories.isArchived })
      .from(ledgerCategories)
      .where(and(eq(ledgerCategories.id, categoryId), eq(ledgerCategories.tenantId, tenantId)))
      .limit(1);
    if (!c || c.isArchived || c.kind !== "income") return { ok: false, status: 400, error: "Pick an income category for a payment." };
  } else {
    categoryId = await defaultIncomeCategory(tenantId);
    if (!categoryId) return { ok: false, status: 400, error: "Add an income category first." };
  }

  const now = new Date();
  const res = await db
    .update(bankTransactions)
    .set({
      reviewStatus: "categorized",
      categoryId,
      bookingId: booking.id,
      paymentKind: input.kind,
      reviewedAt: now,
      reviewedBy: userId,
      ruleId: null,
      rulesPaused: true,
      updatedAt: now,
    })
    .where(
      and(
        eq(bankTransactions.id, input.transactionId),
        eq(bankTransactions.tenantId, tenantId),
        isNull(bankTransactions.removedAt),
        gt(bankTransactions.amountCents, 0), // only money in pays for a booking
      ),
    )
    .returning({ id: bankTransactions.id });
  if (!res.length) return { ok: false, status: 404, error: "That transaction can't be matched. Only money coming in can." };

  await markPaidFromReceipts(tenantId, booking.id);
  await auditQuietly({ tenantId, actor: `user:${userId}`, action: "bank.match", entityType: "bank_transaction", entityId: input.transactionId, after: { bookingId: booking.id, kind: input.kind, categoryId } });
  await postBankLedgerQuietly(tenantId, { actor: `user:${userId}`, cause: "bank line matched to a job" });
  return { ok: true };
}

/**
 * Set the booking's paid flags when matched money covers them. Only ever sets
 * them to true: the owner may have marked a cash payment paid by hand, and
 * unmatching a bank line must not quietly undo that. The booking page shows
 * what was actually received so a stale flag is visible.
 */
export async function markPaidFromReceipts(tenantId: string, bookingId: string) {
  const [b] = await db
    .select({
      total: weddings.totalAmount,
      deposit: weddings.depositAmount,
      status: weddings.status,
      isDepositPaid: weddings.isDepositPaid,
      isBalancePaid: weddings.isBalancePaid,
    })
    .from(weddings)
    .where(and(eq(weddings.id, bookingId), eq(weddings.tenantId, tenantId)))
    .limit(1);
  if (!b) return;
  const bank = (await receivedByBooking(tenantId, [bookingId])).get(bookingId) ?? { cents: 0, depositLines: 0 };
  const c = creditFor({
    totalCents: toCents(b.total),
    depositCents: toCents(b.deposit),
    isDepositPaid: !!b.isDepositPaid,
    isBalancePaid: !!b.isBalancePaid,
    bankCents: bank.cents,
    bankDepositLines: bank.depositLines,
  });
  const set: Partial<typeof weddings.$inferInsert> = {};
  if (!b.isDepositPaid && c.creditedCents > 0 && c.creditedCents >= toCents(b.deposit)) {
    set.isDepositPaid = true;
    if (b.status === "inquiry") set.status = "deposit_paid";
  }
  if (!b.isBalancePaid && toCents(b.total) > 0 && c.creditedCents >= toCents(b.total)) set.isBalancePaid = true;
  if (Object.keys(set).length) {
    await db
      .update(weddings)
      .set({ ...set, updatedAt: new Date() })
      .where(and(eq(weddings.id, bookingId), eq(weddings.tenantId, tenantId)));
  }
}

export type BookingPayment = {
  id: string;
  postedDate: string;
  amountCents: number;
  kind: string | null;
  label: string;
  accountName: string;
  mask: string | null;
};

/** The bank lines matched to one booking, for its page. */
export async function bookingPayments(tenantId: string, bookingId: string) {
  if (!UUID_RE.test(bookingId)) return { payments: [] as BookingPayment[], receivedCents: 0 };
  const rows = await db
    .select({
      id: bankTransactions.id,
      postedDate: bankTransactions.postedDate,
      amountCents: bankTransactions.amountCents,
      kind: bankTransactions.paymentKind,
      merchant: bankTransactions.merchant,
      description: bankTransactions.description,
      accountName: bankAccounts.name,
      mask: bankAccounts.mask,
    })
    .from(bankTransactions)
    .innerJoin(bankAccounts, eq(bankTransactions.bankAccountId, bankAccounts.id))
    .where(and(eq(bankTransactions.tenantId, tenantId), eq(bankTransactions.bookingId, bookingId), isNull(bankTransactions.removedAt)))
    .orderBy(asc(bankTransactions.postedDate));
  const payments = rows.map((r) => ({
    id: r.id,
    postedDate: r.postedDate,
    amountCents: r.amountCents,
    kind: r.kind,
    label: r.merchant || r.description || "Bank deposit",
    accountName: r.accountName,
    mask: r.mask,
  }));
  return { payments, receivedCents: payments.reduce((s, p) => s + p.amountCents, 0) };
}
