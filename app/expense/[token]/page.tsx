import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CaptureForm from "@/components/expenses/CaptureForm";
import { CLAIM_STATUS_LABEL, PAYOUT_STATUS_LABEL, type ClaimStatus, type PayoutStatus } from "@/lib/expense-logic";
import { captureJobs, claimsForCrew, crewForToken, expenseCategories, todayLocal } from "@/lib/expenses";
import { SITE_NAME } from "@/lib/site";

// A crew member's own expense page (2026-11-13). The link is the credential
// (lib/expense-token.ts): it opens one person's claims and one action, send a
// new one. Built for a phone in a parking lot after load-out.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Send an expense",
  robots: { index: false, follow: false },
};

const usd = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

function stage(status: string, payoutStatus: string, reimbursed: boolean): string {
  if (reimbursed) return "Paid back";
  if (status !== "approved") return CLAIM_STATUS_LABEL[status as ClaimStatus] ?? status;
  return PAYOUT_STATUS_LABEL[payoutStatus as PayoutStatus] ?? "Approved";
}

export default async function ExpensePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const crew = await crewForToken(token);
  if (!crew) notFound();
  const [jobs, categories, mine] = await Promise.all([captureJobs(crew.tenantId), expenseCategories(crew.tenantId), claimsForCrew(crew.id)]);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto max-w-xl px-4 py-5">
          <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
          <h1 className="text-2xl text-charcoal">Expenses for {crew.name}</h1>
          <p className="text-sm text-ink/60">
            Paid for something for a job out of your own pocket? Snap the receipt and send it here. Jake approves the report,
            then the payout is approved before you&apos;re paid back.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-xl space-y-8 px-4 py-6">
        <CaptureForm
          token={token}
          today={todayLocal()}
          jobs={jobs.map((j) => ({ id: j.id, label: `${j.name} (${j.eventDate})` }))}
          categories={categories}
        />
        <section>
          <h2 className="text-lg font-semibold text-charcoal">What you&apos;ve sent</h2>
          {mine.length === 0 ? (
            <p className="mt-2 text-sm text-ink/60">Nothing yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-parchment rounded-2xl border border-parchment bg-white">
              {mine.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3 text-sm">
                  <span className="min-w-0 break-words">
                    <span className="font-semibold text-charcoal">{c.merchant || "Expense"}</span>
                    <span className="block text-xs text-ink/55">
                      {c.spentOn} · {c.description}
                    </span>
                    {c.decisionNote && <span className="block text-xs text-ink/55">Note: {c.decisionNote}</span>}
                    {c.hasReceipt && (
                      <a href={`/api/expense/${token}/receipt/${c.id}`} className="text-xs font-semibold text-terracotta underline decoration-parchment underline-offset-2">
                        Receipt
                      </a>
                    )}
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="font-semibold text-charcoal">{usd(c.amountCents)}</span>
                    <span className="block text-xs text-ink/60">{stage(c.status, c.payoutStatus, c.reimbursed)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
