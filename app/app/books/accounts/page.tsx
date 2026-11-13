import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { getBooksWorkspace } from "@/lib/auth";
import { ledgerToday, postBankLedgerQuietly } from "@/lib/books/ledger";
import { trialBalance } from "@/lib/books/subledger";
import { isControlKey } from "@/lib/books/subledger-logic";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

// The trial balance: every account with activity, as of a date. Each account
// opens its register (2026-11-13, docs/handoff task 3).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Accounts | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"];
const TYPE_LABEL: Record<string, string> = { asset: "Assets", liability: "Liabilities", equity: "Equity", income: "Income", expense: "Expenses" };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ asof?: string }> }) {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  const { asof: raw } = await searchParams;
  const today = ledgerToday();
  const asOf = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
  await postBankLedgerQuietly(ws.tenant.id, { actor: ws.user.email, cause: "trial balance opened" });
  const tb = await trialBalance(ws.tenant.id, asOf);
  const debits = tb.reduce((s, a) => s + a.debit, 0);
  const credits = tb.reduce((s, a) => s + a.credit, 0);

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <Link href="/app/books" className="text-sm font-semibold text-ink/60 hover:text-terracotta-dark">
        &larr; Books
      </Link>
      <h1 className="mt-2 text-2xl text-charcoal">Trial balance</h1>
      <p className="mt-1 text-sm text-ink/60">
        Every account with posted activity through {asOf}. Open one for its register, line by line with a running balance.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
        <form className="flex items-end gap-2" action="/app/books/accounts">
          <label className="flex flex-col text-xs text-ink/60">
            As of
            <input type="date" name="asof" defaultValue={asOf} max={today} className="mt-1 rounded-lg border border-parchment bg-white px-2 py-1 text-sm text-charcoal" />
          </label>
          <button className="rounded-full border border-parchment bg-white px-3 py-1 text-xs font-semibold text-ink/75 hover:border-terracotta">Show</button>
        </form>
        <a href={`/api/app/books/export?report=trial-balance&asof=${asOf}`} className="font-semibold text-terracotta underline decoration-parchment underline-offset-2">
          Download CSV
        </a>
        <Link href={`/app/books/tie-out?asof=${asOf}`} className="font-semibold text-terracotta underline decoration-parchment underline-offset-2">
          Tie-out
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-parchment bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-parchment text-xs text-ink/55">
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="px-3 py-2 text-right font-medium">Debits</th>
              <th className="px-3 py-2 text-right font-medium">Credits</th>
              <th className="px-3 py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          {TYPE_ORDER.map((type) => {
            const group = tb.filter((a) => a.type === type);
            if (!group.length) return null;
            return (
              <tbody key={type}>
                <tr>
                  <td colSpan={4} className="bg-cream/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink/55">
                    {TYPE_LABEL[type]}
                  </td>
                </tr>
                {group.map((a) => (
                  <tr key={a.id} className="border-b border-parchment/60 tabular-nums">
                    <td className="px-3 py-1.5">
                      <Link href={`/app/books/accounts/${a.id}?to=${asOf}`} className="text-charcoal underline decoration-parchment underline-offset-2 hover:text-terracotta">
                        <span className="mr-2 text-xs text-ink/45">{a.code}</span>
                        {a.name}
                      </Link>
                      {isControlKey(a.systemKey) && <span className="ml-2 text-xs text-ink/50">control account</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right">{usd(a.debit)}</td>
                    <td className="px-3 py-1.5 text-right">{usd(a.credit)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-charcoal">{usd(a.balance)}</td>
                  </tr>
                ))}
              </tbody>
            );
          })}
          <tfoot>
            <tr className="font-semibold tabular-nums text-charcoal">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right">{usd(debits)}</td>
              <td className="px-3 py-2 text-right">{usd(credits)}</td>
              <td className={`px-3 py-2 text-right ${debits === credits ? "text-sage-dark" : "text-terracotta-dark"}`}>{debits === credits ? "Balanced" : `Off by ${usd(debits - credits)}`}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </AccountShell>
  );
}
