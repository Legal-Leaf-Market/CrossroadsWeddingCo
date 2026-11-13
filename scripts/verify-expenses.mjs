// Checks lib/expense-logic.ts, expense capture's approval rules.
// Run: `node --experimental-strip-types scripts/verify-expenses.mjs`.
//
// The rules it protects (owner, 2026-11-13): only the preparer (Jake) approves
// expense reports; the approver (Terry) approves payouts, except his own,
// which the tiebreaker (Nic) decides; a veto can be escalated by the preparer
// to the tiebreaker, whose word is final; nobody approves a payout to
// themselves; the tiebreaker never initiates anything that moves cash; cash is
// linked only after the payout is approved.
import { decide, isOwedBack, owedBackByPerson, parseAmount, payoutBlock, payoutDecider, spentOnBlock } from "../lib/expense-logic.ts";

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

const claim = (o = {}) => ({
  kind: "reimbursement",
  status: "submitted",
  payoutStatus: "none",
  reimbursed: false,
  claimantEmail: "nic@crossroadsweddingco.shop",
  claimantRoles: new Set(["tiebreaker"]),
  vetoFinal: false,
  ...o,
});
const fromTerry = (o = {}) => claim({ claimantEmail: "terry@crossroadsweddingco.shop", claimantRoles: new Set(["approver"]), ...o });
const fromJake = (o = {}) => claim({ claimantEmail: "jake@crossroadsweddingco.shop", claimantRoles: new Set(["preparer"]), ...o });
const res = (d) => (d.ok ? { status: d.status, payoutStatus: d.payoutStatus } : d.error);

// Stage 1: the report.
check("only the preparer approves a report", [decide(JAKE, claim(), "approve").ok, decide(TERRY, claim(), "approve").ok, decide(NIC, fromTerry(), "approve").ok, decide(STRANGER, claim(), "approve").ok], [true, false, false, false]);
check("preparer approval moves it to approved", res(decide(JAKE, claim(), "approve")), { status: "approved" });
check("the preparer approves his own report (the payout is someone else's)", decide(JAKE, fromJake(), "approve").ok, true);
check("reject needs a reason", [decide(JAKE, claim(), "reject").ok, res(decide(JAKE, claim(), "reject", "not a business cost"))], [false, { status: "rejected" }]);
check("an approved report can't be approved again", decide(JAKE, claim({ status: "approved" }), "approve").ok, false);
check("void: preparer, with a reason, never once paid", [decide(JAKE, claim({ status: "approved" }), "void", "duplicate").ok, decide(TERRY, claim({ status: "approved" }), "void", "duplicate").ok, decide(JAKE, claim({ status: "approved", reimbursed: true }), "void", "dup").ok, decide(JAKE, claim({ status: "approved" }), "void").ok], [true, false, false, false]);

// Stage 2: the payout.
const approved = claim({ status: "approved" });
check("no payout decision before the report is approved", decide(TERRY, claim(), "payout_approve").ok, false);
check("the approver approves a payout", res(decide(TERRY, approved, "payout_approve")), { payoutStatus: "approved" });
check("the preparer and the tiebreaker can't approve an ordinary payout", [decide(JAKE, approved, "payout_approve").ok, decide(NIC, fromJake({ status: "approved" }), "payout_approve").ok], [false, false]);
check("Jake's own report: Terry approves its payout", decide(TERRY, fromJake({ status: "approved" }), "payout_approve").ok, true);
check("Terry's own report: Terry can't touch the payout", [decide(TERRY, fromTerry({ status: "approved" }), "payout_approve").ok, decide(TERRY, fromTerry({ status: "approved" }), "payout_veto", "no").ok], [false, false]);
check("Terry's own report: Nic decides the payout", res(decide(NIC, fromTerry({ status: "approved" }), "payout_approve")), { payoutStatus: "approved" });
check("who decides", [payoutDecider(approved), payoutDecider(fromTerry()), payoutDecider(claim({ payoutStatus: "escalated" }))], ["approver", "tiebreaker", "tiebreaker"]);
check("nobody approves a payout to themselves, whatever their roles", decide({ email: "nic@crossroadsweddingco.shop", roles: new Set(["approver", "tiebreaker"]) }, approved, "payout_approve").ok, false);

// Veto, escalation, final word.
check("a veto needs a reason", [decide(TERRY, approved, "payout_veto").ok, res(decide(TERRY, approved, "payout_veto", "over budget"))], [false, { payoutStatus: "vetoed" }]);
const vetoed = claim({ status: "approved", payoutStatus: "vetoed", claimantEmail: "sam@crew.com", claimantRoles: new Set() });
check("a vetoed payout can't just be approved", decide(TERRY, vetoed, "payout_approve").ok, false);
check("only the preparer escalates, with a reason", [decide(TERRY, vetoed, "payout_escalate", "needed it").ok, decide(NIC, vetoed, "payout_escalate", "needed it").ok, decide(JAKE, vetoed, "payout_escalate").ok, res(decide(JAKE, vetoed, "payout_escalate", "it was for the gig"))], [false, false, false, { payoutStatus: "escalated" }]);
const escalated = claim({ status: "approved", payoutStatus: "escalated", claimantEmail: "someone@crew.com", claimantRoles: new Set() });
check("an escalation is the tiebreaker's", [decide(TERRY, escalated, "payout_approve").ok, decide(NIC, escalated, "payout_approve").ok, decide(NIC, escalated, "payout_veto", "agree with Terry").ok], [false, true, true]);
const finalVeto = claim({ status: "approved", payoutStatus: "vetoed", vetoFinal: true });
check("the tiebreaker's veto is final", [decide(JAKE, finalVeto, "payout_escalate", "again").ok, decide(TERRY, finalVeto, "payout_approve").ok], [false, false]);
check("the tiebreaker's own report: the approver's veto stands", decide(JAKE, claim({ status: "approved", payoutStatus: "vetoed" }), "payout_escalate", "please").ok, false);
check("an ordinary crew member's veto can be escalated", decide(JAKE, claim({ status: "approved", payoutStatus: "vetoed", claimantEmail: "sam@crew.com", claimantRoles: new Set() }), "payout_escalate", "please").ok, true);
check("the preparer can't escalate a veto of his own payout", decide(JAKE, fromJake({ status: "approved", payoutStatus: "vetoed" }), "payout_escalate", "please").ok, false);

// Moving cash.
const payable = claim({ status: "approved", payoutStatus: "approved", claimantEmail: "crew@example.com", claimantRoles: new Set() });
check("cash is linked only after payout approval", [decide(JAKE, approved, "link").ok, decide(JAKE, payable, "link").ok, decide(TERRY, payable, "link").ok], [false, true, true]);
check("the tiebreaker never initiates moving cash", [decide(NIC, payable, "link").ok, decide(NIC, claim({ status: "approved", payoutStatus: "approved", reimbursed: true }), "unlink").ok], [false, false]);
check("nobody records their own reimbursement", decide(JAKE, fromJake({ status: "approved", payoutStatus: "approved" }), "link").ok, false);
check("an already-paid report can't be linked again", decide(JAKE, claim({ status: "approved", payoutStatus: "approved", reimbursed: true, claimantEmail: "x@y.z", claimantRoles: new Set() }), "link").ok, false);
check("card receipts have no approvals", decide(JAKE, claim({ kind: "card_receipt" }), "approve").ok, false);

// Owed back and payouts.
const rows = [
  { claimantName: "Nic", kind: "reimbursement", status: "approved", reimbursedBankTransactionId: null, amountCents: 1250 },
  { claimantName: "Nic", kind: "reimbursement", status: "approved", reimbursedBankTransactionId: null, amountCents: 750 },
  { claimantName: "Terry", kind: "reimbursement", status: "approved", reimbursedBankTransactionId: "b1", amountCents: 9000 },
  { claimantName: "Jake", kind: "reimbursement", status: "submitted", reimbursedBankTransactionId: null, amountCents: 400 },
  { claimantName: "Jake", kind: "card_receipt", status: "approved", reimbursedBankTransactionId: null, amountCents: 999 },
];
check("owed back counts approved, unpaid reimbursements only", owedBackByPerson(rows), [{ name: "Nic", cents: 2000, count: 2 }]);
check("is owed back", [isOwedBack(rows[0]), isOwedBack(rows[2]), isOwedBack(rows[3])], [true, false, false]);
check("payout must be money out", payoutBlock({ amountCents: 2000 }, rows.slice(0, 2)), "A reimbursement is money going out; pick a money-out line.");
check("payout may cover more, never less", [payoutBlock({ amountCents: -2500 }, rows.slice(0, 2)), payoutBlock({ amountCents: -1999 }, rows.slice(0, 2))], [null, "That payout is smaller than the claims picked."]);

// Input.
check("amounts", [parseAmount("12"), parseAmount("$1,200.50"), parseAmount("12.345"), parseAmount("0"), parseAmount("-5"), parseAmount("5000.01")], [1200, 120050, null, null, null, null]);
check("spend dates", [spentOnBlock("2026-11-13", "2026-11-13"), spentOnBlock("2026-11-14", "2026-11-13"), spentOnBlock("2025-11-12", "2026-11-13"), spentOnBlock("2026-02-30x", "2026-11-13")], [null, "That date hasn't happened yet.", "That's more than a year ago. Send it to the owners directly.", "Pick the date you paid."]);

if (failures) {
  console.log(`\n${failures} failing`);
  process.exit(1);
}
console.log("\nall passing");
