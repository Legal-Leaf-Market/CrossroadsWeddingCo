// Checks lib/scheduling.ts against a fixed clock. There is no test runner in
// this repo, so this is the thing you run when you touch the office-hours
// arithmetic: `node --experimental-strip-types scripts/verify-scheduling.mjs`.
//
// Everything here is about one hazard. Office hours are wall clock ("Tuesdays
// six to eight"), an appointment is an instant, and the offset that converts
// between them is not the same offset all year. The cases below cross both
// Indiana DST transitions in both directions.
import { slotsForDate, venueWeekday, zonedWallClockToUtc } from "../lib/scheduling.ts";

const TZ = "America/Indiana/Indianapolis";
const wall = (d) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(d).replace(", ", " ");

let failures = 0;
function check(label, got, want) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${got}${ok ? "" : `  (want ${want})`}`);
}

// Indiana leaves DST Sun 2026-11-01 and enters it Sun 2027-03-14, both at 2am.
console.log("-- a wall-clock time converts to the instant that reads back the same --");
for (const [ymd, minutes, want] of [
  ["2026-10-31", 18 * 60, "2026-10-31 18:00"], // day before falling back
  ["2026-11-01", 18 * 60, "2026-11-01 18:00"], // the day itself, evening
  ["2026-11-02", 18 * 60, "2026-11-02 18:00"], // day after
  ["2027-03-13", 18 * 60, "2027-03-13 18:00"],
  ["2027-03-14", 18 * 60, "2027-03-14 18:00"], // the day itself, evening
  // The two that a single-pass offset lookup gets wrong. Measured: one pass
  // and two agree everywhere except wall times 02:00 to 06:30 on a changeover
  // day, so these are the cases that hold the second pass in place.
  ["2027-03-14", 5 * 60, "2027-03-14 05:00"],
  ["2026-11-01", 3 * 60, "2026-11-01 03:00"],
]) {
  check(`${ymd} ${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
    wall(zonedWallClockToUtc(ymd, minutes, TZ)), want);
}

console.log("-- a 5 to 7am block on the spring-forward day is four real slots --");
check("2027-03-14 05:00-07:00",
  slotsForDate({
    ymd: "2027-03-14",
    hours: [{ weekday: 0, start: "05:00", end: "07:00" }],
    timeZone: TZ, durationMinutes: 30, now: new Date("2027-03-01T00:00:00Z"),
  }).map((s) => wall(s.startsAt).slice(11)).join(" "),
  "05:00 05:30 06:00 06:30");

console.log("-- weekday is read in the venue zone, not the server's --");
check("2026-11-01 is a Sunday", String(venueWeekday("2026-11-01", TZ)), "0");
check("2027-03-14 is a Sunday", String(venueWeekday("2027-03-14", TZ)), "0");
check("2026-09-08 is a Tuesday", String(venueWeekday("2026-09-08", TZ)), "2");

console.log("-- a slot never straddles two office-hour blocks --");
check("90 minutes across a 5-6 and a 7-8",
  String(slotsForDate({
    ymd: "2026-09-08",
    hours: [{ weekday: 2, start: "17:00", end: "18:00" }, { weekday: 2, start: "19:00", end: "20:00" }],
    timeZone: TZ, durationMinutes: 90, now: new Date("2026-09-01T00:00:00Z"),
  }).length), "0");

console.log("-- overlapping blocks do not offer the same slot twice --");
check("6-7 and 6-8 together",
  slotsForDate({
    ymd: "2026-09-08",
    hours: [{ weekday: 2, start: "18:00", end: "19:00" }, { weekday: 2, start: "18:00", end: "20:00" }],
    timeZone: TZ, durationMinutes: 30, now: new Date("2026-09-01T00:00:00Z"),
  }).map((s) => wall(s.startsAt).slice(11)).join(" "),
  "18:00 18:30 19:00 19:30");

console.log("-- something already booked removes its slot, and only its slot --");
check("18:30 taken",
  slotsForDate({
    ymd: "2026-09-08",
    hours: [{ weekday: 2, start: "18:00", end: "20:00" }],
    timeZone: TZ, durationMinutes: 30, now: new Date("2026-09-01T00:00:00Z"),
    busy: [{ startsAt: zonedWallClockToUtc("2026-09-08", 18 * 60 + 30, TZ), duration: 30 }],
  }).map((s) => wall(s.startsAt).slice(11)).join(" "),
  "18:00 19:00 19:30");

console.log("-- lead time hides a slot that is too soon --");
check("two hours of notice",
  slotsForDate({
    ymd: "2026-09-08",
    hours: [{ weekday: 2, start: "18:00", end: "20:00" }],
    timeZone: TZ, durationMinutes: 30, leadMinutes: 120,
    now: zonedWallClockToUtc("2026-09-08", 17 * 60, TZ),
  }).map((s) => wall(s.startsAt).slice(11)).join(" "),
  "19:00 19:30");

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} FAILED.`);
process.exit(failures === 0 ? 0 : 1);
