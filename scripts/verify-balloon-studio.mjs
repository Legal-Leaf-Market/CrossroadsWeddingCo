// Checks lib/balloon-studio.ts, the Rabbit's Balloons Color Studio on
// /partners/rabbits-balloons: color matching, palette edits, the line sent with
// an inquiry, and the preview layout.
//   node --experimental-strip-types scripts/verify-balloon-studio.mjs
import { addToPalette, COLORS, colorByName, layout, nearestColor, paletteLine, PALETTES } from "../lib/balloon-studio.ts";
import { cleanInquiry, inquiryLines } from "../lib/partner-inquiry.ts";

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

check("58 Sempertex colors", COLORS.length, 58);
check("names are unique (two Lilacs, two Yellows, two Blues by line)", new Set(COLORS.map((c) => c.name)).size, COLORS.length);
check("every curated palette uses real colors", PALETTES.flatMap((p) => p.colors).filter((n) => !colorByName(n)), []);
check("every curated palette fits the six color cap", PALETTES.every((p) => p.colors.length <= 6), true);
check("every hex is #rrggbb", COLORS.every((c) => /^#[0-9a-f]{6}$/.test(c.hex)), true);

// Matching: an exact balloon matches itself, and brand colors land sensibly.
check("an exact balloon color matches itself", COLORS.every((c) => nearestColor(c.hex).name === c.name), true);
check("IU crimson lands in the reds", nearestColor("#990000").family, "Reds and berries");
check("a navy logo lands on Navy Blue", nearestColor("#1b2a52").name, "Fashion Navy Blue");
check("pure white lands on White", nearestColor("#ffffff").name, "Fashion White");
check("garbage in does not throw", typeof nearestColor("not a color").name, "string");

// Palette edits.
const start = ["Pastel Matte Pink"];
check("add a color", addToPalette(start, "Deluxe Eucalyptus").colors, ["Pastel Matte Pink", "Deluxe Eucalyptus"]);
check("no duplicates", addToPalette(start, "Pastel Matte Pink"), { colors: start, message: "Pastel Matte Pink is already in your palette." });
const six = PALETTES[1].colors;
check("six is the cap", addToPalette(six, "Fashion White").message, "Six colors is the max. Remove one first.");
check("an unknown name is ignored", addToPalette(start, "Glitter Unicorn").colors, start);
check("the line the inquiry carries", paletteLine("garland", ["Pastel Matte Pink", "Deluxe Eucalyptus"]), "Garland: Pastel Matte Pink, Deluxe Eucalyptus");
check("no colors, no line", paletteLine("arch", []), "");

// Preview: deterministic, in bounds, only palette colors, first color most.
const pal = PALETTES[0].colors;
const a1 = layout("arch", pal, 11);
check("same inputs, same picture (server and browser agree)", JSON.stringify(layout("arch", pal, 11)) === JSON.stringify(a1), true);
check("a new seed reshuffles", JSON.stringify(layout("arch", pal, 12)) === JSON.stringify(a1), false);
const hexes = new Set(pal.map((n) => colorByName(n).hex));
check("only palette colors are used", a1.every((c) => hexes.has(c.fill)), true);
const count = (fill) => a1.filter((c) => c.fill === fill).length;
check("the first color is used the most", Math.max(...[...hexes].map(count)) === count(colorByName(pal[0]).hex), true);
for (const shape of ["arch", "garland", "columns"]) {
  const c = layout(shape, pal, 7);
  check(`${shape}: plenty of balloons, all inside the frame`, c.length > 100 && c.every((b) => b.x > -40 && b.x < 680 && b.y > -40 && b.y < 470 && b.r > 0), true);
}
check("an empty palette still draws (in cream)", new Set(layout("arch", [], 3).map((c) => c.fill)).size, 1);

// The inquiry form's rules (app/api/partners/inquiry).
const TODAY = "2026-11-25";
const good = { name: " Sam  Lee ", contact: "sam@example.com", occasion: "Wedding", date: "2027-06-12", venue: "Gather Columbus", colors: "Organic arch: Pastel Matte Pink", budget: "$500 to $1,000", more: "Ceremony arch" };
const ok = cleanInquiry(good, TODAY);
check("a good inquiry passes, spaces tidied", ok.ok && [ok.data.name, ok.data.email, ok.data.phone, ok.data.date], ["Sam Lee", "sam@example.com", "", "2027-06-12"]);
check("a phone number works too", cleanInquiry({ ...good, contact: "(812) 555-0142" }, TODAY).data.phone, "(812) 555-0142");
check("no name is refused", cleanInquiry({ ...good, name: "" }, TODAY).ok, false);
check("no way to reach them is refused", cleanInquiry({ ...good, contact: "" }, TODAY).ok, false);
check("neither email nor phone is refused", cleanInquiry({ ...good, contact: "call me maybe" }, TODAY).ok, false);
check("the hidden field marks a bot", cleanInquiry({ ...good, website: "http://spam" }, TODAY), { ok: false, error: "bot" });
check("a past date is dropped, not refused", cleanInquiry({ ...good, date: "2026-01-01" }, TODAY).data.date, "");
check("an occasion off the list becomes Something else", cleanInquiry({ ...good, occasion: "<script>" }, TODAY).data.occasion, "Something else");
check("a budget off the list is dropped", cleanInquiry({ ...good, budget: "$1" }, TODAY).data.budget, "");
check("long text is capped", cleanInquiry({ ...good, more: "x".repeat(5000) }, TODAY).data.more.length, 2000);
check("lines in reading order", inquiryLines(ok.data).map(([k]) => k), ["Occasion", "Date", "Venue or town", "Colors", "Budget", "Anything else"]);

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nall passed");
