// Checks lib/books/logic.ts: the decisions behind the review queue, the ledger
// and payment matching. No test runner in this repo, so run this when you touch
// any of it: `node --experimental-strip-types scripts/verify-books.mjs`.
//
// The cases come from what actually went wrong or nearly did, on realistic
// data: a booking settled in trade suggested as owing money, a cash deposit
// treated as unpaid, a balance not marked paid because its deposit never
// touched the bank.
import { bankLinePosting, creditFor, normalizeMatchText, orderRules, ruleMatches, splitPosting, splitProblem, suggestFor } from "../lib/books/logic.ts";

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

// ── Posting: money in debits the bank, money out credits it ─────────────────
check("money in", bankLinePosting(1500, "bank", "income"), [
  { accountId: "bank", debitCents: 1500, creditCents: 0 },
  { accountId: "income", debitCents: 0, creditCents: 1500 },
]);
check("money out (also a card charge)", bankLinePosting(-4599, "card", "fuel"), [
  { accountId: "fuel", debitCents: 4599, creditCents: 0 },
  { accountId: "card", debitCents: 0, creditCents: 4599 },
]);
for (const amt of [1, -1, 123456789, -98765]) {
  const lines = bankLinePosting(amt, "a", "b");
  const d = lines.reduce((s, l) => s + l.debitCents, 0);
  const c = lines.reduce((s, l) => s + l.creditCents, 0);
  check(`balances at ${amt}`, d === c && lines.every((l) => (l.debitCents === 0) !== (l.creditCents === 0)), true);
}

// ── Rules ───────────────────────────────────────────────────────────────────
const rule = (o) => ({ matchField: "merchant", matchType: "equals", pattern: "shell", direction: "any", createdAt: new Date(0), ...o });
check("text is normalized", normalizeMatchText("  SHELL   Oil\t"), "shell oil");
check("equals ignores case", ruleMatches(rule(), { merchant: "Shell", description: "", amountCents: -100 }), true);
check("equals is not contains", ruleMatches(rule(), { merchant: "Shell Oil", description: "", amountCents: -100 }), false);
check("contains", ruleMatches(rule({ matchField: "description", matchType: "contains", pattern: "spotify" }), { merchant: null, description: "SPOTIFY USA", amountCents: -1599 }), true);
check("direction out refuses money in", ruleMatches(rule({ direction: "out" }), { merchant: "Shell", description: "", amountCents: 100 }), false);
check("direction in refuses money out", ruleMatches(rule({ direction: "in" }), { merchant: "Shell", description: "", amountCents: -100 }), false);
check("no merchant, merchant rule never matches", ruleMatches(rule(), { merchant: null, description: "shell", amountCents: -1 }), false);
check(
  "most specific rule first",
  orderRules([
    rule({ matchType: "contains", pattern: "sh", createdAt: new Date(3) }),
    rule({ matchType: "contains", pattern: "shell oil", createdAt: new Date(1) }),
    rule({ matchType: "equals", pattern: "shell", createdAt: new Date(2) }),
  ]).map((r) => r.pattern),
  ["shell", "shell oil", "sh"],
);

// ── What a booking has paid ─────────────────────────────────────────────────
const base = { totalCents: 100000, depositCents: 50000, isDepositPaid: false, isBalancePaid: false, bankCents: 0, bankDepositLines: 0 };
check("nothing paid", creditFor(base), { depositOutsideBankCents: 0, creditedCents: 0, depositDueCents: 50000, balanceDueCents: 100000 });
check("deposit marked paid by hand, nothing in the bank: paid in cash", creditFor({ ...base, isDepositPaid: true }), {
  depositOutsideBankCents: 50000,
  creditedCents: 50000,
  depositDueCents: 0,
  balanceDueCents: 50000,
});
check("cash deposit plus a $500 bank balance covers the total", creditFor({ ...base, isDepositPaid: true, bankCents: 50000 }).creditedCents, 100000);
check("deposit matched from the bank is not counted twice", creditFor({ ...base, isDepositPaid: true, bankCents: 50000, bankDepositLines: 1 }), {
  depositOutsideBankCents: 0,
  creditedCents: 50000,
  depositDueCents: 0,
  balanceDueCents: 50000,
});
check("marked paid in full (a trade deal) owes nothing", creditFor({ ...base, isDepositPaid: true, isBalancePaid: true }).balanceDueCents, 0);
check("marked paid in full owes no deposit either", creditFor({ ...base, isBalancePaid: true }).depositDueCents, 0);

// ── Suggestions ─────────────────────────────────────────────────────────────
const booking = (o) => ({
  id: o.id,
  name: o.name,
  eventDate: o.eventDate ?? "2027-06-12",
  totalCents: o.totalCents ?? 100000,
  depositCents: o.depositCents ?? 50000,
  receivedCents: 0,
  depositOutsideBankCents: 0,
  depositDueCents: o.depositDueCents ?? 50000,
  balanceDueCents: o.balanceDueCents ?? 100000,
});
const hayes = booking({ id: "hayes", name: "Jordan Hayes & Taylor Morgan" });
const smith = booking({ id: "smith", name: "Ava Smith & Leo Jones", totalCents: 150000, depositCents: 100000, depositDueCents: 100000, balanceDueCents: 150000, eventDate: "2026-12-12" });
const traded = booking({ id: "kat", name: "Kat McKinney & Tanis Copeland", depositDueCents: 0, balanceDueCents: 0, eventDate: "2026-11-07" });
const avery = booking({ id: "avery", name: "Avery Quinn & Sam Rivera", totalCents: 140000, depositDueCents: 0, balanceDueCents: 90000 });
const all = [hayes, smith, traded, avery];
const line = (amountCents, description, postedDate = "2026-11-09") => ({ amountCents, merchant: null, description, postedDate });
const ids = (s) => s.map((x) => `${x.bookingId}:${x.kind}`);

check("amount and name: Smith's deposit first", ids(suggestFor(line(100000, "MOBILE DEPOSIT SMITH WEDDING"), all))[0], "smith:deposit");
check("a bare $500 check: Hayes's deposit, never the paid-up trade deal", ids(suggestFor(line(50000, "MOBILE DEPOSIT 1001"), all)), ["hayes:deposit"]);
check("an unnamed $900: Avery's balance after a cash deposit", ids(suggestFor(line(90000, "MOBILE DEPOSIT 1002"), all)), ["avery:balance"]);
check("name alone suggests", ids(suggestFor(line(75000, "ZELLE FROM T MORGAN"), all)), ["hayes:deposit"]);
check("a paid-up booking is still suggested when its name is on the line", ids(suggestFor(line(12000, "ZELLE KAT MCKINNEY"), all)), ["kat:balance"]);
check("no evidence, no suggestion", suggestFor(line(12345, "SHELL"), all), []);
check("money out is never suggested", suggestFor(line(-50000, "MORGAN"), all), []);
check("'and' is not a name", suggestFor(line(12345, "TRANSFER AND FEE"), [booking({ id: "cole", name: "Sam and Alex Cole" })]), []);
check("at most three", suggestFor(line(50000, "x"), Array.from({ length: 6 }, (_, i) => booking({ id: `b${i}`, name: `Couple ${i}` }))).length, 3);
check("a date far from the event drops an amount-only match", suggestFor(line(50000, "x", "2020-01-01"), [hayes]), []);
check("...and a name-only match", suggestFor(line(12345, "MORGAN", "2020-01-01"), [hayes]), []);
check("...but amount AND name still suggests", ids(suggestFor(line(50000, "MORGAN", "2020-01-01"), [hayes])), ["hayes:deposit"]);

// ── Split transactions ──────────────────────────────────────────────────────
const P = (...a) => a.map((amountCents) => ({ amountCents }));
check("a split that adds up is fine", splitProblem(-15000, P(-12000, -3000)), null);
check("money in splits too", splitProblem(20000, P(15000, 5000)), null);
check("one part is not a split", splitProblem(-15000, P(-15000)), "A split needs at least two parts.");
check("parts short of the line", splitProblem(-15000, P(-12000, -2000)), "The parts are 10.00 short of the transaction.");
check("parts over the line", splitProblem(-15000, P(-12000, -4000)), "The parts are 10.00 over the transaction.");
check("a money-in part on money out is refused", splitProblem(-15000, P(-20000, 5000)), "Every part of money going out is money out.");
check("a zero part is refused", splitProblem(-15000, P(-15000, 0)), "Every part needs an amount.");
check("a zero line can't be split", splitProblem(0, P(1, -1)), "A zero line can't be split.");
check("off by one cent is refused", splitProblem(-10000, P(-3333, -3333, -3333)), "The parts are 0.01 short of the transaction.");
check(
  "split money out posts one balanced entry",
  splitPosting(-15000, "card", [
    { accountId: "gear", amountCents: -12000 },
    { accountId: "office", amountCents: -3000 },
  ]),
  [
    { accountId: "gear", debitCents: 12000, creditCents: 0 },
    { accountId: "office", debitCents: 3000, creditCents: 0 },
    { accountId: "card", debitCents: 0, creditCents: 15000 },
  ],
);
{
  const lines = splitPosting(20000, "bank", [
    { accountId: "income", amountCents: 15000 },
    { accountId: "tips", amountCents: 5000 },
  ]);
  check("split money in balances", lines.reduce((s, l) => s + l.debitCents - l.creditCents, 0), 0);
  check("split money in debits the bank once", lines.filter((l) => l.debitCents > 0).map((l) => l.accountId), ["bank"]);
}

if (failures) {
  console.log(`\n${failures} FAILED`);
  process.exit(1);
}
console.log("\nall checks passed");
