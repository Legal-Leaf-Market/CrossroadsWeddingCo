import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { getBooksWorkspace } from "@/lib/auth";
import { ledgerToday, postBankLedgerQuietly } from "@/lib/books/ledger";
import { accountRegister } from "@/lib/books/subledger";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

// An account's register (2026-11-13, docs/handoff task 3): every posted line
// between two dates with a running balance in the account's own direction.
// A control account also shows its subledger, and ?sub= narrows the register
// to one job or person. Each line opens its journal entry.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Account register | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const SOURCE_LABEL: Record<string, string> = {
  bank_transaction: "Bank line",
  job_revenue: "Job revenue",
  job_cost: "Job cost",
  expense_claim: "Expense report",
  opening_balance: "Opening balance",
  hand_deposit: "Deposit paid by hand",
  hand_balance: "Balance paid by hand",
};

function ranges(today: string) {
  const y = Number(today.slice(0, 4));
  return [
    { label: "This month", from: `${today.slice(0, 7)}-01`, to: today },
    { label: "This year", from: `${y}-01-01`, to: today },
    { label: "Last year", from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    { label: "All time", from: "", to: today },
  ];
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; sub?: string }>;
}) {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  const { id } = await params;
  const q = await searchParams;
  const today = ledgerToday();
  await postBankLedgerQuietly(ws.tenant.id, { actor: ws.user.email, cause: "register opened" });
  const view = await accountRegister(ws.tenant.id, id, { from: q.from ?? null, to: q.to ?? today, sub: q.sub ?? null });
  if (!view) notFound();
  const { account: a } = view;
  const qs = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur = { from: view.from ?? "", to: view.to ?? "", sub: view.sub ?? "", ...over };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    const s = p.toString();
    return `/app/books/accounts/${a.id}${s ? `?${s}` : ""}`;
  };
  const closing = view.lines.length ? view.lines[view.lines.length - 1].balance : view.broughtForward;
  const subLabel = view.sub === "none" ? "Lines with no subledger key" : view.sub ? view.labels.get(view.sub) ?? view.sub : null;

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <div className="flex flex-wrap gap-x-4 text-sm font-semibold">
        <Link href="/app/books" className="text-ink/60 hover:text-terracotta-dark">
          &larr; Books
        </Link>
        <Link href="/app/books/accounts" className="text-ink/60 hover:text-terracotta-dark">
          Trial balance
        </Link>
        {view.parties && (
          <Link href="/app/books/tie-out" className="text-ink/60 hover:text-terracotta-dark">
            Tie-out
          </Link>
        )}
      </div>
      <h1 className="mt-2 break-words text-2xl text-charcoal">
        <span className="mr-2 text-base text-ink/45">{a.code}</span>
        {a.name}
      </h1>
      <p className="mt-1 text-sm text-ink/60">
        {a.type[0].toUpperCase() + a.type.slice(1)} account. Balances run in its natural direction ({a.type === "asset" || a.type === "expense" ? "debits add" : "credits add"}).
        {subLabel && (
          <>
            {" "}
            Showing <span className="font-semibold text-charcoal">{subLabel}</span> only.{" "}
            <Link href={qs({ sub: null })} className="text-terracotta underline">
              Show every line
            </Link>
          </>
        )}
      </p>

      <nav className="mt-3 flex flex-wrap gap-2" aria-label="Dates">
        {ranges(today).map((r) => {
          const on = (view.from ?? "") === r.from && (view.to ?? "") === r.to;
          return (
            <Link
              key={r.label}
              href={qs({ from: r.from || null, to: r.to })}
              aria-current={on ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${on ? "bg-charcoal text-cream" : "border border-parchment text-ink/70 hover:border-terracotta"}`}
            >
              {r.label}
            </Link>
          );
        })}
      </nav>

      {view.parties && !view.sub && (
        <section className="mt-5 rounded-2xl border border-parchment bg-white p-5">
          <h2 className="text-lg text-charcoal">Subledger as of {view.to ?? today}</h2>
          {view.parties.length === 0 ? (
            <p className="mt-1 text-sm text-ink/60">Nothing open.</p>
          ) : (
            <ul className="mt-2 divide-y divide-parchment text-sm">
              {view.parties.map((p) => (
                <li key={p.sub} className="flex flex-wrap justify-between gap-x-4 py-1.5 tabular-nums">
                  <Link href={qs({ sub: p.sub, from: null })} className={`min-w-0 break-words underline decoration-parchment underline-offset-2 hover:text-terracotta ${p.sub === "none" ? "font-semibold text-terracotta-dark" : "text-charcoal"}`}>
                    {p.label}
                  </Link>
                  <span>{usd(p.balance)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-parchment bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-parchment text-xs text-ink/55">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Entry</th>
              <th className="px-3 py-2 text-right font-medium">Debit</th>
              <th className="px-3 py-2 text-right font-medium">Credit</th>
              <th className="px-3 py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-parchment/60 tabular-nums text-ink/60">
              <td className="px-3 py-1.5">{view.from ?? ""}</td>
              <td className="px-3 py-1.5">Brought forward</td>
              <td />
              <td />
              <td className="px-3 py-1.5 text-right">{usd(view.broughtForward)}</td>
            </tr>
            {view.lines.map((l, i) => (
              <tr key={`${l.entryId}-${i}`} className="border-b border-parchment/60 align-top tabular-nums">
                <td className="whitespace-nowrap px-3 py-1.5 text-ink/70">{l.date}</td>
                <td className="px-3 py-1.5">
                  <Link href={`/app/books/entries/${l.entryId}`} className="break-words text-charcoal underline decoration-parchment underline-offset-2 hover:text-terracotta">
                    {l.memo || "Journal entry"}
                  </Link>
                  <span className="block text-xs text-ink/50">
                    {l.sourceRef ? SOURCE_LABEL[l.sourceRef.slice(0, l.sourceRef.indexOf(":"))] ?? "Entry" : "Entry"}
                    {l.sub && !view.sub ? ` · ${view.labels.get(l.sub) ?? l.sub}` : ""}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right">{l.debit ? usd(l.debit) : ""}</td>
                <td className="px-3 py-1.5 text-right">{l.credit ? usd(l.credit) : ""}</td>
                <td className="px-3 py-1.5 text-right font-semibold text-charcoal">{usd(l.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold tabular-nums text-charcoal">
              <td className="px-3 py-2">{view.to ?? today}</td>
              <td className="px-3 py-2">Closing balance</td>
              <td />
              <td />
              <td className="px-3 py-2 text-right">{view.truncated ? "Pick a shorter range" : usd(closing)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {view.truncated && <p className="mt-2 text-xs text-terracotta-dark">Showing the first 2,000 lines. Pick a shorter date range to see the rest.</p>}
    </AccountShell>
  );
}
