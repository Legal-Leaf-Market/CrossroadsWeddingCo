// Checks lib/books/vendor-logic.ts: which bank lines are a vendor's payments,
// and the 1099-NEC threshold by year. Run:
// `node --experimental-strip-types scripts/verify-vendors.mjs`.
import { lineMatches, matchWords, necThresholdCents, vendorYears } from "../lib/books/vendor-logic.ts";

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
const pay = (cents, date, accountType, merchant, description = merchant) => ({ amountCents: -cents, postedDate: date, accountType, merchant, description });

check("match words from the list", matchWords("Marcus T, MARCUS  TAYLOR", "x"), ["marcus t", "marcus taylor"]);
check("falls back to the name", matchWords("", "Sound Rental Co"), ["sound rental co"]);
check("two-letter words dropped", matchWords("MT, Marcus", "x"), ["marcus"]);
check("matches description", lineMatches(["marcus t"], null, "ZELLE TO MARCUS T"), true);
check("case and spacing", lineMatches(["marcus t"], "Zelle", "zelle  to   MARCUS  T"), true);
check("no match", lineMatches(["marcus t"], "Shell", "SHELL OIL"), false);
check("no words, no match", lineMatches([], "x", "anything"), false);

check("2025 threshold", necThresholdCents(2025), 60000);
check("2026 threshold", necThresholdCents(2026), 200000);
check("2027 not published", necThresholdCents(2027), null);

const lines = [
  pay(45000, "2026-03-01", "depository", null, "ZELLE TO MARCUS T"),
  pay(90000, "2026-06-10", "depository", null, "ZELLE TO MARCUS T"),
  pay(70000, "2026-10-01", "depository", null, "CHECK 1043 MARCUS T"),
  pay(30000, "2026-11-01", "credit", "Marcus T", "MARCUS T"),
  pay(50000, "2025-08-01", "depository", null, "ZELLE TO MARCUS T"),
  { amountCents: 45000, postedDate: "2026-03-05", accountType: "depository", merchant: null, description: "ZELLE FROM MARCUS T" },
  pay(6840, "2026-03-02", "credit", "Shell", "SHELL OIL"),
];
const ys = vendorYears(["marcus t"], lines);
check("years newest first", ys.map((y) => y.year), [2026, 2025]);
check("2026 totals: bank vs card", [ys[0].paidCents, ys[0].bankPaidCents, ys[0].cardPaidCents, ys[0].payments], [235000, 205000, 30000, 4]);
check("2026 over $2,000 on bank payments", ys[0].status, "over");
check("money in (a refund) is ignored", ys[0].payments, 4);
check("2025 under $600", ys[1].status, "under");

const cardHeavy = vendorYears(["marcus t"], [pay(150000, "2026-02-01", "depository", null, "MARCUS T"), pay(150000, "2026-03-01", "credit", null, "MARCUS T")]);
check("card payments don't push a 1099-NEC over", cardHeavy[0].status, "under");
check("unknown year says unknown", vendorYears(["x y z"], [pay(500000, "2027-01-05", "depository", null, "X Y Z")])[0].status, "unknown");

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nall passed");
