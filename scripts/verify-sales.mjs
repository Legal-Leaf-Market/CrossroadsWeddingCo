// Checks the sales pipeline and commission rules (lib/sales-logic.ts) and how
// commissions post (commissionEntry in lib/books/accrual.ts), 2026-11-13.
// Run: `node --experimental-strip-types scripts/verify-sales.mjs`.
import {
  ACCOUNT_MANAGEMENT_BPS,
  canEarnCommission,
  commissionPayable,
  commissionsFor,
  DIRECT_COMMISSION_CENTS,
  stageOf,
  termsForSale,
} from "../lib/sales-logic.ts";
import { commissionEntry, planPosting } from "../lib/books/accrual.ts";
import { jobBalances, tieOut, tieOutDifferences } from "../lib/books/subledger-logic.ts";

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
const T = "2026-11-13";
const jake = { id: "JAKE", name: "Jake", payMethod: "owner" };
const nic = { id: "NIC", name: "Nic", payMethod: "project" };
const terry = { id: "TERRY", name: "Terry", payMethod: "owner" };
const gone = { id: "OLD", name: "Former", payMethod: "project", retired: true };

// ── The owner's terms ───────────────────────────────────────────────────────
check("$100 flat to the closer, 5% to the account manager", [DIRECT_COMMISSION_CENTS, ACCOUNT_MANAGEMENT_BPS], [10000, 500]);
check("owners earn commissions too (Jake, Terry and Nic are all owners)", [canEarnCommission(jake), canEarnCommission(terry), canEarnCommission(nic)], [true, true, true]);
check("someone off the crew earns nothing new", canEarnCommission(gone), false);
check("an account's first deal: the closer's $100 only", termsForSale({ closer: nic, manager: terry, accountHasEarlierBooking: false }), { closerId: "NIC", managerId: null, directCents: 10000, mgmtBps: 0 });
check("a later event from the account: the closer's $100 and the manager's 5%", termsForSale({ closer: jake, manager: terry, accountHasEarlierBooking: true }), { closerId: "JAKE", managerId: "TERRY", directCents: 10000, mgmtBps: 500 });
check("one person can close and manage: both, separately", commissionsFor({ contractCents: 150000, cancelled: false, excluded: false, closerId: "TERRY", managerId: "TERRY", directCents: 10000, mgmtBps: 500 }), [{ role: "closer", crewId: "TERRY", cents: 10000 }, { role: "account_manager", crewId: "TERRY", cents: 7500 }]);
check("no closer recorded: nothing", termsForSale({ closer: null, manager: null, accountHasEarlierBooking: true }), { closerId: null, managerId: null, directCents: 0, mgmtBps: 0 });
check("terms are what the sale carries: an old sale at 3% stays 3%", commissionsFor({ contractCents: 100000, cancelled: false, excluded: false, closerId: null, managerId: "NIC", directCents: null, mgmtBps: 300 }), [{ role: "account_manager", crewId: "NIC", cents: 3000 }]);
check("5% rounds to the cent", commissionsFor({ contractCents: 123457, cancelled: false, excluded: false, closerId: null, managerId: "NIC", directCents: 0, mgmtBps: 500 })[0].cents, 6173);
check("a cancelled event earns nothing", commissionsFor({ contractCents: 100000, cancelled: true, excluded: false, closerId: "NIC", managerId: "NIC", directCents: 10000, mgmtBps: 500 }), []);
check("a booking left out of the books earns nothing", commissionsFor({ contractCents: 100000, cancelled: false, excluded: true, closerId: "NIC", managerId: null, directCents: 10000, mgmtBps: 0 }), []);
check("a booking from before the program (no terms) earns nothing", commissionsFor({ contractCents: 100000, cancelled: false, excluded: false, closerId: null, managerId: null, directCents: null, mgmtBps: null }), []);

// ── Paid only once the client has paid in full ──────────────────────────────
check("paid out once the client has paid in full", [commissionPayable({ contractCents: 100000, creditedCents: 50000, isBalancePaid: false }), commissionPayable({ contractCents: 100000, creditedCents: 100000, isBalancePaid: false }), commissionPayable({ contractCents: 100000, creditedCents: 0, isBalancePaid: true })], [false, true, true]);

// ── Posting: matched to the event, owed to the person ───────────────────────
const A = { undeposited_funds: "UND", accounts_receivable: "AR", prepaid_job_costs: "PRE", deferred_revenue: "DEF", accrued_job_costs: "ACC", reimbursements_payable: "RP", commissions_payable: "CP", job_revenue: "REV", job_costs: "COGS", sales_commissions: "COMM", uncategorized_expense: "UNC" };
const held = { id: "J", eventDate: "2026-11-07", cancelled: false };
const e = commissionEntry({ role: "closer", crewId: "NIC", cents: 10000 }, held, "Kat & Tanis", A, T);
check("on the event date: Dr sales commissions (the job) / Cr commissions payable (the person)", [e.date, e.lines], ["2026-11-07", [{ accountId: "COMM", debitCents: 10000, creditCents: 0, sub: "job:J" }, { accountId: "CP", debitCents: 0, creditCents: 10000, sub: "crew:NIC" }]]);
check("nothing before the event", commissionEntry({ role: "closer", crewId: "NIC", cents: 10000 }, { ...held, eventDate: "2027-04-10" }, "x", A, T), null);
check("nothing for a cancelled event", commissionEntry({ role: "closer", crewId: "NIC", cents: 10000 }, { ...held, cancelled: true }, "x", A, T), null);
const posted = [e, commissionEntry({ role: "account_manager", crewId: "TERRY", cents: 7500 }, held, "x", A, T)].map((d, i) => ({ id: `e${i}`, date: d.date, lines: d.lines }));
const sums = [];
for (const p of posted) for (const l of p.lines) sums.push({ accountId: l.accountId, sub: l.sub ?? null, debit: l.debitCents, credit: l.creditCents });
const accounts = [
  { id: "CP", code: "2600", name: "Commissions payable", type: "liability", systemKey: "commissions_payable" },
  { id: "COMM", code: "5100", name: "Sales commissions", type: "expense", systemKey: "sales_commissions" },
];
const tie = tieOut(sums, accounts);
check("2600 is kept by person and ties", [tie[0].code, tie[0].parties, tieOutDifferences(tie)], ["2600", [{ sub: "crew:NIC", balance: 10000 }, { sub: "crew:TERRY", balance: 7500 }], 0]);
check("the commission lands in the job's cost, so it comes out before the owners split", jobBalances(sums, accounts).get("J").cost, 17500);
// A deal's terms change before the event: the entry follows (live). After the event's month closes: a dated correction.
const plan = planPosting(commissionEntry({ role: "closer", crewId: "NIC", cents: 10000 }, held, "x", A, T), [{ id: "old", date: "2026-11-07", fingerprint: "stale", lines: [] }], () => false, T);
check("live sync: a changed commission voids and reposts while the month is open", [plan.void, plan.post.length], [["old"], 1]);

// ── Pipeline stage ──────────────────────────────────────────────────────────
check("stages", [
  stageOf({ eventDate: "2027-05-01", cancelled: false, isDepositPaid: false, paidInFull: false }, T),
  stageOf({ eventDate: "2027-05-01", cancelled: false, isDepositPaid: true, paidInFull: false }, T),
  stageOf({ eventDate: "2026-11-07", cancelled: false, isDepositPaid: true, paidInFull: false }, T),
  stageOf({ eventDate: "2026-11-07", cancelled: false, isDepositPaid: true, paidInFull: true }, T),
  stageOf({ eventDate: "2026-11-07", cancelled: true, isDepositPaid: true, paidInFull: false }, T),
], ["order", "deposit_in", "held", "paid", "cancelled"]);

if (failures) {
  console.log(`\n${failures} failing`);
  process.exit(1);
}
console.log("\nall passing");
