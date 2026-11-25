import { COMPASS_FULL_NAME, officiantInvoiceNumber, officiantInvoiceParts } from "@/lib/compass";
import { formatEventDate } from "@/lib/hub-constants";
import { SITE_NAME, VENUE_TIME_ZONE } from "@/lib/site";
import type { ReactNode } from "react";

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: VENUE_TIME_ZONE, dateStyle: "medium" }).format(new Date(iso));

// The two-part officiating invoice: deposit, then balance after the ceremony.
// Shown under the agreement in the couple's hub and on the owner's copy, so
// both read the same paid / not paid state. `actions` lets the owner page put
// its mark-paid buttons beside each part.
export default function OfficiantInvoice({
  id,
  eventDate,
  coupleNames,
  officiantName,
  feeUsd,
  depositUsd,
  balanceHours,
  depositPaidAt,
  balancePaidAt,
  actions,
  cardPayments = false,
}: {
  id: string;
  eventDate: string;
  coupleNames: string;
  officiantName: string;
  feeUsd: number;
  depositUsd: number;
  balanceHours: number;
  depositPaidAt: string | null;
  balancePaidAt: string | null;
  actions?: (part: "deposit" | "balance", paid: boolean) => ReactNode;
  /** Card payments are switched on: the footer offers card beside cash or check. */
  cardPayments?: boolean;
}) {
  const inv = officiantInvoiceParts({ feeUsd, depositUsd, balanceHours, depositPaidAt, balancePaidAt });
  return (
    <section className="mt-10 break-inside-avoid rounded-2xl border border-parchment bg-white p-6 print:break-before-page print:rounded-none print:border-charcoal">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-terracotta">Invoice</p>
          <h2 className="text-lg font-semibold text-charcoal">{COMPASS_FULL_NAME}</h2>
          <p className="text-sm text-ink/70">
            Wedding officiating by {officiantName} · {formatEventDate(eventDate)}
          </p>
          <p className="text-sm text-ink/70">Bill to: {coupleNames}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono font-semibold text-charcoal">{officiantInvoiceNumber({ id, eventDate })}</p>
          {inv.due === 0 && (
            <p className="mt-1 inline-block rounded border-2 border-sage px-2 font-bold text-sage-dark">PAID</p>
          )}
        </div>
      </div>
      <table className="mt-4 w-full text-sm">
        <tbody>
          {inv.parts.map((p, i) => (
            <tr key={p.label} className="border-t border-parchment align-top">
              <td className="py-2 pr-2">
                <p className="font-semibold text-charcoal">{p.label}</p>
                <p className="text-ink/60">{p.due}</p>
                <p className={p.paidAt ? "font-semibold text-sage-dark" : "text-ink/60"}>
                  {p.paidAt ? `Received ${day(p.paidAt)}` : "Not received yet"}
                </p>
                {actions && (
                  <div className="mt-1 print:hidden">{actions(i === 0 ? "deposit" : "balance", Boolean(p.paidAt))}</div>
                )}
              </td>
              <td className="py-2 text-right font-semibold tabular-nums text-charcoal">{money(p.amount)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-charcoal">
            <td className="py-2 font-semibold">Total, flat fee</td>
            <td className="py-2 text-right font-semibold tabular-nums">{money(inv.total)}</td>
          </tr>
          <tr>
            <td className="py-1 text-ink/70">Received</td>
            <td className="py-1 text-right tabular-nums">{money(inv.paid)}</td>
          </tr>
          <tr>
            <td className="py-1 font-semibold">Still owed</td>
            <td className="py-1 text-right font-semibold tabular-nums">{money(inv.due)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs text-ink/60">
        {cardPayments ? "Pay by card above, or by cash or check" : "Pay by cash or check"} made out to{" "}
        {SITE_NAME.replace(/\.$/, "")}. This invoice is separate from any{" "}
        {SITE_NAME} invoice for DJ, music or bar service.
      </p>
    </section>
  );
}
