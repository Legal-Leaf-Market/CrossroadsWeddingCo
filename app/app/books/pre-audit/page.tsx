import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listPreAuditPackets } from "@/lib/books/pre-audit-packets";
import AccountShell from "@/components/account/AccountShell";
import { getBooksWorkspace } from "@/lib/auth";
import { externalEvidence, preAuditEvidence, preAuditRange, preAuditReports } from "@/lib/books/pre-audit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pre-audit packet", robots: { index: false, follow: false } };

const link = "font-semibold text-terracotta-dark underline underline-offset-2";
const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default async function PreAuditPage({ searchParams }: { searchParams: Promise<{ year?: string | string[]; saved?: string; packet?: string; before?: string }> }) {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  const { year: raw, saved, packet, before } = await searchParams;
  const range = preAuditRange(raw);
  const { currentYear, year, from, through } = range;
  const cursor = typeof before === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(before) ? before : undefined;
  const [evidence, archives] = await Promise.all([
    preAuditEvidence(ws.tenant.id, range, 501),
    listPreAuditPackets(ws.tenant.id, year, cursor),
  ]);
  const reports = preAuditReports(range);

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <Link href="/app/books" className={link}>Books</Link>
      <h1 className="mt-2 text-2xl text-charcoal">Pre-audit packet</h1>
      <p className="mt-1 text-sm text-ink/70">
        Live index for {from} through {through}. Links use Books access. Use a saved packet when the reviewer needs a fixed copy.
      </p>
      <a href={`/api/app/books/pre-audit?year=${year}`} className={`mt-3 inline-block text-sm ${link}`}>Download evidence index CSV</a>
      <form action="/app/books/pre-audit" className="mt-3 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm font-semibold">Review year
          <input name="year" type="number" min="1900" max={currentYear} defaultValue={year} required className="rounded-lg border border-parchment bg-white px-2 py-1" />
        </label>
        <button className="rounded-full border border-parchment bg-white px-3 py-1.5 text-sm font-semibold">Show year</button>
      </form>
      <section id="saved-packets" className="mt-6 scroll-mt-20">
        <h2 className="text-lg font-semibold text-charcoal">Saved review packets</h2>
        <p className="mt-1 text-sm text-ink/70">
          Save the posted ledger, trial balance, comparison worksheet and evidence index as a fixed ZIP. Each packet has its own ID and checksum.
        </p>
        <form action="/api/app/books/pre-audit/packets" method="post" className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <input type="hidden" name="year" value={year} />
          <label className="flex items-center gap-2"><input type="checkbox" name="includeReceipts" defaultChecked /> Include attached receipts</label>
          <button className="rounded-full bg-terracotta px-4 py-2 font-semibold text-white">Save new packet</button>
        </form>
        {packet === "too-large" && <p role="alert" className="mt-2 text-sm font-medium text-terracotta-dark">The packet exceeded the size limit. Try without receipts or use the individual report and index downloads.</p>}
        {archives.some((item) => item.id === saved) && <p role="status" className="mt-2 text-sm font-semibold">Packet saved. Download it below.</p>}
        {archives.length === 0 ? <p className="mt-3 text-sm text-ink/70">No saved packets on this page.</p> : (
          <ol className="mt-3 divide-y divide-parchment rounded-2xl border border-parchment bg-white px-4">
            {archives.slice(0, 25).map((item) => (
              <li key={item.id} className="py-3 text-sm">
                <p className="font-semibold text-charcoal">
                  {new Date(item.createdAt).toLocaleString("en-US", { timeZone: "America/Indiana/Indianapolis", dateStyle: "medium", timeStyle: "short" })} · through {item.through}
                </p>
                <p className="mt-1 break-all text-xs text-ink/70">ID {item.id} · SHA-256 {item.sha256}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <a className={link} href={`/api/app/books/pre-audit/packets/${item.id}`}>Download ZIP</a>
                  <Link className={link} href={`/app/books/audit?type=pre_audit_packet&id=${item.id}`}>Creation record</Link>
                </div>
              </li>
            ))}
          </ol>
        )}
        <nav aria-label="Saved packet pages" className="mt-2 flex gap-4 text-sm">
          {cursor && <Link className={link} href={`/app/books/pre-audit?year=${year}#saved-packets`}>Newest packets</Link>}
          {archives.length > 25 && <Link className={link} href={`/app/books/pre-audit?year=${year}&before=${archives[24].id}#saved-packets`}>Older packets</Link>}
        </nav>
      </section>
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-charcoal">Reports and reconciliation</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm">
          {reports.map(([name, href]) => (
            <li key={name}>
              {href.startsWith("/api/") ? <a href={href} className={link}>{name}</a> : <Link href={href} className={link}>{name}</Link>}
            </li>
          ))}
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
          {externalEvidence.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <p className="mt-2 text-sm text-ink/70">Keep the CPA’s evidence references and proposed entries with the comparison. Review each proposed adjustment and obtain approval before it is posted.</p>
      </section>
    </AccountShell>
  );
}
