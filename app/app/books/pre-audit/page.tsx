import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import AccountShell from "@/components/account/AccountShell";
import { getBooksWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { expenseClaims, receipts } from "@/lib/db/schema";
import { ledgerToday } from "@/lib/books/ledger";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pre-audit packet", robots: { index: false, follow: false } };

const link = "font-semibold text-terracotta-dark underline underline-offset-2";
const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default async function PreAuditPage({ searchParams }: { searchParams: Promise<{ year?: string | string[] }> }) {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  const { year: raw } = await searchParams;
  const today = ledgerToday();
  const currentYear = Number(today.slice(0, 4));
  const parsed = typeof raw === "string" && /^\d{4}$/.test(raw) ? Number(raw) : currentYear;
  const year = parsed >= 1900 && parsed <= currentYear ? parsed : currentYear;
  const from = `${year}-01-01`;
  const through = year === currentYear ? today : `${year}-12-31`;
  const tenantId = ws.tenant.id;
  const evidence = await db.select({
    id: expenseClaims.id, day: expenseClaims.spentOn, merchant: expenseClaims.merchant,
    description: expenseClaims.description, status: expenseClaims.status, fileName: receipts.fileName,
    receiptId: receipts.id, amountCents: expenseClaims.amountCents,
  }).from(expenseClaims)
    .leftJoin(receipts, and(eq(expenseClaims.receiptId, receipts.id), eq(receipts.tenantId, tenantId)))
    .where(and(eq(expenseClaims.tenantId, tenantId), gte(expenseClaims.spentOn, from), lte(expenseClaims.spentOn, through)))
    .orderBy(asc(expenseClaims.spentOn), asc(expenseClaims.id)).limit(501);
  const reports = [
    ["Trial balance CSV", `/api/app/books/export?report=trial-balance&asof=${through}`],
    ["General ledger CSV", `/api/app/books/ledger?from=${from}&to=${through}`],
    ["Subledger CSV", `/api/app/books/export?report=subledgers&asof=${through}`],
    ["Control account tie-out", `/app/books/tie-out?asof=${through}`],
    ["CPA comparison worksheet", `/api/app/books/export?report=cpa-tie-out&asof=${through}`],
    ["Audit log CSV · full history", "/api/app/books/export?report=audit-log"],
    ["Decisions flagged for tax review", "/app/books/audit?tax=flagged"],
    ["Period close evidence", "/app/books/close"],
  ] as const;

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <Link href="/app/books" className={link}>Books</Link>
      <h1 className="mt-2 text-2xl text-charcoal">Pre-audit packet</h1>
      <p className="mt-1 text-sm text-ink/70">
        Live index for {from} through {through}. Links use Books access. Download the reports and evidence when you hand off a fixed review copy.
      </p>
      <form action="/app/books/pre-audit" className="mt-3 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm font-semibold">Review year
          <input name="year" type="number" min="1900" max={currentYear} defaultValue={year} required className="rounded-lg border border-parchment bg-white px-2 py-1" />
        </label>
        <button className="rounded-full border border-parchment bg-white px-3 py-1.5 text-sm font-semibold">Show year</button>
      </form>
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-charcoal">Reports and reconciliation</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm">
          {reports.map(([name, href]) => <li key={name}><Link href={href} className={link}>{name}</Link></li>)}
        </ol>
        <p className="mt-2 text-sm text-ink/70">
          The comparison worksheet carries the ERP debit and credit totals by account, with blank columns for the CPA’s independent totals, differences, proposed adjustments and evidence references.
        </p>
      </section>
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-charcoal">Expense evidence</h2>
        {evidence.length === 0 ? <p className="mt-2 text-sm text-ink/70">No expense claims are recorded in this range.</p> : (
          <ul className="mt-2 divide-y divide-parchment rounded-2xl border border-parchment bg-white">
            {evidence.slice(0, 500).map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-charcoal">{item.day} · {item.merchant || "Expense"} · {usd(item.amountCents)}</p>
                  {item.description && <p className="break-words text-ink/70">{item.description}</p>}
                  <p className="text-xs text-ink/70">{item.status}</p>
                </div>
                {item.receiptId ? (
                  <a href={`/api/app/expenses/${item.id}/receipt`} className={link}>{item.fileName || "Open receipt"}</a>
                ) : <span className="font-medium text-terracotta-dark">Receipt missing</span>}
                <Link href={`/app/books/audit?type=expense_claim&id=${item.id}`} className={link}>Claim history</Link>
              </li>
            ))}
          </ul>
        )}
        {evidence.length > 500 && <p className="mt-2 text-sm text-ink/70">Showing the first 500 claims. Open the <Link href="/app/books/expenses" className={link}>expenses workspace</Link> to review the remainder.</p>}
      </section>
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-charcoal">Evidence to collect separately</h2>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-ink/75">
          <li>Bank and credit-card statements, processor settlement reports, and payroll registers.</li>
          <li>Open invoices and vendor bills, service agreements, and deposit support.</li>
          <li>Asset invoices and depreciation schedules, tax filings, and prior-year closing entries as applicable.</li>
        </ul>
        <p className="mt-2 text-sm text-ink/70">Keep the CPA’s evidence references and proposed entries with the comparison. Review each proposed adjustment before posting it through the close workflow.</p>
      </section>
    </AccountShell>
  );
}
