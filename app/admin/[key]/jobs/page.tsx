import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { adminKeyMatches } from "@/lib/admin";
import { collectedOn } from "@/lib/admin-insights";
import { linesByWedding } from "@/lib/costing";
import { centsLabel, jobLedger } from "@/lib/costing-logic";
import { db } from "@/lib/db";
import { weddings } from "@/lib/db/schema";
import { formatEventDate } from "@/lib/hub-constants";
import { SITE_NAME, VENUE_TIME_ZONE } from "@/lib/site";
import { HOUSE_TENANT_ID } from "@/lib/tenant-constants";

// Job costing on an accrual basis (2026-11-13, Jake: "force accrual and US
// GAAP", "we use the matching principle", "match revenue to expenses by job
// costing", "and accruals"). Every booking is a job; its revenue and its
// direct costs land in the event's month, and what is earned-not-collected,
// collected-not-earned, paid-early and owed-late shows as the four accrual
// balances. The arithmetic is jobLedger in lib/costing-logic.ts.
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

  const rows = await db
    .select()
    .from(weddings)
    .where(and(eq(weddings.tenantId, HOUSE_TENANT_ID), isNull(weddings.archivedAt)));
  const lines = await linesByWedding(rows.map((r) => r.id));
  const ledger = jobLedger(
    rows.map((w) => ({
      id: w.id,
      name: w.coupleNames,
      eventDate: w.eventDate,
      cancelled: w.status === "cancelled",
      revenueCents: Math.round(Number(w.totalAmount) * 100) || 0,
      collectedCents: Math.round(
        collectedOn({
          totalAmount: w.totalAmount,
          depositAmount: w.depositAmount,
          isDepositPaid: w.isDepositPaid ?? false,
          isBalancePaid: w.isBalancePaid ?? false,
          status: w.status,
        }) * 100,
      ),
      lines: lines.get(w.id) ?? [],
    })),
    today,
  );
  const b = ledger.balances;
  const tiles = [
    { label: "Deferred revenue", value: b.deferredRevenue, note: "Collected for events not yet held (liability)" },
    { label: "Accounts receivable", value: b.receivable, note: "Earned, not yet collected (asset)" },
    { label: "Prepaid job costs", value: b.prepaidCost, note: "Paid out for events not yet held (asset)" },
    { label: "Accrued job costs", value: b.accruedCost, note: "Owed for events already held (liability)" },
  ];
  const unplanned = ledger.jobs.filter((j) => !j.hasPlan).length;

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
          <h2 className="mb-1 text-lg font-semibold text-charcoal">Accrual balances today</h2>
          <p className="mb-3 text-sm text-ink/60">
            From the jobs below. Job costs count at plan until a paid amount is entered on the job.
            {unplanned > 0 && ` ${unplanned} job${unplanned === 1 ? " has" : "s have"} no cost plan yet, so their costs are missing here.`}
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-2xl border border-parchment bg-white p-4">
                <p className="text-xs uppercase tracking-wider text-ink/55">{t.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-charcoal">{centsLabel(t.value)}</p>
                <p className="mt-0.5 text-xs text-ink/55">{t.note}</p>
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
                  <th className="pb-2 text-right font-medium">Deferred</th>
                  <th className="pb-2 text-right font-medium">Receivable</th>
                  <th className="pb-2 text-right font-medium">Prepaid</th>
                  <th className="pb-2 text-right font-medium">Accrued</th>
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
                        {formatEventDate(j.eventDate)} · {j.earned ? "earned" : "not yet earned"}
                        {!j.hasPlan && " · no cost plan"}
                        {j.missing > 0 && ` · ${j.missing} cost${j.missing === 1 ? "" : "s"} not set`}
                      </span>
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
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
