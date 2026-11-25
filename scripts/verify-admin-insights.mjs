// Checks lib/admin-insights.ts, the owner dashboard's command center.
// Run: `node --experimental-strip-types scripts/verify-admin-insights.mjs`.
//
// The rules it protects: money is counted once and never from a cancelled
// booking; a balance is late only after the event; the to-do list puts what
// is overdue or waiting on us first; and the wedding cap ignores corporate
// nights and unpaid inquiries.
import { buildInsights, collectedOn, daysBetween, isBooked } from "../lib/admin-insights.ts";

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

const TODAY = "2026-11-13";
let n = 0;
const w = (over) => ({
  id: `w${++n}`,
  coupleNames: `Couple ${n}`,
  eventDate: "2027-06-12",
  status: "deposit_paid",
  packageType: "standard_dj_mc",
  totalAmount: "1500.00",
  depositAmount: "500.00",
  isDepositPaid: true,
  isBalancePaid: false,
  contactEmail: "c@example.com",
  unreadMessages: 0,
  contractAcceptedAt: "2026-10-01T00:00:00Z",
  contractCountersignedAt: "2026-10-02T00:00:00Z",
  accessToken: `tok${n}`,
  officiant: null,
  ...over,
});
const run = (weddings, calls = [], callDates) => buildInsights({ weddings, calls, today: TODAY, callDates, yearCap: 24 });

check("days between", [daysBetween(TODAY, "2026-11-14"), daysBetween(TODAY, "2026-11-12"), daysBetween("2027-03-13", "2027-03-15")], [1, -1, 2]);
check("inquiry is not booked, deposit is", [isBooked(w({ status: "inquiry", isDepositPaid: false })), isBooked(w({ status: "inquiry", isDepositPaid: true }))], [false, true]);
check("cancelled is never booked", isBooked(w({ status: "cancelled" })), false);
check("collected: deposit, then everything once balance paid", [collectedOn(w({})), collectedOn(w({ isBalancePaid: true }))], [500, 1500]);
check("collected: deposit capped at the total", collectedOn(w({ totalAmount: "300.00" })), 300);
check("collected: cancelled counts nothing", collectedOn(w({ status: "cancelled", isBalancePaid: true })), 0);

{
  const i = run([
    w({}),
    w({ status: "inquiry", isDepositPaid: false, totalAmount: "1000.00" }),
    w({ status: "cancelled", totalAmount: "9999.00" }),
  ]);
  check("booked ahead and pipeline split", [i.bookedAhead, i.pipeline], [{ count: 1, revenue: 1500 }, { count: 1, revenue: 1000 }]);
  check("collected and owed skip inquiries and cancelled", [i.collected, i.owed], [500, 1000]);
  check("nothing past due before the event", i.pastDue, { count: 0, amount: 0 });
}

{
  const past = w({ eventDate: "2026-11-07", status: "completed" });
  const paid = w({ eventDate: "2026-10-17", status: "completed", isBalancePaid: true });
  const i = run([past, paid]);
  check("balance unpaid after the event is past due", i.pastDue, { count: 1, amount: 1000 });
  check("past due is the first action", [i.actions[0].level, i.actions[0].title, i.actions[0].href], ["now", `Collect $1,000 from ${past.coupleNames}`, `/invoice/${past.id}`]);
  check("today's event is not past due", run([w({ eventDate: TODAY })]).pastDue.count, 0);
}

{
  const unread = w({ unreadMessages: 3, eventDate: "2027-09-01" });
  const needsSig = w({ contractCountersignedAt: null, eventDate: "2027-05-01" });
  const farInquiry = w({ status: "inquiry", isDepositPaid: false, eventDate: "2027-08-01" });
  const nearInquiry = w({ status: "inquiry", isDepositPaid: false, eventDate: "2026-12-12" });
  const noEmail = w({ contactEmail: null, eventDate: "2027-04-01" });
  const i = run([unread, needsSig, farInquiry, nearInquiry, noEmail]);
  const titles = i.actions.map((a) => `${a.level}:${a.title}`);
  check("action order", titles, [
    `now:Reply to ${unread.coupleNames}`,
    `now:Lock in ${nearInquiry.coupleNames}`,
    `now:Sign ${needsSig.coupleNames}'s DJ agreement`,
    `soon:Get an email for ${noEmail.coupleNames}`,
    `soon:Lock in ${farInquiry.coupleNames}`,
  ]);
  check("unread total", i.unreadMessages, 3);
  check("email action goes to the hub, outside the dashboard", [i.actions[3].href, i.actions[3].underBase], [`/hub/${noEmail.accessToken}`, false]);
}

{
  const corp = w({ packageType: "corporate", contactEmail: null, contractAcceptedAt: null, contractCountersignedAt: null });
  check("corporate events skip agreement and email nags", run([corp]).actions, []);
  const unsigned = w({ contractAcceptedAt: null, contractCountersignedAt: null, eventDate: "2026-12-01" });
  check("booked wedding without their signature, close, is now", run([unsigned]).actions.map((a) => a.level + ":" + a.title), [`now:${unsigned.coupleNames} hasn't signed the DJ agreement`]);
  const off = w({ officiant: { acceptedAt: "2026-11-01T00:00:00Z", countersignedAt: null, depositPaidAt: null } });
  check("officiant agreement awaiting signature", run([off]).actions.map((a) => a.href), [`/officiant/${off.id}`]);
}

{
  const soon = w({ eventDate: "2026-11-20" });
  check("booked event within two weeks is an fyi", run([soon]).actions.map((a) => a.level + ":" + a.title), [`fyi:${soon.coupleNames} is in 7 days`]);
  const calls = [
    { id: "c1", name: "Pat", startsAt: "2026-11-14T00:00:00.000Z" },
    { id: "c2", name: "Lee", startsAt: "2026-11-20T23:00:00.000Z" },
  ];
  // c1 is 7pm on the 13th in Indiana even though UTC says the 14th.
  check("calls use the local date and only today or tomorrow", run([], calls, { c1: "2026-11-13", c2: "2026-11-20" }).actions.map((a) => a.title), ["Intro call with Pat today"]);
}

{
  const i = run([
    w({ eventDate: "2027-06-12" }),
    w({ eventDate: "2027-06-19", status: "inquiry", isDepositPaid: false }),
    w({ eventDate: "2027-06-26", packageType: "corporate" }),
    w({ eventDate: "2027-12-04" }),
  ]);
  check("twelve months from this one", [i.months.length, i.months[0].key, i.months[11].key], [12, "2026-11", "2027-10"]);
  const june = i.months.find((m) => m.key === "2027-06");
  check("june: two booked (one corporate), one pending", [june.booked, june.pending, june.bookedRevenue], [2, 1, 3000]);
  check("december 2027 is outside the window", i.months.some((m) => m.key === "2027-12"), false);
  check("season cap counts booked weddings only", i.seasons, [
    { year: 2026, cap: 24, booked: 0 },
    { year: 2027, cap: 24, booked: 2 },
  ]);
}

if (failures) {
  console.log(`\n${failures} failing`);
  process.exit(1);
}
console.log("\nall passing");
