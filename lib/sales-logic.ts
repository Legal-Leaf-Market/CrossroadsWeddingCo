// Sales pipeline and commissions (2026-11-13). Pure: no runtime imports, so
// `node --experimental-strip-types scripts/verify-sales.mjs` checks it.
//
// Owner decisions (Jake, 2026-11-13, asked and answered):
// - Direct commission: a flat $100 per event to whoever closed the deal.
// - Account management: 5% of the contract, ongoing, on every LATER event from
//   an account (a venue, planner or company that keeps sending work), to the
//   account's manager. The account's first booking is the deal itself.
// - Earned on the event day, matched to the event's revenue (accrual); paid
//   out once the client has paid in full. A cancelled event earns nothing.
// - Everyone who closes or manages earns them, owners included (Jake,
//   2026-11-13: "nic, terry, and jake all receive commissions ... they are all
//   owners"; this replaced an earlier "owners split profit only" answer the
//   same morning). A commission is a cost of the job, so it comes out before
//   the owners split what the job leaves.
// Terms are copied onto each sale when it is made, so changing a rate later
// never rewrites a deal already struck.

export const DIRECT_COMMISSION_CENTS = 10_000;
export const ACCOUNT_MANAGEMENT_BPS = 500;

export const CRM_KINDS = ["venue", "planner", "company", "vendor", "couple", "other"] as const;
export type CrmKind = (typeof CRM_KINDS)[number];
export const CRM_KIND_LABEL: Record<CrmKind, string> = {
  venue: "Venue",
  planner: "Planner",
  company: "Company",
  vendor: "Vendor or partner",
  couple: "Couple or family",
  other: "Other",
};

export type Person = { id: string; name: string; payMethod: string | null; retired?: boolean };

/** Who may earn a commission: any crew member still on the crew, owners included. */
export function canEarnCommission(p: Person | undefined | null): boolean {
  return !!p && !p.retired;
}

export type SaleTerms = {
  closerId: string | null;
  managerId: string | null;
  directCents: number;
  mgmtBps: number;
};

/**
 * The terms to copy onto a new sale. The account manager's 5% applies only
 * when the account already has a booking (this one is a LATER event).
 */
export function termsForSale(input: { closer: Person | null; manager: Person | null; accountHasEarlierBooking: boolean }): SaleTerms {
  const closer = canEarnCommission(input.closer) ? input.closer!.id : null;
  const manager = input.accountHasEarlierBooking && canEarnCommission(input.manager) ? input.manager!.id : null;
  return {
    closerId: closer,
    managerId: manager,
    directCents: closer ? DIRECT_COMMISSION_CENTS : 0,
    mgmtBps: manager ? ACCOUNT_MANAGEMENT_BPS : 0,
  };
}

export type Commission = { role: "closer" | "account_manager"; crewId: string; cents: number };

/** What a booking pays in commissions, from the terms on it. Cancelled or left out of the books: nothing. */
export function commissionsFor(b: {
  contractCents: number;
  cancelled: boolean;
  excluded: boolean;
  closerId: string | null;
  managerId: string | null;
  directCents: number | null;
  mgmtBps: number | null;
}): Commission[] {
  if (b.cancelled || b.excluded) return [];
  const out: Commission[] = [];
  if (b.closerId && (b.directCents ?? 0) > 0) out.push({ role: "closer", crewId: b.closerId, cents: b.directCents! });
  if (b.managerId && (b.mgmtBps ?? 0) > 0 && b.contractCents > 0) {
    out.push({ role: "account_manager", crewId: b.managerId, cents: Math.round((b.contractCents * b.mgmtBps!) / 10_000) });
  }
  return out;
}

/** Paid out only once the client has paid in full. */
export function commissionPayable(b: { contractCents: number; creditedCents: number; isBalancePaid: boolean }): boolean {
  return b.isBalancePaid || b.creditedCents >= b.contractCents;
}

// ── The pipeline ─────────────────────────────────────────────────────────────
// Lead (the playbook) -> call log -> sales order (a booking, with its account,
// closer and commission terms) -> invoice (lib/invoice.ts) -> payments (hand or
// bank) -> revenue and commissions in the books on the event day.

export type Stage = "order" | "deposit_in" | "held" | "paid" | "cancelled";

export function stageOf(b: { eventDate: string; cancelled: boolean; isDepositPaid: boolean; paidInFull: boolean }, today: string): Stage {
  if (b.cancelled) return "cancelled";
  if (b.paidInFull && b.eventDate <= today) return "paid";
  if (b.eventDate <= today) return "held";
  return b.isDepositPaid ? "deposit_in" : "order";
}

export const STAGE_LABEL: Record<Stage, string> = {
  order: "Ordered, deposit not in",
  deposit_in: "Deposit in",
  held: "Held, balance owed",
  paid: "Held and paid",
  cancelled: "Cancelled",
};
