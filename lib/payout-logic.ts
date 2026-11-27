// Cash payout requests, the rules (2026-11-27, finance task 9). Pure: no
// database, no imports, so `node --experimental-strip-types
// scripts/verify-payouts.mjs` checks it.
//
// Any money going out that is not an expense report (a commission, an owner
// draw, a contractor paid outside the cost plan) goes through one request
// before the bank line can be matched as that payout. Checks and balances
// (owner, 2026-11-13, docs/handoff task 9):
// - The preparer (Jake, CEO) requests. The tiebreaker (Nic, COO) never
//   triggers cash, so he can't request, link or escalate.
// - The approver approves or vetoes (Nic since 2026-11-27, when Terry left;
//   the tiebreaker seat is empty until a second approver is seated, so money
//   going to Nic and escalated vetoes wait).
//   When the money is going to the approver himself, the tiebreaker decides.
// - The preparer may escalate a veto to the tiebreaker, whose word is final,
//   EXCEPT when the money is the tiebreaker's own: then the approver's veto
//   stands (nobody decides their own money).
// - Whoever requested never approves, and nobody approves, vetoes or records
//   a payout of money going to themselves.
// - The bank line is matched (linked) only once the request is approved.

export type Role = "preparer" | "approver" | "tiebreaker";

export const PAYOUT_KINDS = ["commission", "other"] as const;
export type PayoutKind = (typeof PAYOUT_KINDS)[number];

export const PAYOUT_KIND_LABEL: Record<PayoutKind, string> = {
  commission: "Commission",
  other: "Other money out",
};

export const REQUEST_STATUSES = ["requested", "approved", "vetoed", "escalated", "void"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  requested: "Waiting for approval",
  approved: "Approved to pay",
  vetoed: "Vetoed",
  escalated: "Veto escalated to the tiebreaker",
  void: "Voided",
};

export type RequestAction = "approve" | "veto" | "escalate" | "void" | "link" | "unlink";

/** Largest single request; bigger money moves are a conversation, not a form. */
export const MAX_REQUEST_CENTS = 500_000; // $5,000 (owner, 2026-11-27)

function norm(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export type Actor = { email: string; roles: Set<Role> };

export type RequestState = {
  status: string;
  /** Linked to the bank line that paid it. */
  paid: boolean;
  requestedBy: string;
  /** The payee's sign-in email (from the crew row), when the money goes to a person on the crew. */
  payeeEmail: string | null;
  payeeRoles: Set<Role>;
  /** The last veto was the tiebreaker's, so it is final. */
  vetoFinal: boolean;
};

export type Decision = { ok: true; status?: RequestStatus } | { ok: false; error: string };
const no = (error: string): Decision => ({ ok: false, error });

/** May this person open a request for money going to this payee? */
export function canRequest(actor: Actor): string | null {
  if (!norm(actor.email)) return "Sign in first.";
  if (!actor.roles.has("preparer")) return "Only the preparer requests a payout.";
  return null;
}

/** Who decides this request right now: the approver, or the tiebreaker. */
export function requestDecider(r: Pick<RequestState, "payeeRoles" | "status">): Role {
  if (r.payeeRoles.has("approver")) return "tiebreaker";
  return r.status === "escalated" ? "tiebreaker" : "approver";
}

/** Every rule in one place. `note` is the reason a veto, void or escalation must carry. */
export function decideRequest(actor: Actor, r: RequestState, action: RequestAction, note = ""): Decision {
  if (!norm(actor.email)) return no("Sign in first.");
  const own = !!norm(r.payeeEmail) && norm(r.payeeEmail) === norm(actor.email);
  const requester = norm(r.requestedBy) === norm(actor.email);
  const needsNote = note.trim().length < 3;

  switch (action) {
    case "approve":
    case "veto": {
      if (r.status !== "requested" && r.status !== "escalated") {
        return no(r.status === "vetoed" ? (r.vetoFinal ? "The tiebreaker vetoed this. That decision is final." : "This was vetoed. The preparer can escalate it to the tiebreaker.") : `This request is already ${r.status}.`);
      }
      if (own) return no("Nobody approves or vetoes money going to themselves.");
      if (requester) return no("Whoever requested a payout can't approve it.");
      const who = requestDecider(r);
      if (!actor.roles.has(who)) {
        return no(
          who === "tiebreaker"
            ? r.payeeRoles.has("approver")
              ? "This money goes to the approver, so the tiebreaker decides."
              : "This veto was escalated, so the tiebreaker decides."
            : "Only the approver decides payouts.",
        );
      }
      if (action === "veto" && needsNote) return no("Say why the payout is vetoed.");
      return { ok: true, status: action === "approve" ? "approved" : "vetoed" };
    }
    case "escalate": {
      if (!actor.roles.has("preparer")) return no("Only the preparer escalates a veto.");
      if (own) return no("Nobody escalates a veto of money going to themselves.");
      if (r.status !== "vetoed") return no("Only a vetoed request can be escalated.");
      if (r.vetoFinal) return no("The tiebreaker already decided. That decision is final.");
      if (r.payeeRoles.has("tiebreaker")) return no("This money goes to the tiebreaker, so the approver's veto stands.");
      if (needsNote) return no("Say why it should be paid anyway.");
      return { ok: true, status: "escalated" };
    }
    case "void": {
      if (!actor.roles.has("preparer")) return no("Only the preparer voids a payout request.");
      if (r.status === "void") return no("This request is already voided.");
      if (r.paid) return no("This was already paid. Unlink the bank line first.");
      if (needsNote) return no("Say why it's being voided.");
      return { ok: true, status: "void" };
    }
    case "link":
    case "unlink": {
      if (!actor.roles.has("preparer") && !actor.roles.has("approver")) return no("Only the preparer or the approver records a payout.");
      if (own) return no("Nobody records money paid to themselves. Another owner has to.");
      if (action === "link") {
        if (r.status !== "approved") return no("The payout hasn't been approved yet.");
        if (r.paid) return no("This request is already matched to a bank line.");
      } else if (!r.paid) {
        return no("This request isn't matched to a bank line.");
      }
      return { ok: true };
    }
  }
}

/**
 * Can these approved requests be matched to this bank line? It must be money
 * out, not already matched to a booking, and the requests must be approved
 * and unpaid. Everything matched to the line (expense reports, requests
 * linked earlier, these) may not add up to more than it paid. With no expense
 * reports on the line, the requests must add up to exactly what it paid: the
 * reimbursement rule puts any extra on the person as an advance, but a
 * commission line has no such place, and an unexplained remainder would sit
 * on cash with nobody's name on it.
 */
export function requestLinkBlock(
  line: { amountCents: number; bookingId: string | null; claimsCents: number; requestsCents: number },
  picked: { status: string; paid: boolean; amountCents: number }[],
): string | null {
  if (line.amountCents >= 0) return "A payout is money going out; pick a money-out line.";
  if (line.bookingId) return "That line is matched to a booking. Pick another, or clear the booking match first.";
  if (picked.length === 0) return "Pick at least one request.";
  if (picked.some((p) => p.status !== "approved" || p.paid)) return "Only approved requests that aren't paid yet can be matched.";
  const paid = -line.amountCents;
  const total = line.claimsCents + line.requestsCents + picked.reduce((s, p) => s + p.amountCents, 0);
  if (total > paid) return "That bank line is smaller than what's picked.";
  if (line.claimsCents === 0 && total !== paid) return `The requests come to less than the bank line (${((paid - total) / 100).toFixed(2)} left over). Pick every request it paid.`;
  return null;
}

/**
 * Commission still free to request for one person: what is payable (the
 * event happened and the client paid in full), less what was already paid
 * out and what is already asked for in an open request. Never below zero.
 */
export function commissionAvailable(p: { readyCents: number; paidCents: number; openCents: number }): number {
  return Math.max(0, p.readyCents - p.paidCents - p.openCents);
}

/** A request still holding money: not vetoed for good, not voided, not yet paid. */
export function isOpenRequest(r: { status: string; paid: boolean }): boolean {
  return !r.paid && (r.status === "requested" || r.status === "approved" || r.status === "escalated" || r.status === "vetoed");
}

/** Dollars as typed ("100", "$1,250.50") to cents; null for anything else. */
export function parseRequestAmount(s: string): number | null {
  const t = s.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const c = Math.round(Number(t) * 100);
  return c > 0 && c <= MAX_REQUEST_CENTS ? c : null;
}

export const ROLE_LABEL_PAYOUT: Record<Role, string> = {
  preparer: "Preparer",
  approver: "Approver",
  tiebreaker: "Tiebreaker",
};
