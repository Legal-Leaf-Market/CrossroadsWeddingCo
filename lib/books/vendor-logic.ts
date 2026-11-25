// Pure rules for vendors. No imports, so scripts/verify-vendors.mjs can run
// it with node --experimental-strip-types.

export const VENDOR_KINDS = ["contractor", "supplier", "venue", "subscription", "other"] as const;
export type VendorKind = (typeof VENDOR_KINDS)[number];

export const VENDOR_KIND_LABEL: Record<VendorKind, string> = {
  contractor: "Contractor (second DJ, tech, bartender)",
  supplier: "Supplier or rental",
  venue: "Venue",
  subscription: "Subscription or software",
  other: "Other",
};

/**
 * The federal 1099-NEC reporting threshold by the year a payment was MADE.
 * $600 through 2025; $2,000 for payments made in 2026 (raised by the 2025
 * tax law), indexed for inflation after that. A year not in this table has
 * no published figure yet: callers say so instead of guessing.
 * Confirm with your accountant before filing.
 */
const NEC_THRESHOLD_CENTS: Record<number, number> = { 2024: 60000, 2025: 60000, 2026: 200000 };

export function necThresholdCents(year: number): number | null {
  return NEC_THRESHOLD_CENTS[year] ?? null;
}

/** "Marcus T, MARCUS TAYLOR" -> ["marcus t", "marcus taylor"]. Words under 3 letters are dropped: too loose. */
export function matchWords(matchText: string, fallbackName: string): string[] {
  const raw = (matchText.trim() || fallbackName).toLowerCase();
  return [...new Set(raw.split(",").map((w) => w.replace(/\s+/g, " ").trim()).filter((w) => w.length >= 3))];
}

export function lineMatches(words: string[], merchant: string | null, description: string): boolean {
  if (words.length === 0) return false;
  const hay = `${merchant ?? ""} ${description}`.toLowerCase().replace(/\s+/g, " ");
  return words.some((w) => hay.includes(w));
}

export type VendorLine = {
  amountCents: number; // positive = money in, so payments are negative
  postedDate: string;
  accountType: string | null; // depository | credit | loan
  merchant: string | null;
  description: string;
};

export type VendorYear = {
  year: number;
  paidCents: number;
  /** Paid from a bank account (check, ACH, Zelle): what counts toward a 1099-NEC. */
  bankPaidCents: number;
  /** Paid by card: reported by the card processor on a 1099-K instead. */
  cardPaidCents: number;
  payments: number;
  thresholdCents: number | null;
  /** over: bank-paid total reached the threshold; unknown: no published threshold for the year. */
  status: "over" | "under" | "unknown";
};

/** Money out to one vendor, totalled by year. Money in (refunds) is ignored here. */
export function vendorYears(words: string[], lines: VendorLine[]): VendorYear[] {
  const by = new Map<number, VendorYear>();
  for (const l of lines) {
    if (l.amountCents >= 0 || !lineMatches(words, l.merchant, l.description)) continue;
    const year = Number(l.postedDate.slice(0, 4));
    const y = by.get(year) ?? { year, paidCents: 0, bankPaidCents: 0, cardPaidCents: 0, payments: 0, thresholdCents: necThresholdCents(year), status: "under" as const };
    const cents = -l.amountCents;
    y.paidCents += cents;
    y.payments += 1;
    if (l.accountType === "credit") y.cardPaidCents += cents;
    else y.bankPaidCents += cents;
    by.set(year, y);
  }
  const out = [...by.values()].sort((a, b) => b.year - a.year);
  for (const y of out) y.status = y.thresholdCents === null ? "unknown" : y.bankPaidCents >= y.thresholdCents ? "over" : "under";
  return out;
}
