// Checks lib/payout-logic.ts (cash payout requests, finance task 9) and the
// posting rule cashPayoutEntry in lib/books/accrual.ts.
// Run: `node --experimental-strip-types scripts/verify-payouts.mjs`.
//
// The rules it protects (owner, 2026-11-13): Jake requests, Terry approves or
// vetoes, Nic breaks ties; whoever triggers never approves; nobody decides
// money going to themselves; Nic never triggers cash; the bank line is matched
// only after approval; a commission payout pays down 2600 for that person.
import {
  canRequest,
  commissionAvailable,
  decideRequest,
  isOpenRequest,
  parseRequestAmount,
  requestDecider,
  requestLinkBlock,
} from "../lib/payout-logic.ts";
import { cashPayoutEntry, payoutEntry } from "../lib/books/accrual.ts";

let failures = 0;
function check(label, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) console.log(`ok   ${label}`);
  else {
    failures++;
    console.log(`FAIL ${label}\n     got  ${g}\n     want ${w}`);
  }
}

const JAKE = { email: "jake@crossroadsweddingco.shop", roles: new Set(["preparer"]) };
const TERRY = { email: "Terry@CrossroadsWeddingCo.shop", roles: new Set(["approver"]) };
const NIC = { email: "nic@crossroadsweddingco.shop", roles: new Set(["tiebreaker"]) };
const STRANGER = { email: "someone@example.com", roles: new Set() };

const req = (o = {}) => ({
  status: "requested",
  paid: false,
  requestedBy: "jake@crossroadsweddingco.shop",
  payeeEmail: "nic@crossroadsweddingco.shop",
  payeeRoles: new Set(["tiebreaker"]),
  vetoFinal: false,
  ...o,
});
const toTerry = (o = {}) => req({ payeeEmail: "terry@crossroadsweddingco.shop", payeeRoles: new Set(["approver"]), ...o });
const toJake = (o = {}) => req({ payeeEmail: "jake@crossroadsweddingco.shop", payeeRoles: new Set(["preparer"]), ...o });
const toOutsider = (o = {}) => req({ payeeEmail: null, payeeRoles: new Set(), ...o });
const res = (d) => (d.ok ? d.status ?? "ok" : d.error);

// Who may request.
check("Jake can request", canRequest(JAKE), null);
check("Terry can't request", canRequest(TERRY), "Only the preparer requests a payout.");
check("Nic never triggers cash", canRequest(NIC), "Only the preparer requests a payout.");
check("no sign-in, no request", canRequest({ email: "", roles: new Set(["preparer"]) }), "Sign in first.");

// Approve and veto.
check("Terry approves Nic's commission", res(decideRequest(TERRY, req(), "approve")), "approved");
check("Jake, who requested, can't approve", res(decideRequest(JAKE, req(), "approve")), "Whoever requested a payout can't approve it.");
check("Nic can't approve before an escalation", res(decideRequest(NIC, toJake(), "approve")), "Only the approver decides payouts.");
check("Terry approves Jake's own commission", res(decideRequest(TERRY, toJake(), "approve")), "approved");
check("Terry can't approve his own money", res(decideRequest(TERRY, toTerry(), "approve")), "Nobody approves or vetoes money going to themselves.");
check("Nic decides Terry's own money", requestDecider(toTerry()), "tiebreaker");
check("Nic approves Terry's own", res(decideRequest(NIC, toTerry(), "approve")), "approved");
check("Nic can't approve his own money", res(decideRequest(NIC, req({ status: "escalated" }), "approve")), "Nobody approves or vetoes money going to themselves.");
check(
  "the requester never approves, even holding the approver seat",
  res(decideRequest({ email: "jake@crossroadsweddingco.shop", roles: new Set(["preparer", "approver"]) }, toOutsider(), "approve")),
  "Whoever requested a payout can't approve it.",
);
check("a veto needs a reason", res(decideRequest(TERRY, req(), "veto", "")), "Say why the payout is vetoed.");
check("Terry vetoes", res(decideRequest(TERRY, req(), "veto", "not yet")), "vetoed");
check("a stranger can't decide", res(decideRequest(STRANGER, req(), "approve")), "Only the approver decides payouts.");
check("approved can't be approved again", res(decideRequest(TERRY, req({ status: "approved" }), "approve")), "This request is already approved.");
check("vetoed can't be approved", res(decideRequest(TERRY, toJake({ status: "vetoed" }), "approve")), "This was vetoed. The preparer can escalate it to the tiebreaker.");

// Escalation.
check("Jake escalates a veto of his own commission? no", res(decideRequest(JAKE, toJake({ status: "vetoed" }), "escalate", "please")), "Nobody escalates a veto of money going to themselves.");
check("Jake escalates a veto on an outsider's payout", res(decideRequest(JAKE, toOutsider({ status: "vetoed" }), "escalate", "please")), "escalated");
check("escalation needs a reason", res(decideRequest(JAKE, toOutsider({ status: "vetoed" }), "escalate", "")), "Say why it should be paid anyway.");
check("Nic's own money: Terry's veto stands", res(decideRequest(JAKE, req({ status: "vetoed" }), "escalate", "please")), "This money goes to the tiebreaker, so the approver's veto stands.");
check("a final veto can't be escalated", res(decideRequest(JAKE, toOutsider({ status: "vetoed", vetoFinal: true }), "escalate", "please")), "The tiebreaker already decided. That decision is final.");
check("Nic can't escalate", res(decideRequest(NIC, toOutsider({ status: "vetoed" }), "escalate", "please")), "Only the preparer escalates a veto.");
check("after escalation, Nic decides", res(decideRequest(NIC, toOutsider({ status: "escalated" }), "approve")), "approved");
check("after escalation, Terry doesn't", res(decideRequest(TERRY, toOutsider({ status: "escalated" }), "approve")), "This veto was escalated, so the tiebreaker decides.");
check("Nic's veto is final", res(decideRequest(TERRY, toOutsider({ status: "vetoed", vetoFinal: true }), "approve")), "The tiebreaker vetoed this. That decision is final.");

// Void.
check("Jake voids with a reason", res(decideRequest(JAKE, req(), "void", "typo")), "void");
check("void needs a reason", res(decideRequest(JAKE, req(), "void", "")), "Say why it's being voided.");
check("paid can't be voided", res(decideRequest(JAKE, req({ status: "approved", paid: true }), "void", "typo")), "This was already paid. Unlink the bank line first.");
check("Terry can't void", res(decideRequest(TERRY, req(), "void", "typo")), "Only the preparer voids a payout request.");

// Matching to the bank.
check("cash only after approval", res(decideRequest(JAKE, req(), "link")), "The payout hasn't been approved yet.");
check("Jake records Nic's approved payout", res(decideRequest(JAKE, req({ status: "approved" }), "link")), "ok");
check("Terry records it too", res(decideRequest(TERRY, req({ status: "approved" }), "link")), "ok");
check("Nic never records cash", res(decideRequest(NIC, toOutsider({ status: "approved" }), "link")), "Only the preparer or the approver records a payout.");
check("Jake can't record his own", res(decideRequest(JAKE, toJake({ status: "approved" }), "link")), "Nobody records money paid to themselves. Another owner has to.");
check("already matched", res(decideRequest(JAKE, req({ status: "approved", paid: true }), "link")), "This request is already matched to a bank line.");
check("unlink only when matched", res(decideRequest(JAKE, req({ status: "approved" }), "unlink")), "This request isn't matched to a bank line.");

const ok = (o = {}) => ({ status: "approved", paid: false, amountCents: 10000, ...o });
const line = (o = {}) => ({ amountCents: -10000, bookingId: null, claimsCents: 0, requestsCents: 0, ...o });
check("exact match is fine", requestLinkBlock(line(), [ok()]), null);
check("money in refused", requestLinkBlock(line({ amountCents: 10000 }), [ok()]), "A payout is money going out; pick a money-out line.");
check("booking-matched line refused", requestLinkBlock(line({ bookingId: "b" }), [ok()]), "That line is matched to a booking. Pick another, or clear the booking match first.");
check("unapproved refused", requestLinkBlock(line(), [ok({ status: "requested" })]), "Only approved requests that aren't paid yet can be matched.");
check("too much refused", requestLinkBlock(line(), [ok(), ok({ amountCents: 1 })]), "That bank line is smaller than what's picked.");
check("left over refused without expense reports", requestLinkBlock(line({ amountCents: -12000 }), [ok()]), "The requests come to less than the bank line (20.00 left over). Pick every request it paid.");
check("left over fine when expense reports share the line", requestLinkBlock(line({ amountCents: -12000, claimsCents: 1500 }), [ok()]), null);
check("counts requests linked earlier", requestLinkBlock(line({ amountCents: -15000, requestsCents: 5000 }), [ok()]), null);

// Commission availability.
check("ready less paid less open", commissionAvailable({ readyCents: 30000, paidCents: 10000, openCents: 5000 }), 15000);
check("never below zero", commissionAvailable({ readyCents: 10000, paidCents: 10000, openCents: 5000 }), 0);
check("an open veto still holds the money", isOpenRequest({ status: "vetoed", paid: false }), true);
check("a void frees it", isOpenRequest({ status: "void", paid: false }), false);
check("a paid one is not open", isOpenRequest({ status: "approved", paid: true }), false);
check("amount parse", parseRequestAmount("$1,250.50"), 125050);
check("amount parse refuses junk", parseRequestAmount("12.345"), null);
check("amount parse refuses zero", parseRequestAmount("0"), null);

// Posting.
const A = { commissions_payable: "2600", reimbursements_payable: "2500", uncategorized_expense: "6990" };
const sum = (lines, side) => lines.reduce((s, l) => s + l[side], 0);
const p1 = cashPayoutEntry({ amountCents: -10000, postedDate: "2026-11-20", memo: "Zelle Nic" }, [], [{ amountCents: 10000, accountId: "2600", sub: "crew:NIC" }], "CASH", A);
check("commission payout: Dr 2600 (Nic) / Cr cash", p1.lines, [
  { accountId: "2600", debitCents: 10000, creditCents: 0, sub: "crew:NIC" },
  { accountId: "CASH", debitCents: 0, creditCents: 10000 },
]);
const claims = [{ amountCents: 4200, personKey: "crew:NIC" }];
check(
  "no requests is exactly payoutEntry (no fingerprint churn)",
  cashPayoutEntry({ amountCents: -5000, postedDate: "2026-11-20", memo: "m" }, claims, [], "CASH", A),
  payoutEntry({ amountCents: -5000, postedDate: "2026-11-20", memo: "m" }, claims, "CASH", A),
);
const p2 = cashPayoutEntry(
  { amountCents: -15000, postedDate: "2026-11-20", memo: "Zelle Nic" },
  claims,
  [{ amountCents: 10000, accountId: "2600", sub: "crew:NIC" }],
  "CASH",
  A,
);
check("one line paying a commission and an expense report balances", sum(p2.lines, "debitCents"), sum(p2.lines, "creditCents"));
check("the bank is credited once for the whole line", p2.lines.filter((l) => l.accountId === "CASH"), [{ accountId: "CASH", debitCents: 0, creditCents: 15000 }]);
check(
  "the expense report part keeps the reimbursement rule (extra on Nic's 2500)",
  p2.lines.filter((l) => l.accountId === "2500"),
  [{ accountId: "2500", debitCents: 5000, creditCents: 0, sub: "crew:NIC" }],
);
const p3 = cashPayoutEntry({ amountCents: -12000, postedDate: "2026-11-20", memo: "drift" }, [], [{ amountCents: 10000, accountId: "6100", sub: null }], "CASH", A);
check("a bank amount that drifted lands on 6990 and still balances", p3.lines.find((l) => l.accountId === "6990"), { accountId: "6990", debitCents: 2000, creditCents: 0 });

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall payout checks passed");
