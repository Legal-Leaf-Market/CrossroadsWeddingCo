// Checks lib/wild-bramble.ts, the menu builder on
// /partners/wild-bramble-catering: what a menu request says, the mailto it
// opens, and the lead time note.
//   node --experimental-strip-types scripts/verify-wild-bramble.mjs
import { clampGuests, leadTimeNote, MENU, picksByCourse, requestMailto, requestText, WILD_BRAMBLE } from "../lib/wild-bramble.ts";

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

const base = { picks: [], eventType: "", date: "", time: "", guests: 0, place: "", service: "", budget: "", diets: [], allergies: "", notes: "" };

check("six courses, 27 dishes", [MENU.length, MENU.flatMap((c) => c.dishes).length], [6, 27]);
check("dish names are unique", new Set(MENU.flatMap((c) => c.dishes.map((d) => d.name))).size, 27);
check(
  "picks group by course in menu order, unknowns dropped",
  picksByCourse(["Spicy Cajun Shrimp", "Wild Bramble Grazing Board", "Lobster Thermidor", "Wild Bramble Berry Tart"]),
  [
    { title: "To Begin", dishes: ["Wild Bramble Grazing Board"] },
    { title: "The Table", dishes: ["Spicy Cajun Shrimp"] },
    { title: "To Finish", dishes: ["Wild Bramble Berry Tart"] },
  ],
);

const full = {
  ...base,
  picks: ["Slow Roasted Savory Brisket", "Wild Bramble Grazing Board"],
  eventType: "Wedding",
  date: "2027-06-12",
  time: "5 PM",
  guests: 80,
  place: "Gather Columbus",
  service: "Full service (staff stay on site to serve)",
  budget: "$3,000",
  diets: ["Gluten free", "Alpha-Gal friendly", "Made up diet"],
  allergies: "One guest with a tree nut allergy",
  notes: "Family style, please.\nWe love brisket.",
};
const text = requestText(full);
check("the request reads in their form's order", text.split("\n").slice(4, 12), [
  "Event type: Wedding",
  "Date: 2027-06-12",
  "Time: 5 PM",
  "Guest count: 80",
  "Location: Gather Columbus",
  "Service: Full service (staff stay on site to serve)",
  "Target budget: $3,000",
  "Dietary needs: Gluten free, Alpha-Gal friendly. One guest with a tree nut allergy",
]);
check("dishes listed by course", text.includes("To Begin: Wild Bramble Grazing Board\nThe Table: Slow Roasted Savory Brisket"), true);
check("notes kept on one line", text.includes("Family style, please. We love brisket."), true);
check("an empty request still says hello and thanks", requestText(base).split("\n").filter(Boolean).length, 3);
check("values off their lists are dropped", requestText({ ...base, eventType: "Rave", service: "Robots" }).includes("Rave") || requestText({ ...base, service: "Robots" }).includes("Robots"), false);
check("a bad date is dropped", requestText({ ...base, date: "next June" }).includes("next June"), false);
check("guests are clamped", [clampGuests(0), clampGuests(80.4), clampGuests(9999)], [1, 80, 500]);

const mail = requestMailto(WILD_BRAMBLE.email, full);
check("mailto goes to their inbox", mail.startsWith("mailto:hello@wildbramblecatering.com?subject=Menu%20request%3A%20Wedding%20on%202027-06-12&body="), true);
check("mailto body decodes to the same text", decodeURIComponent(mail.split("&body=")[1]), text);
check("a long request still fits a mailto", requestMailto(WILD_BRAMBLE.email, { ...full, picks: MENU.flatMap((c) => c.dishes.map((d) => d.name)), notes: "x".repeat(5000) }).length < 4000, true);

check("a wedding under 4 months gets their lead time note", leadTimeNote("Wedding", "2027-02-01", "2026-11-25").startsWith("They ask for 4 to 8 months"), true);
check("a wedding far out gets none", leadTimeNote("Wedding", "2027-09-01", "2026-11-25"), "");
check("anything inside two weeks gets the call note", leadTimeNote("Private dinner", "2026-12-01", "2026-11-25").startsWith("That's close"), true);
check("a past date says so", leadTimeNote("Corporate", "2026-11-01", "2026-11-25"), "That date has passed.");
check("no date, no note", leadTimeNote("Wedding", "", "2026-11-25"), "");

check("no em or en dash in anything shown", /[—–]/.test(JSON.stringify([MENU, text, WILD_BRAMBLE])), false);

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nall passed");
