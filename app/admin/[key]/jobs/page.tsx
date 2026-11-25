import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { adminKeyMatches } from "@/lib/admin";
import BooksExcludeButton from "@/components/admin/BooksExcludeButton";
import { linesByWedding } from "@/lib/costing";
import { centsLabel, lineCost } from "@/lib/costing-logic";
import { db } from "@/lib/db";
import { weddings } from "@/lib/db/schema";
import { postBankLedgerQuietly } from "@/lib/books/ledger";
import { jobLedgerBalances } from "@/lib/books/subledger";
import { jobsPage } from "@/lib/books/subledger-logic";
import { formatEventDate } from "@/lib/hub-constants";
import { SITE_NAME, VENUE_TIME_ZONE } from "@/lib/site";
import { HOUSE_TENANT_ID } from "@/lib/tenant-constants";

// Job costing on an accrual basis (2026-11-13, Jake: "force accrual and US
// GAAP", "we use the matching principle", "match revenue to expenses by job
// costing", "and accruals"). Every booking is a job. Since the subledger
// slice (docs/handoff task 2) every balance here is READ FROM THE LEDGER: the
// journal lines keyed to each job on 1100, 1300, 2300, 2400, 4500 and 5000,
// which postLedger derives from matched bank lines, approved receipts and the
// cost plans. The page's totals are therefore the general ledger's balances,
// and the page says so (or shows the difference) instead of computing its own
// version from the cost lines' "Paid" box. Arithmetic: jobsPage in
// lib/books/subledger-logic.ts, checked by scripts/verify-subledger.mjs.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Job costing",
  robots: { index: false, follow: false },
};

const pct = (f: number | null) => (f == null ? "" : `${Math.round(f * 100)}%`);

function monthLabel(key: string): string {
  return new Date(`${key}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function JobsPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!adminKeyMatches(key)) notFound();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: VENUE_TIME_ZONE });

  // Bring the books current first, so the page reads what the sources say now.
  await postBankLedgerQuietly(HOUSE_TENANT_ID, { actor: "owner dashboard", cause: "job costing opened" });
  const rows = await db.select().from(weddings).where(eq(weddings.tenantId, HOUSE_TENANT_ID));
  const lines = await linesByWedding(rows.map((r) => r.id));
  const { balances, tie } = await jobLedgerBalances(HOUSE_TENANT_ID);
  const excludedRows = rows.filter((w) => w.booksExcludedAt);
  const page = jobsPage(
    rows.filter((w) => !w.booksExcludedAt).map((w) => {
      const contract = Math.round(Number(w.totalAmount) * 100) || 0;
      const plan = lines.get(w.id) ?? [];
      let planned = 0;
      let missing = 0;
      for (const l of plan) {
        const c = lineCost(l, contract);
        if (c.missing) missing++;
        planned += l.actualCostCents ?? c.actual ?? c.planned ?? 0;
      }
      return {
        id: w.id,
        name: w.coupleNames,
        eventDate: w.eventDate,
        cancelled: w.status === "cancelled",
        archived: !!w.archivedAt,
        contractCents: contract,
        plannedCostCents: planned,
        missing,
        hasPlan: plan.length > 0,
      };
    }),
    balances,
    tie,
    today,
  );
  const b = page.ledger;
  const codeOf = (k: string, fallback: string) => tie.find((t) => t.systemKey === k)?.code ?? fallback;
  const tiles = [
    { label: "Undeposited funds", code: codeOf("undeposited_funds", "1050"), value: b.undeposited, shown: page.totals.undeposited, note: "Cash and checks marked paid, not yet matched to a bank deposit" },
    { label: "Deferred revenue", code: codeOf("deferred_revenue", "2300"), value: b.deferredRevenue, shown: page.totals.deferredRevenue, note: "Collected for events not yet held (liability)" },
    { label: "Accounts receivable", code: codeOf("accounts_receivable", "1100"), value: b.receivable, shown: page.totals.receivable, note: "Earned, not yet collected (asset)" },
    { label: "Prepaid job costs", code: codeOf("prepaid_job_costs", "1300"), value: b.prepaidCost, shown: page.totals.prepaidCost, note: "Paid out for events not yet held (asset)" },
    { label: "Accrued job costs", code: codeOf("accrued_job_costs", "2400"), value: b.accruedCost, shown: page.totals.accruedCost, note: "Owed for events already held (liability)" },
  ];
  const unplanned = page.rows.filter((j) => !j.hasPlan && !j.cancelled && !j.archived).length;
  const ledger = { jobs: page.rows, periods: page.periods, backlog: page.backlog };

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
          <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
          <h1 className="text-2xl text-charcoal">Job costing</h1>
          <p className="text-sm text-ink/60">
            Accrual basis, US GAAP. A job&apos;s revenue is recognized on its event date, and its direct costs are matched to it in
            the same period, whenever the cash moves. Owners&apos; split is what a job leaves, not a cost of it.
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm font-medium">
            <a href={`/admin/${key}`} className="text-terracotta underline decoration-parchment underline-offset-2">
              Back to the command center
            </a>
            <a href={`/admin/${key}/crew`} className="text-terracotta underline decoration-parchment underline-offset-2">
              Crew, pay and materials
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6">
        <section>
          <h2 className="mb-1 text-lg font-semibold text-charcoal">Accrual balances today, from the general ledger</h2>
          <p className="mb-3 text-sm text-ink/60">
            Each balance is the ledger account itself; the jobs below are its subledger and add up to it. Payments count once
            they are matched from the bank, and a held job&apos;s cost counts at plan until a paid amount is entered on it.
            {unplanned > 0 && ` ${unplanned} job${unplanned === 1 ? " has" : "s have"} no cost plan yet, so their costs are missing here.`}
          </p>
          <p className={`mb-3 rounded-xl border bg-white p-3 text-sm ${page.ties ? "border-parchment text-sage-dark" : "border-terracotta text-terracotta-dark"}`}>
            {page.ties
              ? "Ties to the general ledger: the jobs below add up to 1050, 1100, 1300, 2300 and 2400 exactly."
              : "Does not tie to the general ledger. Some money on these accounts isn't keyed to a job; the month can't close until it is. Open Books, then Tie-out, to see which lines."}
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-2xl border border-parchment bg-white p-4">
                <p className="text-xs uppercase tracking-wider text-ink/55">
                  {t.code} {t.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-charcoal">{centsLabel(t.value)}</p>
                <p className="mt-0.5 text-xs text-ink/55">{t.note}</p>
                {t.shown !== t.value && <p className="mt-1 text-xs font-semibold text-terracotta-dark">Jobs add up to {centsLabel(t.shown)}</p>}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-charcoal">Earned, by event month</h2>
          {ledger.periods.length === 0 ? (
            <p className="rounded-2xl border border-parchment bg-white p-5 text-sm text-ink/60">No events held yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-parchment bg-white p-3">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink/55">
                    <th className="pb-2 font-medium">Month</th>
                    <th className="pb-2 text-right font-medium">Jobs</th>
                    <th className="pb-2 text-right font-medium">Revenue</th>
                    <th className="pb-2 text-right font-medium">Direct cost</th>
                    <th className="pb-2 text-right font-medium">Gross profit</th>
                    <th className="pb-2 text-right font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.periods.map((p) => (
                    <tr key={p.key} className="border-t border-parchment tabular-nums">
                      <td className="py-1.5 text-charcoal">{monthLabel(p.key)}</td>
                      <td className="py-1.5 text-right">{p.jobs}</td>
                      <td className="py-1.5 text-right">{centsLabel(p.revenue)}</td>
                      <td className="py-1.5 text-right">{centsLabel(p.cost)}</td>
                      <td className="py-1.5 text-right font-semibold text-charcoal">{centsLabel(p.grossProfit)}</td>
                      <td className="py-1.5 text-right">{pct(p.revenue > 0 ? p.grossProfit / p.revenue : null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-sm text-ink/60">
            Backlog (contracted, not yet earned): {ledger.backlog.jobs} job{ledger.backlog.jobs === 1 ? "" : "s"},{" "}
            {centsLabel(ledger.backlog.revenue)} revenue, {centsLabel(ledger.backlog.cost)} planned cost,{" "}
            {centsLabel(ledger.backlog.grossProfit)} planned gross profit.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-charcoal">Every job</h2>
          <div className="overflow-x-auto rounded-2xl border border-parchment bg-white p-3">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink/55">
                  <th className="pb-2 font-medium">Job</th>
                  <th className="pb-2 text-right font-medium">Revenue</th>
                  <th className="pb-2 text-right font-medium">Direct cost</th>
                  <th className="pb-2 text-right font-medium">Gross profit</th>
                  <th className="pb-2 text-right font-medium">Deferred 2300</th>
                  <th className="pb-2 text-right font-medium">Receivable 1100</th>
                  <th className="pb-2 text-right font-medium">Prepaid 1300</th>
                  <th className="pb-2 text-right font-medium">Accrued 2400</th>
                </tr>
              </thead>
              <tbody>
                {ledger.jobs.map((j) => (
                  <tr key={j.id} className="border-t border-parchment tabular-nums">
                    <td className="py-1.5 pr-2">
                      <a href={`/admin/${key}/costing/${j.id}`} className="font-semibold text-charcoal underline decoration-parchment underline-offset-2 hover:text-terracotta">
                        {j.name}
                      </a>
                      <span className="block text-xs text-ink/55">
                        {j.eventDate ? formatEventDate(j.eventDate) : "no date"} · {j.cancelled ? "cancelled" : j.earned ? "earned" : "not yet earned"}
                        {j.archived && " · archived"}
                        {!j.hasPlan && " · no cost plan"}
                        {j.missing > 0 && ` · ${j.missing} cost${j.missing === 1 ? "" : "s"} not set`}
                        {j.undeposited ? ` · ${centsLabel(j.undeposited)} paid by hand, not deposited yet` : ""}
                      </span>
                      <BooksExcludeButton adminKey={key} weddingId={j.id} excluded={false} />
                    </td>
                    <td className="py-1.5 text-right">{centsLabel(j.revenue)}</td>
                    <td className="py-1.5 text-right">{centsLabel(j.cost)}</td>
                    <td className="py-1.5 text-right font-semibold text-charcoal">
                      {centsLabel(j.grossProfit)}
                      <span className="block text-xs font-normal text-ink/55">{pct(j.margin)}</span>
                    </td>
                    <td className="py-1.5 text-right">{j.deferredRevenue ? centsLabel(j.deferredRevenue) : ""}</td>
                    <td className="py-1.5 text-right">{j.receivable ? centsLabel(j.receivable) : ""}</td>
                    <td className="py-1.5 text-right">{j.prepaidCost ? centsLabel(j.prepaidCost) : ""}</td>
                    <td className="py-1.5 text-right">{j.accruedCost ? centsLabel(j.accruedCost) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-parchment font-semibold tabular-nums text-charcoal">
                  <td className="py-2">Total (the general ledger)</td>
                  <td />
                  <td />
                  <td />
                  <td className="py-2 text-right">{centsLabel(page.totals.deferredRevenue)}</td>
                  <td className="py-2 text-right">{centsLabel(page.totals.receivable)}</td>
                  <td className="py-2 text-right">{centsLabel(page.totals.prepaidCost)}</td>
                  <td className="py-2 text-right">{centsLabel(page.totals.accruedCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {excludedRows.length > 0 && (
          <section>
            <h2 className="mb-1 text-lg font-semibold text-charcoal">Left out of the books</h2>
            <p className="mb-3 text-sm text-ink/60">Bookings marked as never a real job. Nothing was deleted; each change is in the audit log.</p>
            <ul className="divide-y divide-parchment rounded-2xl border border-parchment bg-white px-4 text-sm">
              {excludedRows.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 break-words">
                    <span className="font-semibold text-charcoal">{w.coupleNames}</span>{" "}
                    <span className="text-ink/55">
                      {w.eventDate ? formatEventDate(w.eventDate) : ""}
                      {w.booksExcludedReason ? ` · ${w.booksExcludedReason}` : ""}
                    </span>
                  </span>
                  <BooksExcludeButton adminKey={key} weddingId={w.id} excluded />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
