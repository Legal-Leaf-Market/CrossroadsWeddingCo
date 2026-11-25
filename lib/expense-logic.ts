// Expense capture, the rules (2026-11-13). Pure: no database, no imports, so
// `node --experimental-strip-types scripts/verify-expenses.mjs` checks it.
//
// Checks and balances (owner, 2026-11-13). Two approvals, in order:
// 1. The REPORT: only the preparer (Jake, CEO, keeps the books) approves or
//    rejects a submitted claim ("only jake can approve expense reports"). The
//    ledger recognizes the expense and the amount owed back at this point.
// 2. The PAYOUT: before any cash moves, the approver (Terry Winchester II,
//    CBO acting CFO, where the buck stops) approves or vetoes the payout. On
//    Terry's own reports the tiebreaker (Nic, COO) decides instead. A veto can
//    be escalated by the preparer to the tiebreaker, whose decision is final.
// Nobody decides a payout to themselves (so on the tiebreaker's own report a
// veto cannot be escalated), and the tiebreaker never initiates
// anything that moves cash (no linking payouts, no escalating).

export type Role = "preparer" | "approver" | "tiebreaker";

export const CLAIM_KINDS = ["reimbursement", "card_receipt"] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

export const CLAIM_STATUSES = ["submitted", "approved", "rejected", "void"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const PAYOUT_STATUSES = ["none", "approved", "vetoed", "escalated"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  submitted: "Waiting for approval",
  approved: "Approved",
  rejected: "Not approved",
  void: "Voided",
};

export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  none: "Payout waiting for approval",
  approved: "Payout approved",
  vetoed: "Payout vetoed",
  escalated: "Veto escalated to the tiebreaker",
};

export const ROLE_LABEL: Record<Role, string> = {
  preparer: "Preparer",
  approver: "Approver",
  tiebreaker: "Tiebreaker",
};

export type ClaimAction =
  | "approve"
  | "reject"
  | "void"
  | "payout_approve"
  | "payout_veto"
  | "payout_escalate"
  | "link"
  | "unlink";

/** Receipts are stored like wedding documents: inert types only, no SVG or HTML. */
export const ALLOWED_RECEIPT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
  "application/pdf": "pdf",
};
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
/** Claims one person may send in a day from their capture link. */
export const DAILY_CLAIM_LIMIT = 20;
/** Largest single claim the capture link accepts; bigger spends go through the owners directly. */
export const MAX_CLAIM_CENTS = 500_000;

function norm(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export type ClaimState = {
  kind: string;
  status: string;
  payoutStatus: string;
  reimbursed: boolean;
  claimantEmail: string | null;
  /** The claimant's own finance roles: on the approver's own report, the tiebreaker decides the payout. */
  claimantRoles: Set<Role>;
  /** The last payout veto was the tiebreaker's, so it is final. */
  vetoFinal: boolean;
};

export type Actor = { email: string; roles: Set<Role> };

export type Decision =
  | { ok: true; status?: ClaimStatus; payoutStatus?: PayoutStatus }
  | { ok: false; error: string };

const no = (error: string): Decision => ({ ok: false, error });

/** Who decides this claim's payout right now: the approver, or the tiebreaker. */
export function payoutDecider(c: Pick<ClaimState, "claimantRoles" | "payoutStatus">): Role {
  if (c.claimantRoles.has("approver")) return "tiebreaker";
  return c.payoutStatus === "escalated" ? "tiebreaker" : "approver";
}

/**
 * Every rule in one place: may this person take this action on this claim,
 * and if so, what does it become? `note` is the reason a reject, void or veto
 * must carry.
 */
export function decide(actor: Actor, c: ClaimState, action: ClaimAction, note = ""): Decision {
  if (!norm(actor.email)) return no("Sign in first.");
  if (c.kind !== "reimbursement") return no("Receipts for bank charges have no approvals.");
  const own = !!norm(c.claimantEmail) && norm(c.claimantEmail) === norm(actor.email);
  const needsNote = note.trim().length < 3;

  switch (action) {
    case "approve":
    case "reject": {
      if (!actor.roles.has("preparer")) return no("Only the preparer approves expense reports.");
      if (c.status !== "submitted") return no(`This report is already ${c.status}.`);
      if (action === "reject" && needsNote) return no("Say why it isn't approved, so they know.");
      return { ok: true, status: action === "approve" ? "approved" : "rejected" };
    }
    case "void": {
      if (!actor.roles.has("preparer")) return no("Only the preparer voids expense reports.");
      if (c.status !== "submitted" && c.status !== "approved") return no(`This report is already ${c.status}.`);
      if (c.reimbursed) return no("This report was already paid back. Unlink the payout first.");
      if (needsNote) return no("Say why it's being voided.");
      return { ok: true, status: "void" };
    }
    case "payout_approve":
    case "payout_veto": {
      if (c.status !== "approved") return no("The report has to be approved before its payout.");
      if (c.reimbursed) return no("This report was already paid back.");
      if (own) return no("Nobody approves or vetoes a payout to themselves.");
      if (c.payoutStatus === "approved") return no("The payout is already approved.");
      if (c.payoutStatus === "vetoed") return no(c.vetoFinal ? "The tiebreaker vetoed this payout. That decision is final." : "The payout was vetoed. The preparer can escalate it to the tiebreaker.");
      const who = payoutDecider(c);
      if (!actor.roles.has(who)) {
        return no(
          who === "tiebreaker"
            ? c.claimantRoles.has("approver")
              ? "This is the approver's own report, so the tiebreaker decides its payout."
              : "This veto was escalated, so the tiebreaker decides."
            : "Only the approver decides payouts.",
        );
      }
      if (action === "payout_veto" && needsNote) return no("Say why the payout is vetoed.");
      return { ok: true, payoutStatus: action === "payout_approve" ? "approved" : "vetoed" };
    }
    case "payout_escalate": {
      if (!actor.roles.has("preparer")) return no("Only the preparer escalates a veto.");
      if (own) return no("Nobody escalates a veto of their own payout.");
      if (c.status !== "approved" || c.payoutStatus !== "vetoed") return no("Only a vetoed payout can be escalated.");
      if (c.vetoFinal) return no("The tiebreaker already decided. That decision is final.");
      // The tiebreaker can't break a tie about his own money, so on his own
      // report the approver's veto stands.
      if (c.claimantRoles.has("tiebreaker")) return no("This is the tiebreaker's own report, so the approver's veto stands.");
      if (needsNote) return no("Say why it should be paid anyway.");
      return { ok: true, payoutStatus: "escalated" };
    }
    case "link":
    case "unlink": {
      if (!actor.roles.has("preparer") && !actor.roles.has("approver")) return no("Only the preparer or the approver records a payout.");
      if (own) return no("Nobody records their own reimbursement. Another owner has to.");
      if (action === "link") {
        if (c.status !== "approved") return no("Only approved reports can be paid.");
        if (c.payoutStatus !== "approved") return no("The payout hasn't been approved yet.");
        if (c.reimbursed) return no("This report is already linked to a payout.");
      } else if (!c.reimbursed) {
        return no("This report isn't linked to a payout.");
      }
      return { ok: true };
    }
  }
}

/** A reimbursement is owed back while approved and not yet linked to a bank payout. */
export function isOwedBack(c: { kind: string; status: string; reimbursedBankTransactionId: string | null }): boolean {
  return c.kind === "reimbursement" && c.status === "approved" && !c.reimbursedBankTransactionId;
}

export function owedBackByPerson(
  claims: { claimantName: string; kind: string; status: string; reimbursedBankTransactionId: string | null; amountCents: number }[],
): { name: string; cents: number; count: number }[] {
  const by = new Map<string, { name: string; cents: number; count: number }>();
  for (const c of claims) {
    if (!isOwedBack(c)) continue;
    const row = by.get(c.claimantName) ?? { name: c.claimantName, cents: 0, count: 0 };
    row.cents += c.amountCents;
    row.count += 1;
    by.set(c.claimantName, row);
  }
  return [...by.values()].sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));
}

/**
 * Can these claims be repaid by this bank line? It must be money out, and the
 * claims must be approved, unpaid reimbursements. The payout may be more than
 * the claims (it can cover other things) but never less: a short payout would
 * leave part of a claim owed with nothing saying so.
 */
export function payoutBlock(
  line: { amountCents: number },
  claims: { kind: string; status: string; reimbursedBankTransactionId: string | null; amountCents: number }[],
): string | null {
  if (line.amountCents >= 0) return "A reimbursement is money going out; pick a money-out line.";
  if (claims.length === 0) return "Pick at least one claim.";
  if (claims.some((c) => !isOwedBack(c))) return "Only approved claims that are still owed back can be linked.";
  const total = claims.reduce((s, c) => s + c.amountCents, 0);
  if (-line.amountCents < total) return "That payout is smaller than the claims picked.";
  return null;
}

/** Dollars as typed ("12", "$12.50", "1,200") to cents; null for anything else. */
export function parseAmount(s: string): number | null {
  const t = s.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const c = Math.round(Number(t) * 100);
  return c > 0 && c <= MAX_CLAIM_CENTS ? c : null;
}

/** A spend date must be a real calendar date, not in the future, and within a year. */
export function spentOnBlock(date: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) return "Pick the date you paid.";
  if (date > today) return "That date hasn't happened yet.";
  const yearAgo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  if (date < yearAgo) return "That's more than a year ago. Send it to the owners directly.";
  return null;
}
