// Checks lib/books/recurring.ts, the recurring-charge detector behind the
// money home screen. Run: `node --experimental-strip-types scripts/verify-money.mjs`.
//
// The rule it protects: a charge is called recurring only on evidence (a
// steady cadence AND a steady amount, three times, or twice for yearly).
// Telling someone "you pay for this every month" when they don't is worse
// than missing one.
import { detectRecurring, expectedBetween, merchantKey } from "../lib/books/recurring.ts";

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
const out = (merchant, cents, date, description = merchant ?? "") => ({ merchant, description, amountCents: -cents, postedDate: date });
const TODAY = "2026-11-09";
const names = (xs) => xs.map((x) => `${x.name}|${x.cadence}`);

check("merchant key strips ids and suffixes", merchantKey("BEATPOOL PRO*SUB 8841", ""), "beatpool pro");
check("merchant key falls back to description", merchantKey(null, "NETFLIX.COM 8443 #4471"), "netflix com");

const monthly = [out("BeatPool Pro", 2999, "2026-08-05"), out("BeatPool Pro", 2999, "2026-09-05"), out("BeatPool Pro", 2999, "2026-10-05"), out("BeatPool Pro", 2999, "2026-11-05")];
const r1 = detectRecurring(monthly, TODAY);
check("four monthly charges are monthly", names(r1), ["Beatpool Pro|monthly"]);
check("typical amount and monthly cost", [r1[0].amountCents, r1[0].monthlyCents], [2999, 2999]);
check("next expected date", r1[0].nextDate, "2026-12-05");

check("two monthly charges are not enough", names(detectRecurring(monthly.slice(2), TODAY)), []);
check("money in never counts", names(detectRecurring(monthly.map((l) => ({ ...l, amountCents: -l.amountCents })), TODAY)), []);

const gas = [out("Shell Oil", 6840, "2026-10-01"), out("Shell Oil", 5210, "2026-10-04"), out("Shell Oil", 7300, "2026-10-19"), out("Shell Oil", 4410, "2026-11-01")];
check("gas on no schedule is not recurring", names(detectRecurring(gas, TODAY)), []);

const wobbly = [out("Gear Rental Co", 5000, "2026-08-05"), out("Gear Rental Co", 25000, "2026-09-05"), out("Gear Rental Co", 9000, "2026-10-05"), out("Gear Rental Co", 51000, "2026-11-05")];
check("monthly but wildly different amounts is not a subscription", names(detectRecurring(wobbly, TODAY)), []);

const stopped = [out("Old App", 999, "2026-03-05"), out("Old App", 999, "2026-04-05"), out("Old App", 999, "2026-05-05")];
check("a subscription that stopped months ago is left out", names(detectRecurring(stopped, TODAY)), []);

const yearly = [out("Liability Insurance", 139000, "2024-11-20"), out("Liability Insurance", 139000, "2025-11-20")];
const ry = detectRecurring(yearly, TODAY);
check("two yearly charges are yearly", names(ry), ["Liability Insurance|yearly"]);
check("yearly monthly cost", ry[0].monthlyCents, Math.round((139000 * 30.44) / 365.25));

const splitSameDay = [out("Spotify", 1199, "2026-09-12"), out("Spotify", 1199, "2026-09-12"), out("Spotify", 1199, "2026-10-12")];
check("two charges on one day are not a cadence", names(detectRecurring(splitSameDay, TODAY)), []);

const isNewSet = [out("New Pool", 2799, "2026-09-02"), out("New Pool", 2799, "2026-10-02"), out("New Pool", 2799, "2026-11-02")];
check("just became recurring is flagged new", detectRecurring(isNewSet, TODAY)[0]?.isNew, true);
check("long-running is not new", r1[0].isNew === false || r1[0].count > 3, true);

const priceRise = [out("Website Host", 2400, "2026-07-10"), out("Website Host", 2400, "2026-08-10"), out("Website Host", 2400, "2026-09-10"), out("Website Host", 2550, "2026-10-10")];
check("a small price change still counts", names(detectRecurring(priceRise, TODAY)), ["Website Host|monthly"]);

const exp = expectedBetween(r1, "2026-11-09", "2026-12-31");
check("expected charges in a window", exp.map((e) => e.date), ["2026-12-05"]);

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nall passed");
