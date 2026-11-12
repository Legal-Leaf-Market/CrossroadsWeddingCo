import { and, eq, gte, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankAccounts, bankTransactions, integrationConnections } from "@/lib/db/schema";
import { openBookings } from "@/lib/books/matching";
import { queueCounts } from "@/lib/books/review";
import { detectRecurring, expectedBetween, type RecurringCharge } from "@/lib/books/recurring";

// The money home screen ("Am I okay?"): one read of everything the account
// already knows, put in the order an owner asks it. Nothing here is a guess:
// cash is what the bank last reported, what's owed comes from the same credit
// math the matching uses (lib/books/logic.ts creditFor), recurring charges
// need real evidence (lib/books/recurring.ts). There is deliberately no
// "safe to spend" figure: whether deposits held for future events are
// spendable is a policy question for the owner and their accountant.

export type MoneyHome = {
  today: string;
  hasBank: boolean;
  cashCents: number;
  cashAccounts: number;
  cardOwedCents: number;
  cardAccounts: number;
  lastSyncedAt: string | null;
  owedCents: number;
  owedBookings: number;
  pastDue: { id: string; name: string; eventDate: string; cents: number }[];
  heldCents: number;
  heldBookings: number;
  in30: { id: string; name: string; eventDate: string; cents: number }[];
  in30Cents: number;
  out30: { name: string; date: string; amountCents: number }[];
  out30Cents: number;
  recurring: RecurringCharge[];
  recurringMonthlyCents: number;
  toSort: number;
  needsLogin: number;
};

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function moneyHome(tenantId: string): Promise<MoneyHome> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Indiana/Indianapolis" });
  const in30Date = addDays(today, 30);

  const [accts, conns, bookings, counts, lines] = await Promise.all([
    db
      .select({ type: bankAccounts.type, cur: bankAccounts.currentBalanceCents, updatedAt: bankAccounts.updatedAt })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.tenantId, tenantId), eq(bankAccounts.isActive, true))),
    db
      .select({ status: integrationConnections.status, lastSyncedAt: integrationConnections.lastSyncedAt })
      .from(integrationConnections)
      .where(and(eq(integrationConnections.tenantId, tenantId), ne(integrationConnections.status, "disconnected"))),
    openBookings(tenantId),
    queueCounts(tenantId),
    // Money out in the last ~26 months (two yearly charges need that long),
    // posted, kept (not set aside as "Not
    // business"), for the recurring-charge detector.
    db
      .select({
        merchant: bankTransactions.merchant,
        description: bankTransactions.description,
        amountCents: bankTransactions.amountCents,
        postedDate: bankTransactions.postedDate,
      })
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.tenantId, tenantId),
          isNull(bankTransactions.removedAt),
          eq(bankTransactions.pending, false),
          ne(bankTransactions.reviewStatus, "excluded"),
          sql`${bankTransactions.amountCents} < 0`,
          gte(bankTransactions.postedDate, addDays(today, -800)),
        ),
      ),
  ]);

  const cash = accts.filter((a) => a.type === "depository");
  const cards = accts.filter((a) => a.type === "credit" || a.type === "loan");
  const lastSync = conns
    .map((c) => c.lastSyncedAt?.getTime() ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);

  const pastDue: MoneyHome["pastDue"] = [];
  const in30: MoneyHome["in30"] = [];
  let owed = 0;
  let owedBookings = 0;
  let held = 0;
  let heldBookings = 0;
  for (const b of bookings) {
    const credited = b.receivedCents + b.depositOutsideBankCents;
    if (b.balanceDueCents > 0) {
      owed += b.balanceDueCents;
      owedBookings++;
      if (b.eventDate < today) pastDue.push({ id: b.id, name: b.name, eventDate: b.eventDate, cents: b.balanceDueCents });
      else if (b.eventDate <= in30Date) in30.push({ id: b.id, name: b.name, eventDate: b.eventDate, cents: b.balanceDueCents });
    }
    if (b.eventDate >= today && credited > 0) {
      held += credited;
      heldBookings++;
    }
  }

  const recurring = detectRecurring(lines, today);
  const out30 = expectedBetween(recurring, today, in30Date);

  return {
    today,
    hasBank: accts.length > 0,
    cashCents: cash.reduce((s, a) => s + (a.cur ?? 0), 0),
    cashAccounts: cash.length,
    // Plaid reports a card's current balance as the amount owed, positive.
    cardOwedCents: cards.reduce((s, a) => s + Math.max(0, a.cur ?? 0), 0),
    cardAccounts: cards.length,
    lastSyncedAt: lastSync ? new Date(lastSync).toISOString() : null,
    owedCents: owed,
    owedBookings,
    pastDue,
    heldCents: held,
    heldBookings,
    in30,
    in30Cents: in30.reduce((s, x) => s + x.cents, 0),
    out30,
    out30Cents: out30.reduce((s, x) => s + x.amountCents, 0),
    recurring,
    recurringMonthlyCents: recurring.reduce((s, r) => s + r.monthlyCents, 0),
    toSort: counts.unreviewed ?? 0,
    needsLogin: conns.filter((c) => c.status === "needs_reauth").length,
  };
}
