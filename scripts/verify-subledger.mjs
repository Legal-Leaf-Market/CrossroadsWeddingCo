// Checks the subledger keys on every posting, the control-account tie-out and
// the job costing page read from the ledger (2026-11-13, docs/handoff tasks 2
// and 3). Run: `node --experimental-strip-types scripts/verify-subledger.mjs`.
//
// The end-to-end block runs a small book of jobs, receipts and payouts through
// the REAL posting rules (lib/books/accrual.ts) and the live sync
// (planPosting), into an in-memory journal, then reads it back the way the
// pages do (lib/books/subledger-logic.ts). The core claim: the job costing
// page's totals equal the general ledger balances of 1100, 1300, 2300 and 2400.
import {
  closeBlockers,
  compactFingerprint,
  fingerprint,
  jobEntries,
  keyedClaimEntry,
  matchedBankEntry,
  netByAccount,
  netOf,
  payoutEntry,
  planPosting,
  tidy,
} from "../lib/books/accrual.ts";
import { jobBalances, jobsPage, register, tieOut, tieOutDifferences } from "../lib/books/subledger-logic.ts";

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
const ACCOUNTS = [
  { id: "CASH", code: "1010", name: "Checking", type: "asset", systemKey: null },
  { id: "AR", code: "1100", name: "Accounts receivable", type: "asset", systemKey: "accounts_receivable" },
  { id: "PRE", code: "1300", name: "Prepaid job costs", type: "asset", systemKey: "prepaid_job_costs" },
  { id: "DEF", code: "2300", name: "Deferred revenue", type: "liability", systemKey: "deferred_revenue" },
  { id: "ACC", code: "2400", name: "Accrued job costs", type: "liability", systemKey: "accrued_job_costs" },
  { id: "RP", code: "2500", name: "Reimbursements payable", type: "liability", systemKey: "reimbursements_payable" },
  { id: "REV", code: "4500", name: "Event revenue", type: "income", systemKey: "job_revenue" },
  { id: "COGS", code: "5000", name: "Cost of revenue", type: "expense", systemKey: "job_costs" },
  { id: "GAS", code: "6010", name: "Fuel", type: "expense", systemKey: null },
  { id: "UNC", code: "6990", name: "Uncategorized", type: "expense", systemKey: "uncategorized_expense" },
];
const T = "2026-11-13";
const obj = (m) => Object.fromEntries([...m.entries()].sort());

// ── Fingerprints ────────────────────────────────────────────────────────────
// Untagged postings keep exactly the old fingerprint, so the conversion does
// not churn every bank entry; only entries that gain a key repost once.
const plain = { date: "2026-10-01", memo: "x", lines: [{ accountId: "CASH", debitCents: 500, creditCents: 0 }, { accountId: "GAS", debitCents: 0, creditCents: 500 }] };
check("untagged fingerprint is unchanged from before keys existed", fingerprint(plain), "2026-10-01|CASH:500,GAS:-500");
const tagged = { ...plain, lines: [plain.lines[0], { ...plain.lines[1], sub: "job:J1" }] };
check("a key changes the fingerprint (the entry reposts once with its key)", fingerprint(tagged) !== fingerprint(plain), true);
const long = "x".repeat(250);
check("short fingerprints are stored as they are", compactFingerprint("abc"), "abc");
check("long fingerprints are hashed, never cut off", [compactFingerprint(long).length <= 200, compactFingerprint(long) === compactFingerprint(long), compactFingerprint(long) !== compactFingerprint(`${long}y`)], [true, true, true]);
check("two long fingerprints that share their first 200 characters still differ", compactFingerprint(`${"z".repeat(200)}|AR:1`) !== compactFingerprint(`${"z".repeat(200)}|AR:2`), true);

// ── Keys per posting rule ───────────────────────────────────────────────────
const job = { id: "J1", eventDate: "2026-10-17", cancelled: false };
const dep = matchedBankEntry({ amountCents: 50000, postedDate: "2026-06-01", memo: "dep" }, job, "CASH", A);
check("rule 1: client deposit keys deferred revenue to the job, not the bank", dep.lines, [{ accountId: "CASH", debitCents: 50000, creditCents: 0 }, { accountId: "DEF", debitCents: 0, creditCents: 50000, sub: "job:J1" }]);
const bal = matchedBankEntry({ amountCents: 50000, postedDate: "2026-10-18", memo: "bal" }, job, "CASH", A);
check("rule 3: payment after the event keys the receivable", bal.lines[1], { accountId: "AR", debitCents: 0, creditCents: 50000, sub: "job:J1" });
const pre = matchedBankEntry({ amountCents: -8000, postedDate: "2026-10-01", memo: "rent" }, job, "CASH", A);
check("rule 4: job cost paid before keys prepaid", pre.lines[0], { accountId: "PRE", debitCents: 8000, creditCents: 0, sub: "job:J1" });

const facts = { totalCents: 100000, eventDate: "2026-10-17", cancelled: false, cancelledOn: null, payments: [{ date: "2026-06-01", cents: 50000 }], costCents: 20000, prepaid: [{ date: "2026-10-01", cents: 8000 }] };
const je = jobEntries(facts, "J1", "Valle Vista", A, T);
check("rule 2: every revenue line is keyed to the job", je.revenue.lines.map((l) => [l.accountId, l.sub]), [["AR", "job:J1"], ["DEF", "job:J1"], ["REV", "job:J1"]]);
check("rule 5: every cost line is keyed to the job", je.cost.lines.map((l) => [l.accountId, l.sub]), [["COGS", "job:J1"], ["PRE", "job:J1"], ["ACC", "job:J1"]]);

const jc = keyedClaimEntry({ amountCents: 4200, spentOn: "2026-10-10", merchant: "Lowe's", claimant: "Nic", categoryAccountId: "GAS", job: { eventDate: "2026-10-17", cancelled: false, name: "VV" }, jobId: "J1", personKey: "crew:NIC" }, A);
check("rule 7: job receipt keys prepaid to the job and the amount owed to the person", jc.lines, [{ accountId: "PRE", debitCents: 4200, creditCents: 0, sub: "job:J1" }, { accountId: "RP", debitCents: 0, creditCents: 4200, sub: "crew:NIC" }]);
const nc = keyedClaimEntry({ amountCents: 1500, spentOn: "2026-10-10", merchant: "Shell", claimant: "Nic", categoryAccountId: "GAS", job: null, jobId: null, personKey: "crew:NIC" }, A);
check("rule 7: a receipt with no job leaves the expense unkeyed and keys the person", nc.lines, [{ accountId: "GAS", debitCents: 1500, creditCents: 0 }, { accountId: "RP", debitCents: 0, creditCents: 1500, sub: "crew:NIC" }]);

const p1 = payoutEntry({ amountCents: -5700, postedDate: "2026-10-20", memo: "Zelle Nic" }, [{ amountCents: 4200, personKey: "crew:NIC" }, { amountCents: 1500, personKey: "crew:NIC" }], "CASH", A);
check("rule 8: a payout draws down the person's balance", p1.lines, [{ accountId: "RP", debitCents: 5700, creditCents: 0, sub: "crew:NIC" }, { accountId: "CASH", debitCents: 0, creditCents: 5700 }]);
const p2 = payoutEntry({ amountCents: -6000, postedDate: "2026-10-20", memo: "Zelle Nic" }, [{ amountCents: 5700, personKey: "crew:NIC" }], "CASH", A);
check("rule 8: one person paid more than claimed: the extra is theirs (an advance)", netOf(p2.lines).get("RP\u0001crew:NIC"), 6000);
const p3 = payoutEntry({ amountCents: -10000, postedDate: "2026-10-20", memo: "Zelle" }, [{ amountCents: 4000, personKey: "crew:NIC" }, { amountCents: 5000, personKey: "crew:JAKE" }], "CASH", A);
check("rule 8: several people paid more than claimed: the extra stays unkeyed", [netOf(p3.lines).get("RP\u0001crew:NIC"), netOf(p3.lines).get("RP\u0001crew:JAKE"), netOf(p3.lines).get("RP")], [4000, 5000, 1000]);
check("payouts balance", [p1, p2, p3].map((d) => d.lines.reduce((s, l) => s + l.debitCents - l.creditCents, 0)), [0, 0, 0]);
check("tidy keeps keys apart on one account", tidy([{ accountId: "RP", debitCents: 10, creditCents: 0, sub: "crew:A" }, { accountId: "RP", debitCents: 0, creditCents: 10, sub: "crew:B" }]).length, 2);

// ── End to end: a small book through the live sync ──────────────────────────
let seq = 0;
function sync(journal, sources, locked = () => false, today = T) {
  for (const s of sources) {
    const live = journal.filter((e) => e.ref === s.ref && e.status === "posted");
    const plan = planPosting(s.desired, live, locked, today);
    for (const id of plan.void) journal.find((e) => e.id === id).status = "void";
    for (const p of plan.post) journal.push({ id: `e${++seq}`, ref: s.ref, date: p.date, fingerprint: p.fingerprint, lines: p.lines, status: "posted", adjustsPeriod: p.adjustsPeriod });
  }
  return journal;
}
function sums(journal, asOf = "9999-12-31") {
  const m = new Map();
  for (const e of journal) {
    if (e.status !== "posted" || e.date > asOf) continue;
    for (const l of e.lines) {
      const k = `${l.accountId}|${l.sub ?? ""}`;
      const r = m.get(k) ?? { accountId: l.accountId, sub: l.sub ?? null, debit: 0, credit: 0 };
      r.debit += l.debitCents;
      r.credit += l.creditCents;
      m.set(k, r);
    }
  }
  return [...m.values()];
}
const ledgerBalance = (journal, accountId) => {
  const a = ACCOUNTS.find((x) => x.id === accountId);
  const net = netByAccount(journal.filter((e) => e.status === "posted").flatMap((e) => e.lines)).get(accountId) ?? 0;
  return a.type === "asset" || a.type === "expense" ? net : -net;
};

function book() {
  const J = {
    A: { id: "A", name: "Valle Vista (held)", eventDate: "2026-10-17", cancelled: false, cancelledOn: null, totalCents: 100000 },
    B: { id: "B", name: "Kat & Tanis (held, owes)", eventDate: "2026-11-07", cancelled: false, cancelledOn: null, totalCents: 120000 },
    C: { id: "C", name: "Spring 2027 (ahead)", eventDate: "2027-04-10", cancelled: false, cancelledOn: null, totalCents: 150000 },
    D: { id: "D", name: "Cancelled", eventDate: "2026-12-05", cancelled: true, cancelledOn: "2026-11-02", totalCents: 100000 },
  };
  const bank = [
    { ref: "bank_transaction:1", job: "A", amountCents: 50000, postedDate: "2026-06-01" },
    { ref: "bank_transaction:2", job: "A", amountCents: 50000, postedDate: "2026-10-18" },
    { ref: "bank_transaction:3", job: "A", amountCents: -8000, postedDate: "2026-10-01" },
    { ref: "bank_transaction:4", job: "A", amountCents: -12000, postedDate: "2026-10-20" },
    { ref: "bank_transaction:5", job: "B", amountCents: 50000, postedDate: "2026-09-01" },
    { ref: "bank_transaction:6", job: "C", amountCents: 50000, postedDate: "2026-11-05" },
    { ref: "bank_transaction:7", job: "C", amountCents: -3000, postedDate: "2026-11-06" },
    { ref: "bank_transaction:8", job: "D", amountCents: 50000, postedDate: "2026-08-01" },
  ];
  const claims = [
    { ref: "expense_claim:1", job: "B", amountCents: 4200, spentOn: "2026-11-01", person: "crew:NIC" },
    { ref: "expense_claim:2", job: null, amountCents: 1500, spentOn: "2026-11-02", person: "crew:NIC" },
    { ref: "expense_claim:3", job: "B", amountCents: 2500, spentOn: "2026-11-08", person: "crew:JAKE" },
  ];
  const planCost = { A: 20000, B: 30000, C: 25000, D: 0 };
  const sources = [];
  const pay = {}, prep = {};
  for (const b of bank) {
    const j = J[b.job];
    sources.push({ ref: b.ref, desired: matchedBankEntry({ amountCents: b.amountCents, postedDate: b.postedDate, memo: b.ref }, j, "CASH", A) });
    if (b.amountCents > 0) (pay[j.id] ??= []).push({ date: b.postedDate, cents: b.amountCents });
    else if (b.postedDate <= j.eventDate) (prep[j.id] ??= []).push({ date: b.postedDate, cents: -b.amountCents });
  }
  for (const c of claims) {
    const j = c.job ? J[c.job] : null;
    if (j && c.spentOn <= j.eventDate) (prep[j.id] ??= []).push({ date: c.spentOn, cents: c.amountCents });
    sources.push({ ref: c.ref, desired: keyedClaimEntry({ amountCents: c.amountCents, spentOn: c.spentOn, merchant: "m", claimant: c.person, categoryAccountId: "GAS", job: j ? { eventDate: j.eventDate, cancelled: j.cancelled, name: j.name } : null, jobId: j?.id ?? null, personKey: c.person }, A) });
  }
  sources.push({ ref: "bank_transaction:9", desired: payoutEntry({ amountCents: -5700, postedDate: "2026-11-10", memo: "Zelle Nic" }, [{ amountCents: 4200, personKey: "crew:NIC" }, { amountCents: 1500, personKey: "crew:NIC" }], "CASH", A) });
  for (const j of Object.values(J)) {
    const jobClaims = claims.filter((c) => c.job === j.id && c.spentOn <= j.eventDate).reduce((s, c) => s + c.amountCents, 0);
    const e = jobEntries({ ...j, payments: pay[j.id] ?? [], prepaid: prep[j.id] ?? [], costCents: planCost[j.id] + (j.cancelled ? 0 : jobClaims) }, j.id, j.name, A, T);
    sources.push({ ref: `job_revenue:${j.id}`, desired: e.revenue }, { ref: `job_cost:${j.id}`, desired: e.cost });
  }
  const info = Object.values(J).map((j) => ({ id: j.id, name: j.name, eventDate: j.eventDate, cancelled: j.cancelled, archived: false, contractCents: j.totalCents, plannedCostCents: planCost[j.id], missing: 0, hasPlan: true }));
  return { sources, info };
}

const { sources, info } = book();
const journal = sync([], sources);
check("every posted entry balances", journal.every((e) => e.lines.reduce((s, l) => s + l.debitCents - l.creditCents, 0) === 0), true);
const again = journal.length;
sync(journal, sources);
check("a second sync is a no-op (keys are stable)", journal.length, again);

const tie = tieOut(sums(journal), ACCOUNTS);
check("tie-out: every control account ties to its subledger", tie.map((r) => [r.code, r.difference]), [["1100", 0], ["1300", 0], ["2300", 0], ["2400", 0], ["2500", 0]]);
check("tie-out: control balances are the ledger's balances", tie.map((r) => r.control), ["AR", "PRE", "DEF", "ACC", "RP"].map((id) => ledgerBalance(journal, id)));
check("2500 by person: Nic paid back in full, Jake still owed", tie.find((r) => r.code === "2500").parties, [{ sub: "crew:JAKE", balance: 2500 }]);

const balancesByJob = jobBalances(sums(journal), ACCOUNTS);
const page = jobsPage(info, balancesByJob, tie, T);
// THE TEST the handoff asked for: the page's totals equal the GL balances of 1100, 1300, 2300, 2400.
check(
  "jobs page totals equal the GL balances of 1100, 1300, 2300, 2400",
  [page.totals.receivable, page.totals.prepaidCost, page.totals.deferredRevenue, page.totals.accruedCost],
  [ledgerBalance(journal, "AR"), ledgerBalance(journal, "PRE"), ledgerBalance(journal, "DEF"), ledgerBalance(journal, "ACC")],
);
check("jobs page says it ties", page.ties, true);
const row = (id) => page.rows.find((r) => r.id === id);
check("held job A: revenue and cost from the ledger, nothing left open", [row("A").revenue, row("A").cost, row("A").receivable, row("A").deferredRevenue, row("A").prepaidCost, row("A").accruedCost], [100000, 20000, 0, 0, 0, 0]);
// B's cost: plan 30,000 + Nic's receipt before the event 4,200 (prepaid, then matched) + Jake's receipt after it 2,500 (rule 7, straight to cost).
check("held job B: deposit released, balance receivable, receipts matched, plan accrued", [row("B").revenue, row("B").receivable, row("B").deferredRevenue, row("B").prepaidCost, row("B").accruedCost, row("B").cost], [120000, 70000, 0, 0, 30000, 36700]);
check("job ahead C: deposit deferred, cost prepaid, contract and plan as backlog", [row("C").deferredRevenue, row("C").prepaidCost, row("C").revenue, row("C").cost, page.backlog], [50000, 3000, 150000, 25000, { jobs: 1, revenue: 150000, cost: 25000, grossProfit: 125000 }]);
check("cancelled job D: kept deposit earned, listed so the page still ties, not in backlog", [row("D").revenue, row("D").deferredRevenue], [50000, 0]);
check("earned by event month comes from the ledger", page.periods.map((p) => [p.key, p.revenue, p.cost]), [["2026-11", 120000, 36700], ["2026-10", 100000, 20000]]);

// ── What the tie-out catches ────────────────────────────────────────────────
// A line on a control account with no key: nobody can say whose it is.
const stray = [...journal, { id: "x1", ref: "opening_balance:1", date: "2026-11-01", status: "posted", lines: [{ accountId: "AR", debitCents: 999, creditCents: 0 }, { accountId: "CASH", debitCents: 0, creditCents: 999 }] }];
const tie2 = tieOut(sums(stray), ACCOUNTS);
check("an unkeyed line on 1100 is a tie-out difference", [tie2.find((r) => r.code === "1100").difference, tieOutDifferences(tie2)], [999, 1]);
const blk = closeBlockers({ unbalancedEntries: 0, unreviewedLines: 0, pendingLines: 0, submittedClaims: 0, uncostedJobs: 0, jobsWithoutPlan: 0, unmatchedHandPayments: 0, transfersInTransitCents: 0, bankDifferences: 0, subledgerDifferences: tieOutDifferences(tie2) });
check("a tie-out difference is a HARD close blocker", blk, [{ key: "tie_out", label: "Control accounts that don't tie to their subledgers", count: 1, hard: true }]);
const page2 = jobsPage(info, jobBalances(sums(stray), ACCOUNTS), tie2, T);
check("the jobs page says when it does not tie", [page2.ties, page2.ledger.receivable - page2.totals.receivable], [false, 999]);
// A key of the wrong kind counts as unkeyed: a person's key on a job account.
const wrong = [...journal, { id: "x2", ref: "x", date: "2026-11-01", status: "posted", lines: [{ accountId: "DEF", debitCents: 0, creditCents: 100, sub: "crew:NIC" }, { accountId: "CASH", debitCents: 100, creditCents: 0 }] }];
check("a wrong-kind key on 2300 is a difference", tieOut(sums(wrong), ACCOUNTS).find((r) => r.code === "2300").difference, 100);
// Sabotage: postings that forgot their keys. The tie-out must not pass them.
const stripped = journal.map((e) => ({ ...e, lines: e.lines.map(({ sub, ...l }) => l) }));
check("sabotage: postings without keys fail the tie-out on every control account with a balance", tieOutDifferences(tieOut(sums(stripped), ACCOUNTS)) > 0, true);
check("sabotage: and the jobs page stops tying", jobsPage(info, jobBalances(sums(stripped), ACCOUNTS), tieOut(sums(stripped), ACCOUNTS), T).ties, false);

// ── Converting books posted before keys existed ─────────────────────────────
// Open month: the live sync voids the unkeyed entry and reposts it keyed.
const old = [{ id: "o1", ref: "bank_transaction:1", date: "2026-06-01", status: "posted", fingerprint: fingerprint({ date: "2026-06-01", lines: stripped.find((e) => e.ref === "bank_transaction:1").lines }), lines: stripped.find((e) => e.ref === "bank_transaction:1").lines }];
const src1 = sources.filter((s) => s.ref === "bank_transaction:1");
sync(old, src1);
check("open month: an unkeyed entry is voided and reposted with its key, once", [old.map((e) => e.status), old[1].lines.find((l) => l.accountId === "DEF").sub], [["void", "posted"], "job:A"]);
// Closed month: the entry stays as it was; a reclassification posts today.
const closed = [{ ...old[0], id: "c1", status: "posted" }];
sync(closed, src1, (d) => d.startsWith("2026-06"));
check("closed month: the old entry stands and a dated reclassification moves it into the subledger", [closed[0].status, closed[1].date, closed[1].adjustsPeriod, closed[1].lines], ["posted", T, "2026-06-01", [{ accountId: "DEF", debitCents: 50000, creditCents: 0 }, { accountId: "DEF", debitCents: 0, creditCents: 50000, sub: "job:A" }]]);
check("closed month: after the reclassification 2300 ties", tieOut(sums(closed), ACCOUNTS).find((r) => r.code === "2300").difference, 0);
const n = closed.length;
sync(closed, src1, (d) => d.startsWith("2026-06"));
check("closed month: the reclassification is not repeated", closed.length, n);

// ── Registers ───────────────────────────────────────────────────────────────
const reg = register("liability", 1000, [
  { entryId: "b", date: "2026-11-02", memo: "", sub: null, debit: 300, credit: 0, createdAt: "2" },
  { entryId: "a", date: "2026-11-01", memo: "", sub: null, debit: 0, credit: 500, createdAt: "1" },
]);
check("register: oldest first, running balance in the natural direction", reg.map((r) => [r.entryId, r.balance]), [["a", 1500], ["b", 1200]]);

if (failures) {
  console.log(`\n${failures} failing`);
  process.exit(1);
}
console.log("\nall passing");
