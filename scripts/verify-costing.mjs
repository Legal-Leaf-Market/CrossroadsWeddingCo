// Checks lib/costing-logic.ts, project costing and crew planning.
// Run: `node --experimental-strip-types scripts/verify-costing.mjs`.
//
// The rules it protects: an owner is never a cost and owners split what is
// left; a rate that is not set is reported, never guessed; what was really
// paid wins over arithmetic; and a person on two events the same day is caught.
import { centsLabel, costEvent, crewLoad, hoursLabel, jobLedger, jobRow, lineCost, ownerShares } from "../lib/costing-logic.ts";

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

const base = {
  kind: "labor", crewMemberId: null, label: "", role: "", payMethod: null, rateCents: null, percentBps: null,
  plannedMinutes: null, actualMinutes: null, unitCostCents: null, plannedQty: null, actualQty: null, actualCostCents: null,
};
const L = (o) => ({ ...base, ...o });

check("owner line costs nothing", lineCost(L({ payMethod: "owner", plannedMinutes: 600 }), 150000), { planned: 0, actual: 0, missing: null });
check("per project with no amount is missing, not zero", lineCost(L({ payMethod: "project" }), 150000), { planned: null, actual: null, missing: "pay not set" });
check("per project", lineCost(L({ payMethod: "project", rateCents: 10000 }), 150000), { planned: 10000, actual: 10000, missing: null });
check("paid amount wins", lineCost(L({ payMethod: "project", rateCents: 10000, actualCostCents: 12500 }), 150000).actual, 12500);
check("hourly planned and actual", lineCost(L({ payMethod: "hour", rateCents: 2000, plannedMinutes: 330, actualMinutes: 360 }), 0), { planned: 11000, actual: 12000, missing: null });
check("hourly without actual hours has no actual", lineCost(L({ payMethod: "hour", rateCents: 2000, plannedMinutes: 60 }), 0).actual, null);
check("percent of the event", lineCost(L({ payMethod: "percent", percentBps: 1000 }), 150000), { planned: 15000, actual: 15000, missing: null });
check("no pay type is missing", lineCost(L({}), 0).missing, "pay type not set");
check("material qty x unit", lineCost(L({ kind: "material", unitCostCents: 450, plannedQty: 3, actualQty: 4 }), 0), { planned: 1350, actual: 1800, missing: null });
check("material with no unit cost is missing", lineCost(L({ kind: "material", plannedQty: 2 }), 0).missing, "unit cost not set");
check("material with zero qty costs zero even unpriced", lineCost(L({ kind: "material" }), 0).planned, 0);

check("two owners, nothing set, split evenly", ownerShares([{ id: "j", name: "Jake", shareBps: null }, { id: "t", name: "Terry", shareBps: null }]).map((o) => o.bps), [5000, 5000]);
check("one set share, the other gets the rest", ownerShares([{ id: "j", name: "Jake", shareBps: 6000 }, { id: "t", name: "Terry", shareBps: null }]).map((o) => o.bps), [6000, 4000]);

{
  const owners = [{ id: "j", name: "Jake", shareBps: null }, { id: "t", name: "Terry", shareBps: null }];
  const names = { j: "Jake", t: "Terry", n: "Nic" };
  const lines = [
    L({ crewMemberId: "j", label: "Jake", payMethod: "owner", plannedMinutes: 600, actualMinutes: 660 }),
    L({ crewMemberId: "t", label: "Terry", payMethod: "owner", plannedMinutes: 480 }),
    L({ crewMemberId: "n", label: "Nic", payMethod: "project", rateCents: 10000, plannedMinutes: 300 }),
    L({ kind: "material", label: "Uplights", unitCostCents: 2500, plannedQty: 2 }),
  ];
  const c = costEvent({ revenueCents: 150000, lines, owners, names });
  check("planned: Nic + materials are the costs", [c.planned.labor, c.planned.material, c.planned.total, c.planned.left], [10000, 5000, 15000, 135000]);
  check("planned margin", c.plannedMargin, 0.9);
  check("owners split what is left", c.owners.map((o) => [o.name, o.planned]), [["Jake", 67500], ["Terry", 67500]]);
  const jake = c.people.find((p) => p.name === "Jake");
  check("owner per hour, planned and actual", [jake.plannedPay, jake.plannedPerHour, jake.actualPerHour], [67500, 6750, 6136]);
  const nic = c.people.find((p) => p.name === "Nic");
  check("Nic per project works out per hour", [nic.plannedPay, nic.plannedPerHour, nic.owner], [10000, 2000, false]);
  check("actual is incomplete until materials are counted", c.actualComplete, false);
  check("nothing missing", c.missing, []);
}

{
  const c = costEvent({
    revenueCents: 100000,
    lines: [L({ crewMemberId: "n", label: "Nic", payMethod: "project" })],
    owners: [{ id: "j", name: "Jake", shareBps: null }],
    names: { n: "Nic" },
  });
  check("unset pay is reported by name", c.missing, [{ label: "Nic", reason: "pay not set" }]);
  check("unset pay leaves per hour unknown", c.people[0].plannedPerHour, null);
}

check("shares over 100% are flagged", costEvent({ revenueCents: 0, lines: [], owners: [{ id: "a", name: "A", shareBps: 7000 }, { id: "b", name: "B", shareBps: 6000 }], names: {} }).sharesOver, true);
check("costs above revenue never give owners a negative share", costEvent({ revenueCents: 1000, lines: [L({ payMethod: "project", rateCents: 5000 })], owners: [{ id: "a", name: "A", shareBps: null }], names: {} }).owners[0].planned, 0);

{
  const months = ["2027-06", "2027-07"];
  const load = crewLoad(
    [
      { weddingId: "w1", eventName: "Hayes", eventDate: "2027-06-12", crewMemberId: "n", plannedMinutes: 300 },
      { weddingId: "w1", eventName: "Hayes", eventDate: "2027-06-12", crewMemberId: "n", plannedMinutes: 60 },
      { weddingId: "w2", eventName: "Cooper", eventDate: "2027-06-12", crewMemberId: "n", plannedMinutes: 240 },
      { weddingId: "w3", eventName: "Ellis", eventDate: "2027-07-03", crewMemberId: "j", plannedMinutes: 600 },
      { weddingId: "w4", eventName: "Later", eventDate: "2027-09-03", crewMemberId: "j", plannedMinutes: 600 },
    ],
    months,
  );
  check("hours and events per month", load.byPerson.n, [{ key: "2027-06", minutes: 600, events: 2 }, { key: "2027-07", minutes: 0, events: 0 }]);
  check("months outside the window are ignored", load.byPerson.j.map((m) => m.minutes), [0, 600]);
  check("double-booked day is caught", load.conflicts, [{ crewMemberId: "n", date: "2027-06-12", events: ["Cooper", "Hayes"] }]);
}

check("money labels", [centsLabel(150000), centsLabel(1250), centsLabel(-500000), centsLabel(null)], ["$1,500", "$12.50", "-$5,000", "not set"]);
check("hours labels", [hoursLabel(600), hoursLabel(390), hoursLabel(45)], ["10h", "6.5h", "0.75h"]);


// Accrual job costing (jobRow / jobLedger).
{
  const T = "2026-11-13";
  const nic = (paid) => L({ crewMemberId: "n", label: "Nic", payMethod: "project", rateCents: 10000, actualCostCents: paid });
  const jake = L({ crewMemberId: "j", label: "Jake", payMethod: "owner", plannedMinutes: 600 });
  const future = { id: "f", name: "Future", eventDate: "2027-06-12", cancelled: false, revenueCents: 150000, collectedCents: 50000, lines: [jake, nic(10000)] };
  const r1 = jobRow(future, T);
  check("future job: deposit is deferred revenue, paid cost is prepaid", [r1.earned, r1.deferredRevenue, r1.receivable, r1.prepaidCost, r1.accruedCost], [false, 50000, 0, 10000, 0]);
  const past = { id: "p", name: "Past", eventDate: "2026-11-07", cancelled: false, revenueCents: 150000, collectedCents: 50000, lines: [jake, nic(null), L({ kind: "material", label: "Uplights", unitCostCents: 2500, plannedQty: 2, actualCostCents: 5000 })] };
  const r2 = jobRow(past, T);
  check("earned job: balance is receivable, unpaid cost is accrued", [r2.earned, r2.deferredRevenue, r2.receivable, r2.prepaidCost, r2.accruedCost], [true, 0, 100000, 0, 10000]);
  check("earned job: cost matched to revenue, owners are not a cost", [r2.revenue, r2.cost, r2.grossProfit, r2.margin], [150000, 15000, 135000, 0.9]);
  check("event day itself is earned", jobRow({ ...future, eventDate: T }, T).earned, true);
  const led = jobLedger([future, past, { ...past, id: "c", cancelled: true }], T);
  check("ledger balances", led.balances, { deferredRevenue: 50000, receivable: 100000, prepaidCost: 10000, accruedCost: 10000 });
  check("P&L by event month holds only earned jobs", led.periods, [{ key: "2026-11", jobs: 1, revenue: 150000, cost: 15000, grossProfit: 135000, earned: true }]);
  check("backlog is the unearned job", [led.backlog.jobs, led.backlog.revenue, led.backlog.cost], [1, 150000, 10000]);
  check("cancelled jobs are left out", led.jobs.map((j) => j.id), ["p", "f"]);
}

if (failures) {
  console.log(`\n${failures} failing`);
  process.exit(1);
}
console.log("\nall passing");
