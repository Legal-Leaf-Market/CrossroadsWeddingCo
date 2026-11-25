import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { getBooksWorkspace } from "@/lib/auth";
import { ledgerToday, postBankLedgerQuietly } from "@/lib/books/ledger";
import { tieOutReport } from "@/lib/books/subledger";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

// The control-account tie-out (2026-11-13, docs/handoff task 3): each control
// account's general ledger balance against the sum of its subledger. Any
// difference is a hard close blocker (periodBlockers in lib/books/close.ts).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Tie-out | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const BY_LABEL = { job: "by job", crew: "by person" } as const;

export default async function TieOutPage({ searchParams }: { searchParams: Promise<{ asof?: string }> }) {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  const { asof: raw } = await searchParams;
  const today = ledgerToday();
  const asOf = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
  await postBankLedgerQuietly(ws.tenant.id, { actor: ws.user.email, cause: "tie-out opened" });
  const { rows, labels } = await tieOutReport(ws.tenant.id, asOf);
  const off = rows.filter((r) => r.difference !== 0);

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <Link href="/app/books" className="text-sm font-semibold text-ink/60 hover:text-terracotta-dark">
        &larr; Books
      </Link>
      <h1 className="mt-2 text-2xl text-charcoal">Control accounts against their subledgers</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/60">
        Every line on a control account says whose it is: which job for receivables, prepaid costs, deferred revenue and accrued
        costs; which person for reimbursements. Each account&apos;s balance must equal the sum of those. A difference means money
        on the books that nobody can be named for, and the month can&apos;t close until it is fixed.
      </p>
      <form className="mt-3 flex flex-wrap items-end gap-2 text-sm" action="/app/books/tie-out">
        <label className="flex flex-col text-xs text-ink/60">
          As of
          <input type="date" name="asof" defaultValue={asOf} max={today} className="mt-1 rounded-lg border border-parchment bg-white px-2 py-1 text-sm text-charcoal" />
        </label>
        <button className="rounded-full border border-parchment bg-white px-3 py-1 text-xs font-semibold text-ink/75 hover:border-terracotta">Show</button>
      </form>

      <p className={`mt-4 rounded-xl border bg-white p-3 text-sm ${off.length ? "border-terracotta text-terracotta-dark" : "border-parchment text-sage-dark"}`}>
        {rows.length === 0
          ? "No control accounts yet. They appear once the first job, deposit or expense report posts."
          : off.length
            ? `${off.length} of ${rows.length} control account${rows.length === 1 ? "" : "s"} don't tie as of ${asOf}.`
            : `All ${rows.length} control accounts tie to their subledgers as of ${asOf}.`}
      </p>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-parchment bg-white">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead>
            <tr className="border-b border-parchment text-xs text-ink/55">
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="px-3 py-2 text-right font-medium">General ledger</th>
              <th className="px-3 py-2 text-right font-medium">Subledger</th>
              <th className="px-3 py-2 text-right font-medium">Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.accountId} className="border-b border-parchment/60 tabular-nums last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/app/books/accounts/${r.accountId}?to=${asOf}`} className="font-semibold text-charcoal underline decoration-parchment underline-offset-2 hover:text-terracotta">
                    <span className="mr-2 text-xs text-ink/45">{r.code}</span>
                    {r.name}
                  </Link>
                  <span className="block text-xs text-ink/55">
                    Subledger {BY_LABEL[r.by]}, {r.parties.length} with a balance
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{usd(r.control)}</td>
                <td className="px-3 py-2 text-right">{usd(r.subledger)}</td>
                <td className={`px-3 py-2 text-right font-semibold ${r.difference ? "text-terracotta-dark" : "text-sage-dark"}`}>
                  {r.difference ? (
                    <Link href={`/app/books/accounts/${r.accountId}?sub=none&to=${asOf}`} className="underline">
                      {usd(r.difference)}
                    </Link>
                  ) : (
                    "Ties"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.map((r) =>
        r.parties.length === 0 ? null : (
          <section key={r.accountId} className="mt-6 rounded-2xl border border-parchment bg-white p-5">
            <h2 className="text-lg text-charcoal">
              <span className="mr-2 text-xs text-ink/45">{r.code}</span>
              {r.name}, {BY_LABEL[r.by]}
            </h2>
            <ul className="mt-2 divide-y divide-parchment text-sm">
              {r.parties.map((p) => (
                <li key={p.sub} className="flex flex-wrap justify-between gap-x-4 py-1.5 tabular-nums">
                  <Link href={`/app/books/accounts/${r.accountId}?sub=${encodeURIComponent(p.sub)}&to=${asOf}`} className="min-w-0 break-words text-charcoal underline decoration-parchment underline-offset-2 hover:text-terracotta">
                    {labels.get(p.sub) ?? p.sub}
                  </Link>
                  <span>{usd(p.balance)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-x-4 py-1.5 font-semibold tabular-nums text-charcoal">
                <span>Subledger total</span>
                <span>{usd(r.subledger)}</span>
              </li>
            </ul>
          </section>
        ),
      )}
    </AccountShell>
  );
}
