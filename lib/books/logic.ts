// The decisions behind the books, as pure functions: no database, no imports.
// Kept apart so scripts/verify-books.mjs can check them with plain Node
// (`node --experimental-strip-types scripts/verify-books.mjs`), the way
// verify-scheduling.mjs checks the calendar. Run it after touching any of this.

/** How a rule sees text: lower case, single spaces, trimmed. */
export function normalizeMatchText(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export const PAYMENT_KINDS = ["deposit", "balance"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export type OpenBooking = {
  id: string;
  name: string;
  eventDate: string;
  totalCents: number;
  depositCents: number;
  receivedCents: number;
  /** A deposit marked paid by hand with no deposit matched from the bank: paid in cash or check. */
  depositOutsideBankCents: number;
  /** What is still owed toward the deposit, then toward the whole. */
  depositDueCents: number;
  balanceDueCents: number;
};

export type Suggestion = { bookingId: string; name: string; kind: PaymentKind; why: string };

/**
 * What a booking has paid, counting money that never touched the bank. Cash and
 * checks are real (deposits are cash and check for now), so a deposit the owner
 * marked paid with no deposit matched from the bank was paid outside it, and a
 * booking marked fully paid owes nothing. Pure; exported for the verify script.
 */
export function creditFor(b: {
  totalCents: number;
  depositCents: number;
  isDepositPaid: boolean;
  isBalancePaid: boolean;
  bankCents: number;
  bankDepositLines: number;
}) {
  const depositOutsideBankCents = b.isDepositPaid && b.bankDepositLines === 0 ? b.depositCents : 0;
  const credited = b.bankCents + depositOutsideBankCents;
  return {
    depositOutsideBankCents,
    creditedCents: credited,
    depositDueCents: b.isDepositPaid || b.isBalancePaid ? 0 : Math.max(0, b.depositCents - credited),
    balanceDueCents: b.isBalancePaid ? 0 : Math.max(0, b.totalCents - credited),
  };
}

/** Words in a client name worth looking for on a bank line. "Hayes", not "and". */
function nameTokens(name: string): string[] {
  const stop = new Set(["and", "the", "mr", "mrs", "ms", "dr", "wedding", "party", "event", "inc", "llc", "co"]);
  return [...new Set(normalizeMatchText(name).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !stop.has(w)))];
}

/**
 * Pure: which bookings this money-in line might be for, best first, at most
 * three. A suggestion needs real evidence: the exact amount still owed, or a
 * client's name on the line. Exported for the verify script.
 */
export function suggestFor(
  line: { amountCents: number; merchant: string | null; description: string; postedDate: string },
  bookings: OpenBooking[],
): Suggestion[] {
  if (line.amountCents <= 0) return [];
  const text = normalizeMatchText(`${line.merchant ?? ""} ${line.description}`);
  const words = new Set(text.split(/[^a-z0-9]+/));
  const scored: (Suggestion & { score: number })[] = [];
  for (const b of bookings) {
    if (b.depositDueCents === 0 && b.balanceDueCents === 0 && !nameTokens(b.name).some((t) => words.has(t))) continue; // paid up, no name: not a candidate
    const reasons: string[] = [];
    let score = 0;
    let kind: PaymentKind = b.depositDueCents > 0 ? "deposit" : "balance";
    if (b.depositDueCents > 0 && line.amountCents === b.depositDueCents) {
      score += 3;
      kind = "deposit";
      reasons.push("the deposit still owed");
    } else if (b.balanceDueCents > 0 && line.amountCents === b.balanceDueCents) {
      score += 3;
      kind = "balance";
      reasons.push(b.depositDueCents > 0 ? "the full amount still owed" : "the balance still owed");
    }
    const hit = nameTokens(b.name).find((t) => words.has(t));
    if (hit) {
      score += 2;
      reasons.push(`"${hit}" is on the bank line`);
    }
    if (!score) continue;
    // A payment usually lands before the event or within a few weeks after it.
    const days = (Date.parse(b.eventDate) - Date.parse(line.postedDate)) / 86_400_000;
    // Far outside that, one piece of evidence is not enough; amount AND name still is.
    if (days < -60 || days > 540) score -= 2;
    if (score < 2) continue;
    scored.push({ bookingId: b.id, name: b.name, kind, why: `Matches ${reasons.join(" and ")}`, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 3)
    .map(({ score: _s, ...s }) => s);
}

/** Pure: does this rule match this bank line? Exported for the verify script. */
export function ruleMatches(
  rule: { matchField: string; matchType: string; pattern: string; direction: string },
  tx: { merchant: string | null; description: string; amountCents: number },
): boolean {
  if (rule.direction === "in" && tx.amountCents <= 0) return false;
  if (rule.direction === "out" && tx.amountCents >= 0) return false;
  const text = normalizeMatchText(rule.matchField === "merchant" ? tx.merchant : tx.description);
  if (!text) return false;
  return rule.matchType === "equals" ? text === rule.pattern : text.includes(rule.pattern);
}

/** Most specific first: exact before contains, longer patterns before shorter, newest breaks ties. */
export function orderRules<T extends { matchType: string; pattern: string; createdAt: Date }>(rules: T[]): T[] {
  return [...rules].sort(
    (a, b) =>
      (a.matchType === "equals" ? 0 : 1) - (b.matchType === "equals" ? 0 : 1) ||
      b.pattern.length - a.pattern.length ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export type LineInput = { accountId: string; debitCents: number; creditCents: number };

/** Debit and credit for one bank line, by the spec's posting table. Pure; exported for the verify script. */
export function bankLinePosting(amountCents: number, bankAccountLedgerId: string, categoryLedgerId: string): LineInput[] {
  const abs = Math.abs(amountCents);
  return amountCents > 0
    ? [
        { accountId: bankAccountLedgerId, debitCents: abs, creditCents: 0 },
        { accountId: categoryLedgerId, debitCents: 0, creditCents: abs },
      ]
    : [
        { accountId: categoryLedgerId, debitCents: abs, creditCents: 0 },
        { accountId: bankAccountLedgerId, debitCents: 0, creditCents: abs },
      ];
}
