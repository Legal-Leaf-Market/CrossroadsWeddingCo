import {
  ACOUSTIC_ADDON_USD,
  bartenderFeeUsd,
  CONTACT_EMAIL,
  CORPORATE_DJ_SOUND_USD,
  DJ_DAY_RATE_USD,
  OWNER_EMAIL,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";
import { bartenderStaffFromAddons } from "@/lib/contract";

// The invoice, built from the same booking row and the same price constants as
// the site and the agreement, so the number on the invoice can never disagree
// with the number a client was quoted. Pure: no database, no clock except the
// `issued` date the caller passes in, so it renders the same on every device.
//
// The stored total is the truth. Line items are derived from the services the
// booking carries; if the owner set a different total in "Edit money" (a
// discount, a travel surcharge, a trade), one adjustment line makes up the
// difference, so the lines always add up to the total and nothing is invented.

export const CORPORATE_PACKAGE = "corporate";

export type InvoiceLine = { label: string; detail?: string; amount: number };

export type Invoice = {
  number: string;
  kind: "wedding" | "corporate";
  billTo: { name: string; email: string | null; phone: string | null };
  event: { date: string; venue: string; address: string | null };
  lines: InvoiceLine[];
  /** Free-text arrangement that replaces the line items (trades, legacy deals). */
  customTerms: string | null;
  total: number;
  deposit: number;
  depositPaid: boolean;
  balancePaid: boolean;
  /** What is owed right now: the deposit while it is unpaid, then the balance. */
  amountDue: number;
  /** The balance after the deposit, owed after the event. */
  balanceAfter: number;
  balanceDueNote: string;
  paymentNote: string;
  from: { name: string; email: string; site: string };
};

export type InvoiceWedding = {
  id: string;
  coupleNames: string;
  eventDate: string;
  venueName: string;
  venueAddress: string | null;
  packageType: string | null;
  addons: unknown;
  totalAmount: string;
  depositAmount: string;
  isDepositPaid: boolean | null;
  isBalancePaid: boolean | null;
  customTerms: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

/**
 * Readable and stable: the event date plus the first four characters of the
 * booking id, e.g. CR-20261107-3F2A. Same booking, same number, forever, with
 * no counter to keep in a database.
 */
export function invoiceNumber(w: { id: string; eventDate: string }): string {
  return `CR-${w.eventDate.replace(/-/g, "")}-${w.id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildInvoice(w: InvoiceWedding): Invoice {
  const corporate = w.packageType === CORPORATE_PACKAGE;
  const rows = Array.isArray(w.addons) ? (w.addons as { type?: string; fee?: unknown }[]) : [];
  const total = round2(Number(w.totalAmount) || 0);
  const deposit = round2(Number(w.depositAmount) || 0);
  const custom = w.customTerms?.trim() || null;

  const lines: InvoiceLine[] = [];
  if (!custom) {
    if (corporate) {
      lines.push({
        label: "DJ, sound and MC",
        detail: "All equipment, setup and teardown, flat rate",
        amount: CORPORATE_DJ_SOUND_USD,
      });
    } else if (w.packageType !== "a_la_carte") {
      lines.push({
        label: "Wedding DJ and MC",
        detail: "Ceremony, cocktail hour and reception, flat rate",
        amount: DJ_DAY_RATE_USD,
      });
    }
    for (const r of rows) {
      const fee = typeof r.fee === "number" ? r.fee : null;
      if (r.type === "acoustic_set") {
        lines.push({ label: "Live solo acoustic set", amount: fee ?? ACOUSTIC_ADDON_USD });
      } else if (r.type === "bar_service") {
        const staff = bartenderStaffFromAddons(w.addons);
        lines.push({
          label: `Bar service, ${staff === 2 ? "two bartenders" : "one bartender"}`,
          detail: "Serve only: alcohol provided by the host or venue",
          amount: fee ?? bartenderFeeUsd(staff),
        });
      }
    }
    const sum = round2(lines.reduce((s, l) => s + l.amount, 0));
    const diff = round2(total - sum);
    if (diff !== 0) {
      lines.push({ label: diff > 0 ? "Additional" : "Adjustment", detail: diff > 0 ? "Agreed extras" : "Agreed discount", amount: diff });
    }
  }

  const depositPaid = Boolean(w.isDepositPaid);
  const balancePaid = Boolean(w.isBalancePaid);
  const balanceAfter = round2(Math.max(0, total - deposit));
  // Before the deposit lands, the deposit is what is due now; the rest waits
  // until after the event. After it lands, the balance is what is left.
  const amountDue = balancePaid ? 0 : depositPaid ? balanceAfter : Math.min(deposit, total);

  return {
    number: invoiceNumber(w),
    kind: corporate ? "corporate" : "wedding",
    billTo: { name: w.coupleNames, email: w.contactEmail, phone: w.contactPhone },
    event: { date: w.eventDate, venue: w.venueName, address: w.venueAddress },
    lines,
    customTerms: custom,
    total,
    deposit,
    depositPaid,
    balancePaid,
    amountDue,
    balanceAfter,
    balanceDueNote: depositPaid
      ? `Balance due 24 hours after the ${corporate ? "event" : "wedding"} start time.`
      : `The ${money(deposit)} deposit locks the date and comes off the total. The rest is due 24 hours after the ${corporate ? "event" : "wedding"} start time.`,
    paymentNote: `Pay by cash or check made out to ${SITE_NAME.replace(/\.$/, "")}.`,
    from: { name: SITE_NAME, email: OWNER_EMAIL || CONTACT_EMAIL, site: SITE_URL.replace(/^https?:\/\//, "") },
  };
}

export function money(n: number): string {
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
}
