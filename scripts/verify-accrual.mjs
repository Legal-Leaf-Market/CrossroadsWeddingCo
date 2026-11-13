// Checks lib/books/accrual.ts: the accrual posting rules, the live sync with a
// hard cutoff, and the close controls. Run:
// `node --experimental-strip-types scripts/verify-accrual.mjs`.
// Each block names the rule from docs/FINANCIALS_SPEC.md it protects.
import {
  availableActions,
  canCloseInOrder,
  canReopenInOrder,
  checkCloseAction,
  claimEntry,
  closeBlockers,
  jobCostEntry,
  jobRevenueEntry,
  matchedBankAccount,
  netOf,
  periodEnd,
  periodOf,
  planPosting,
} from "../lib/books/accrual.ts";

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

const A = { accounts_receivable: "AR", prepaid_job_costs: "PRE", deferred_revenue: "DEF", accrued_job_costs: "ACC", reimbursements_payable: "RP", job_revenue: "REV", job_costs: "COGS", uncategorized_expense: "UNC" };
const bal = (lines) => lines.reduce((s, l) => s + l.debitCents - l.creditCents, 0);
const net = (d) => (d ? Object.fromEntries([...netOf(d.lines).entries()].sort()) : null);
const T = "2026-11-13";

check("period helpers", [periodOf("2026-11-13"), periodEnd("2026-02-01"), periodEnd("2028-02-01")], ["2026-11-01", "2026-02-28", "2028-02-29"]);

// Rules 1, 3, 4, 6: matched bank money.
const job = { eventDate: "2026-11-07", cancelled: false };
check("1. client pays before or on the day: deferred revenue", [matchedBankAccount({ amountCents: 50000, postedDate: "2026-06-01" }, job), matchedBankAccount({ amountCents: 1, postedDate: "2026-11-07" }, job)], ["deferred_revenue", "deferred_revenue"]);
check("3. client pays after: receivable", matchedBankAccount({ amountCents: 100000, postedDate: "2026-11-08" }, job), "accounts_receivable");
check("4. job cost paid before: prepaid", matchedBankAccount({ amountCents: -10000, postedDate: "2026-11-01" }, job), "prepaid_job_costs");
check("6. job cost paid after: accrued", matchedBankAccount({ amountCents: -10000, postedDate: "2026-11-09" }, job), "accrued_job_costs");
check("9. cancelled job money stays deferred", matchedBankAccount({ amountCents: 50000, postedDate: "2026-12-01" }, { ...job, cancelled: true }), "deferred_revenue");

// Rule 2: recognition on the event date.
const facts = { totalCents: 150000, eventDate: "2026-11-07", cancelled: false, cancelledOn: null, payments: [{ date: "2026-06-01", cents: 50000 }, { date: "2026-11-10", cents: 100000 }], costCents: 15000, prepaid: [{ date: "2026-11-01", cents: 5000 }] };
const rev = jobRevenueEntry(facts, "Kat & Tanis", A, T);
check("2. revenue on the event date, deferred released, rest receivable", [rev.date, net(rev)], ["2026-11-07", { AR: 100000, DEF: 50000, REV: -150000 }]);
check("2. balanced", bal(rev.lines), 0);
check("2. nothing before the event", jobRevenueEntry({ ...facts, eventDate: "2026-12-01" }, "x", A, T), null);
check("2. fully paid ahead: all from deferred, no receivable", net(jobRevenueEntry({ ...facts, payments: [{ date: "2026-10-01", cents: 150000 }] }, "x", A, T)), { DEF: 150000, REV: -150000 });

// Rule 5: matching.
const cost = jobCostEntry(facts, "Kat & Tanis", A, T);
check("5. cost matched on the event date, prepaid released, rest accrued", [cost.date, net(cost)], ["2026-11-07", { ACC: -10000, COGS: 15000, PRE: -5000 }]);
check("5. balanced", bal(cost.lines), 0);
check("5. no cost and nothing prepaid: no entry", jobCostEntry({ ...facts, costCents: 0, prepaid: [] }, "x", A, T), null);
check("5. nothing before the event", jobCostEntry({ ...facts, eventDate: "2026-12-01" }, "x", A, T), null);

// Rule 9: cancellation.
const cancelled = { ...facts, cancelled: true, cancelledOn: "2026-09-15", payments: [{ date: "2026-06-01", cents: 50000 }] };
const cr = jobRevenueEntry(cancelled, "x", A, T);
check("9. kept deposit earned on the cancellation date", [cr.date, net(cr)], ["2026-09-15", { DEF: 50000, REV: -50000 }]);
check("9. prepaid written off on cancellation", net(jobCostEntry(cancelled, "x", A, T)), { COGS: 5000, PRE: -5000 });
check("9. no payment kept: nothing", jobRevenueEntry({ ...cancelled, payments: [] }, "x", A, T), null);

// Rule 7: expense reports.
const c1 = claimEntry({ amountCents: 4200, spentOn: "2026-11-02", merchant: "Shell", claimant: "Nic", categoryAccountId: "FUEL", job: null }, A);
check("7. report to its category, owed back", net(c1), { FUEL: 4200, RP: -4200 });
check("7. no category: uncategorized", net(claimEntry({ amountCents: 100, spentOn: T, merchant: "", claimant: "Nic", categoryAccountId: null, job: null }, A)), { RP: -100, UNC: 100 });
check("7. job receipt before the event is prepaid", net(claimEntry({ amountCents: 900, spentOn: "2026-11-05", merchant: "Ice", claimant: "Nic", categoryAccountId: "X", job: { eventDate: "2026-11-07", cancelled: false, name: "K" } }, A)), { PRE: 900, RP: -900 });
check("7. job receipt after the event is cost of revenue", net(claimEntry({ amountCents: 900, spentOn: "2026-11-08", merchant: "Ice", claimant: "Nic", categoryAccountId: "X", job: { eventDate: "2026-11-07", cancelled: false, name: "K" } }, A)), { COGS: 900, RP: -900 });

// Live sync and the hard cutoff.
const openAll = () => false;
const novLocked = (d) => d.startsWith("2026-10");
const want = { date: "2026-11-07", memo: "m", lines: [{ accountId: "AR", debitCents: 100, creditCents: 0 }, { accountId: "REV", debitCents: 0, creditCents: 100 }] };
const p1 = planPosting(want, [], openAll, T);
check("live: new source posts on its own date", [p1.void, p1.post.map((p) => [p.date, p.kind])], [[], [["2026-11-07", "original"]]]);
const posted = { id: "e1", date: "2026-11-07", fingerprint: p1.post[0].fingerprint, lines: want.lines };
check("live: unchanged source does nothing", planPosting(want, [posted], openAll, T), { void: [], post: [] });
const changed = { ...want, lines: [{ accountId: "AR", debitCents: 150, creditCents: 0 }, { accountId: "REV", debitCents: 0, creditCents: 150 }] };
const p2 = planPosting(changed, [posted], openAll, T);
check("live: changed source voids and reposts while open", [p2.void, p2.post.length, p2.post[0].kind], [["e1"], 1, "original"]);
check("live: source gone voids", planPosting(null, [posted], openAll, T), { void: ["e1"], post: [] });

const oct = { id: "e0", date: "2026-10-20", fingerprint: "x", lines: want.lines };
const wantOct = { ...want, date: "2026-10-20" };
const p3 = planPosting({ ...wantOct, lines: changed.lines }, [oct], novLocked, T);
check("cutoff: closed entry is never voided; the difference posts today", [p3.void, p3.post[0].date, p3.post[0].kind, p3.post[0].adjustsPeriod], [[], T, "adjustment", "2026-10-01"]);
check("cutoff: correction is only the difference", Object.fromEntries([...netOf(p3.post[0].lines).entries()].sort()), { AR: 50, REV: -50 });
const adj = { id: "a1", date: T, fingerprint: p3.post[0].fingerprint, lines: p3.post[0].lines };
check("cutoff: an unchanged correction does nothing", planPosting({ ...wantOct, lines: changed.lines }, [oct, adj], novLocked, T), { void: [], post: [] });
const p4 = planPosting(wantOct, [oct, adj], novLocked, T);
check("cutoff: source back to the closed figure voids the open correction only", [p4.void, p4.post.length], [["a1"], 0]);
const p5 = planPosting(null, [oct], novLocked, T);
check("cutoff: source gone after close reverses it today", [p5.void, p5.post[0].date, Object.fromEntries([...netOf(p5.post[0].lines).entries()].sort())], [[], T, { AR: -100, REV: 100 }]);
const p6 = planPosting(wantOct, [], novLocked, T);
check("cutoff: late source dated in a closed month posts today, saying so", [p6.post[0].date, p6.post[0].adjustsPeriod, p6.post[0].memo.includes("2026-10-20")], [T, "2026-10-01", true]);
let threw = false;
try { planPosting(want, [], () => true, T); } catch { threw = true; }
check("cutoff: nothing posts when today's month is locked", threw, true);

// The close: Jake triggers, Terry approves or vetoes, Nic breaks ties.
const J = new Set(["preparer"]), Te = new Set(["approver"]), N = new Set(["tiebreaker"]);
const act = (action, status, roles, actor, triggeredBy = null, note = "") => checkCloseAction({ action, status, roles, actor, triggeredBy, note });
check("Jake prepares", act("prepare", "open", J, "jake"), { ok: true, to: "prepared" });
check("Nic cannot trigger", act("prepare", "open", N, "nic").ok, false);
check("Terry cannot trigger", act("prepare", "open", Te, "terry").ok, false);
check("Terry approves Jake's close", act("approve", "prepared", Te, "terry", "jake"), { ok: true, to: "closed" });
check("Jake cannot approve", act("approve", "prepared", J, "jake", "jake").ok, false);
check("nobody approves their own trigger", act("approve", "prepared", new Set(["approver", "preparer"]), "jake", "jake").ok, false);
check("a veto needs a reason", act("veto", "prepared", Te, "terry", "jake", "no").ok, false);
check("Terry vetoes with a reason", act("veto", "prepared", Te, "terry", "jake", "Bank not reconciled yet"), { ok: true, to: "vetoed" });
check("Nic cannot act before an escalation", act("tiebreak_close", "vetoed", N, "nic", "jake", "Looks fine to me").ok, false);
check("Jake escalates the veto", act("escalate", "vetoed", J, "jake", "jake", "Difference is a pending deposit"), { ok: true, to: "escalated" });
check("Nic breaks the tie", act("tiebreak_close", "escalated", N, "nic", "jake", "Pending deposit cleared on the 2nd"), { ok: true, to: "closed" });
check("reopen: Jake asks with a reason", act("request_reopen", "closed", J, "jake", null, "Venue refund booked to the wrong month"), { ok: true, to: "reopen_requested" });
check("reopen: Terry approves", act("approve_reopen", "reopen_requested", Te, "terry", "jake"), { ok: true, to: "open" });
check("reopen: Terry vetoes, Jake escalates, Nic decides", [act("veto_reopen", "reopen_requested", Te, "terry", "jake", "Correct it in November instead").ok, act("escalate_reopen", "reopen_vetoed", J, "jake", "jake", "Material to the year").ok, act("tiebreak_keep_closed", "reopen_escalated", N, "nic", "jake", "Correct it in November").ok], [true, true, true]);
check("buttons: Terry sees approve and veto", availableActions("prepared", Te), ["approve", "veto"]);
check("buttons: Nic sees nothing on a prepared month", availableActions("prepared", N), []);

check("order: a month must be over", canCloseInOrder("2026-11-01", T, []), "This month isn't over yet");
check("order: earlier months first", canCloseInOrder("2026-10-01", T, ["2026-08-01", "2026-09-01"]), "Close 2026-08 first");
check("order: fine", canCloseInOrder("2026-10-01", T, []), null);
check("reopen order: latest first", canReopenInOrder("2026-09-01", ["2026-10-01"]), "Reopen 2026-10 first");

const blk = closeBlockers({ unbalancedEntries: 0, unreviewedLines: 2, pendingLines: 1, submittedClaims: 0, uncostedJobs: 0, jobsWithoutPlan: 1, unmatchedHandPayments: 1, transfersInTransitCents: 0, bankDifferences: 0 });
check("blockers: hard and soft", blk.map((b) => `${b.key}:${b.hard}`), ["unreviewed:true", "hand_payments:true", "no_plan:false", "pending:false"]);

if (failures) {
  console.log(`\n${failures} failing`);
  process.exit(1);
}
console.log("\nall passing");
