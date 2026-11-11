// Pure: which money-out bank lines are recurring charges (subscriptions,
// insurance, a phone bill). No imports, so scripts/verify-money.mjs can run it
// with node --experimental-strip-types.
//
// A charge is called recurring only on evidence: at least three charges from
// the same merchant (two for yearly), spaced on a steady cadence, at a steady
// amount. One charge is never a subscription, and a merchant you buy from on
// no schedule (gas, Amazon) is never called one. When in doubt, it is left out:
// a wrong "you pay for this every month" is worse than a missing one.

export type RecurringInput = {
  merchant: string | null;
  description: string;
  amountCents: number; // positive = money in, so charges are negative
  postedDate: string; // YYYY-MM-DD
};

export type Cadence = "weekly" | "every 2 weeks" | "monthly" | "quarterly" | "yearly";

export type RecurringCharge = {
  key: string;
  name: string;
  cadence: Cadence;
  /** Typical charge, positive cents. */
  amountCents: number;
  /** What it costs per month on average, positive cents. */
  monthlyCents: number;
  count: number;
  firstDate: string;
  lastDate: string;
  nextDate: string;
  /** Became recurring recently: worth a "keep it?" look. */
  isNew: boolean;
  why: string;
};

const BANDS: { cadence: Cadence; min: number; max: number; days: number; minCount: number }[] = [
  { cadence: "weekly", min: 6, max: 8, days: 7, minCount: 3 },
  { cadence: "every 2 weeks", min: 13, max: 16, days: 14, minCount: 3 },
  { cadence: "monthly", min: 27, max: 33, days: 30.44, minCount: 3 },
  { cadence: "quarterly", min: 85, max: 97, days: 91.31, minCount: 3 },
  { cadence: "yearly", min: 355, max: 376, days: 365.25, minCount: 2 },
];

const DAY = 24 * 60 * 60 * 1000;
const toDay = (iso: string) => Math.floor(Date.parse(`${iso}T12:00:00Z`) / DAY);
const fromDay = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);

/** "NETFLIX.COM 8443-12 #4471" and "Netflix.com" land on the same key. */
export function merchantKey(merchant: string | null, description: string): string {
  const raw = (merchant && merchant.trim()) || description || "";
  return raw
    .toLowerCase()
    .replace(/\*.*$/, "") // "BEATPOOL PRO*SUB 123" -> "beatpool pro"
    .replace(/[#\d]+/g, " ")
    .replace(/[^a-z& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function detectRecurring(lines: RecurringInput[], today: string): RecurringCharge[] {
  const todayDay = toDay(today);
  const groups = new Map<string, { name: string; items: { day: number; cents: number }[] }>();
  for (const l of lines) {
    if (l.amountCents >= 0) continue; // only money out
    const key = merchantKey(l.merchant, l.description);
    if (key.length < 3) continue;
    const day = toDay(l.postedDate);
    if (!Number.isFinite(day) || todayDay - day > 800) continue;
    const g = groups.get(key) ?? { name: titleCase(key), items: [] };
    g.items.push({ day, cents: -l.amountCents });
    groups.set(key, g);
  }

  const out: RecurringCharge[] = [];
  for (const [key, g] of groups) {
    // Two charges on one day are one purchase split, not a cadence.
    const byDay = new Map<number, number>();
    for (const it of g.items) byDay.set(it.day, (byDay.get(it.day) ?? 0) + it.cents);
    const items = [...byDay.entries()].map(([day, cents]) => ({ day, cents })).sort((a, b) => a.day - b.day);
    if (items.length < 2) continue;

    const gaps = items.slice(1).map((it, i) => it.day - items[i].day);
    const gap = median(gaps);
    const band = BANDS.find((b) => gap >= b.min && gap <= b.max);
    if (!band || items.length < band.minCount) continue;
    const onBeat = gaps.filter((x) => x >= band.min && x <= band.max).length;
    if (onBeat / gaps.length < 0.75) continue;

    const amount = median(items.map((it) => it.cents));
    const tolerance = Math.max(amount * 0.1, 200);
    const steady = items.filter((it) => Math.abs(it.cents - amount) <= tolerance).length;
    if (steady / items.length < 0.75) continue;

    const last = items[items.length - 1].day;
    // Stopped: no charge for well over one cycle. Not a current subscription.
    if (todayDay - last > band.days * 1.6) continue;

    const first = items[0].day;
    const recentWindow = band.minCount * band.days + 10;
    out.push({
      key,
      name: g.name,
      cadence: band.cadence,
      amountCents: Math.round(amount),
      monthlyCents: Math.round((amount * 30.44) / band.days),
      count: items.length,
      firstDate: fromDay(first),
      lastDate: fromDay(last),
      nextDate: fromDay(Math.round(last + band.days)),
      isNew: todayDay - first <= recentWindow,
      why: `${items.length} charges, ${band.cadence}, about ${(amount / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} each`,
    });
  }
  return out.sort((a, b) => b.monthlyCents - a.monthlyCents);
}

/** Expected recurring charges between two dates (inclusive), for "going out". */
export function expectedBetween(charges: RecurringCharge[], from: string, to: string): { name: string; date: string; amountCents: number }[] {
  const a = toDay(from);
  const b = toDay(to);
  const res: { name: string; date: string; amountCents: number }[] = [];
  for (const c of charges) {
    const step = BANDS.find((x) => x.cadence === c.cadence)!.days;
    for (let d = toDay(c.nextDate); d <= b; d = Math.round(d + step)) {
      if (d >= a) res.push({ name: c.name, date: fromDay(d), amountCents: c.amountCents });
    }
  }
  return res.sort((x, y) => x.date.localeCompare(y.date));
}
