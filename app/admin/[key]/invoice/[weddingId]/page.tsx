import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrintButton from "@/components/hub/PrintButton";
import { adminKeyMatches, getAdminWeddingRow } from "@/lib/admin";
import { formatEventDate } from "@/lib/hub-constants";
import { buildInvoice, money } from "@/lib/invoice";
import { VENUE_TIME_ZONE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

// The owner's invoice for one booking, wedding or corporate, printed or saved
// as a PDF from the browser and handed to the client. Built from the booking
// row by lib/invoice.ts, so it always matches the money set in "Edit money".
// The admin key is in this URL, so printing swaps in a tokenless path.
export default async function AdminInvoicePage({
  params,
}: {
  params: Promise<{ key: string; weddingId: string }>;
}) {
  const { key, weddingId } = await params;
  if (!adminKeyMatches(key)) notFound();
  const row = await getAdminWeddingRow(weddingId);
  if (!row) notFound();

  const inv = buildInvoice(row);
  const issued = new Date().toLocaleDateString("en-US", {
    timeZone: VENUE_TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-cream p-6 text-charcoal print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between print:hidden">
          <a href={`/admin/${key}`} className="text-sm font-semibold text-terracotta hover:text-terracotta-dark">
            Back to bookings
          </a>
          <PrintButton maskPath="/invoice" />
        </div>
        <p className="mt-3 text-xs text-ink/60 print:hidden">
          To change the total, deposit or paid status, use Edit money on the booking. Print saves a
          PDF in most browsers.
        </p>

        <div className="relative mt-4 overflow-hidden rounded-2xl border border-parchment bg-white p-8 print:rounded-none print:border-0 print:p-0">
          {inv.balancePaid && (
            <div
              aria-label="Paid in full"
              className="pointer-events-none absolute right-6 top-24 rotate-[-12deg] rounded-lg border-4 border-sage px-4 py-1 text-3xl font-bold tracking-widest text-sage opacity-80"
            >
              PAID
            </div>
          )}

          <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-charcoal pb-4">
            <div>
              <p className="text-xl font-bold text-charcoal">{inv.from.name}</p>
              <p className="text-sm text-ink/70">{inv.from.email}</p>
              <p className="text-sm text-ink/70">{inv.from.site}</p>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-bold tracking-wide text-terracotta">Invoice</h1>
              <p className="mt-1 text-sm text-ink/70">
                No. <span className="font-semibold text-charcoal">{inv.number}</span>
              </p>
              <p className="text-sm text-ink/70">Issued {issued}</p>
            </div>
          </header>

          <section className="mt-6 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/50">Bill to</h2>
              <p className="mt-1 font-semibold text-charcoal">{inv.billTo.name}</p>
              {inv.billTo.email && <p className="text-sm text-ink/70">{inv.billTo.email}</p>}
              {inv.billTo.phone && <p className="text-sm text-ink/70">{inv.billTo.phone}</p>}
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/50">
                {inv.kind === "corporate" ? "Event" : "Wedding"}
              </h2>
              <p className="mt-1 font-semibold text-charcoal">{formatEventDate(inv.event.date)}</p>
              <p className="text-sm text-ink/70">{inv.event.venue}</p>
              {inv.event.address && <p className="text-sm text-ink/70">{inv.event.address}</p>}
            </div>
          </section>

          {inv.customTerms ? (
            <section className="mt-8">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/50">Arrangement</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{inv.customTerms}</p>
            </section>
          ) : (
            <table className="mt-8 w-full text-sm">
              <thead>
                <tr className="border-b border-parchment text-left text-xs uppercase tracking-wider text-ink/50">
                  <th className="pb-2 font-semibold">Service</th>
                  <th className="pb-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.lines.map((l, i) => (
                  <tr key={i} className="border-b border-parchment/60 align-top">
                    <td className="py-3">
                      <p className="font-medium text-charcoal">{l.label}</p>
                      {l.detail && <p className="text-xs text-ink/60">{l.detail}</p>}
                    </td>
                    <td className="py-3 text-right tabular-nums">{money(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <section className="ml-auto mt-6 max-w-xs space-y-1.5 text-sm tabular-nums">
            <div className="flex justify-between">
              <span className="text-ink/70">Total</span>
              <span className="font-semibold">{money(inv.total)}</span>
            </div>
            {inv.depositPaid ? (
              <div className="flex justify-between">
                <span className="text-ink/70">Deposit received</span>
                <span>-{money(inv.deposit)}</span>
              </div>
            ) : (
              !inv.balancePaid && (
                <div className="flex justify-between">
                  <span className="text-ink/70">Balance after the {inv.kind === "corporate" ? "event" : "wedding"}</span>
                  <span>{money(inv.balanceAfter)}</span>
                </div>
              )
            )}
            <div className="flex justify-between border-t-2 border-charcoal pt-2 text-base">
              <span className="font-semibold">
                {inv.balancePaid ? "Paid in full" : inv.depositPaid ? "Amount due" : "Deposit due now"}
              </span>
              <span className="font-bold">{money(inv.amountDue)}</span>
            </div>
          </section>

          {!inv.balancePaid && (
            <section className="mt-6 rounded-xl bg-cream px-4 py-3 text-sm text-ink/80 print:bg-transparent print:px-0">
              <p>{inv.balanceDueNote}</p>
              <p className="mt-1">{inv.paymentNote}</p>
            </section>
          )}

          <p className="mt-8 text-sm text-ink/70">Thank you for having us.</p>

          <footer className="mt-10 border-t border-parchment pt-4 text-xs text-ink/60">
            <p>
              <span className="font-semibold text-charcoal">Like how this invoice works?</span> We built
              it ourselves. If anything at your company still runs on spreadsheets, email chains or
              manual steps, we fix that too. Ask Jake: {inv.from.email}
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
