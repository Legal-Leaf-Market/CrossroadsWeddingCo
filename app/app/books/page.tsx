import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import OpeningBalanceForm from "@/components/account/OpeningBalanceForm";
import { getBooksWorkspace } from "@/lib/auth";
import { balances, postBankLedger, profitAndLoss, reconciliation } from "@/lib/books/ledger";
import { ensureDefaultCategories } from "@/lib/books/review";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Books | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Today's calendar date for US bank lines. Bank dates are calendar dates, so "this month" must be too. */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Indiana/Indianapolis" }).format(new Date());
}

const PERIODS = {
  month: "This month",
  "last-month": "Last month",
  ytd: "This year",
  "last-year": "Last year",
} as const;
type PeriodKey = keyof typeof PERIODS;

function periodRange(key: PeriodKey, t: string): { from: string; to: string } {
  const [y, m] = t.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  if (key === "month") return { from: `${y}-${pad(m)}-01`, to: t };
  if (key === "last-month") {
    const yy = m === 1 ? y - 1 : y;
    const mm = m === 1 ? 12 : m - 1;
    return { from: `${yy}-${pad(mm)}-01`, to: `${yy}-${pad(mm)}-${pad(lastDay(yy, mm))}` };
  }
  if (key === "last-year") return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  return { from: `${y}-01-01`, to: t };
}

function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function Row({ label, amount, strong = false, code }: { label: string; amount: number; strong?: boolean; code?: string }) {
  return (
    <li className={`flex flex-wrap items-baseline justify-between gap-x-4 py-1.5 ${strong ? "font-semibold text-charcoal" : "text-ink/80"}`}>
      <span className="min-w-0 break-words">
        {code && <span className="mr-2 tabular-nums text-xs text-ink/45">{code}</span>}
        {label}
      </span>
      <span className="tabular-nums">{usd(amount)}</span>
    </li>
  );
}

export default async function BooksPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  const { period: raw } = await searchParams;
  const period: PeriodKey = raw && raw in PERIODS ? (raw as PeriodKey) : "ytd";
  const t = today();
  const range = periodRange(period, t);

  let data: {
    pl: Awaited<ReturnType<typeof profitAndLoss>>;
    bal: Awaited<ReturnType<typeof balances>>;
    rec: Awaited<ReturnType<typeof reconciliation>>;
  } | null = null;
  try {
    await ensureDefaultCategories(ws.tenant.id);
    // Posting is derived and idempotent; running it here heals anything a failed post left behind.
    await postBankLedger(ws.tenant.id);
    const [pl, bal, rec] = await Promise.all([
      profitAndLoss(ws.tenant.id, range.from, range.to),
      balances(ws.tenant.id),
      reconciliation(ws.tenant.id),
    ]);
    data = { pl, bal, rec };
  } catch (err) {
    console.error("[ledger] books page failed:", err instanceof Error ? err.message : err);
  }

  const clearing = data?.bal.assets.find((a) => a.systemKey === "transfers_clearing");

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold text-charcoal">Accrual basis, US GAAP</span>
        <Link href="/app/books/close" className="font-semibold text-terracotta underline decoration-parchment underline-offset-2">Close the books</Link>
        <Link href="/app/books/audit" className="font-semibold text-terracotta underline decoration-parchment underline-offset-2">Audit log</Link>
      </p>
      {ws.tenant.kind !== "house" && (
        <Link href="/app" className="text-sm font-semibold text-ink/60 hover:text-terracotta-dark">
          &larr; Workspace
        </Link>
      )}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl text-charcoal">Books</h1>
          <p className="mt-2 max-w-xl text-ink/70">
            Built from the transactions you sort, on a cash basis: money counts when it moves. A starting point for your
            accountant, not tax advice.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/app/transactions" className="text-ink/70 hover:text-terracotta-dark">
            Sort transactions
          </Link>
          <a href="/api/app/books/ledger" className="text-ink/70 hover:text-terracotta-dark">
            Download general ledger
          </a>
        </div>
      </div>

      {!data ? (
        <p className="mt-8 text-sm text-ink/70">We couldn&apos;t load your books just now. Refresh in a minute.</p>
      ) : (
        <>
          <section className="mt-8 rounded-2xl border border-parchment bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl text-charcoal">Profit and loss</h2>
              <nav className="flex flex-wrap gap-2" aria-label="Period">
                {(Object.keys(PERIODS) as PeriodKey[]).map((k) => (
                  <Link
                    key={k}
                    href={k === "ytd" ? "/app/books" : `/app/books?period=${k}`}
                    aria-current={k === period ? "page" : undefined}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      k === period ? "bg-charcoal text-cream" : "border border-parchment text-ink/70 hover:border-terracotta"
                    }`}
                  >
                    {PERIODS[k]}
                  </Link>
                ))}
              </nav>
            </div>
            <p className="mt-1 text-xs text-ink/55">
              {range.from} to {range.to}
            </p>
            {data.pl.income.length === 0 && data.pl.expense.length === 0 ? (
              <p className="mt-4 text-sm text-ink/65">
                Nothing in this period yet. Sorted transactions show up here as soon as they post.
              </p>
            ) : (
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/55">Income</h3>
                  <ul className="mt-1 divide-y divide-parchment text-sm">
                    {data.pl.income.map((a) => (
                      <Row key={a.id} label={a.name} code={a.code} amount={a.amount} />
                    ))}
                    <Row label="Total income" amount={data.pl.totalIncome} strong />
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/55">Expenses</h3>
                  <ul className="mt-1 divide-y divide-parchment text-sm">
                    {data.pl.expense.map((a) => (
                      <Row key={a.id} label={a.name} code={a.code} amount={a.amount} />
                    ))}
                    <Row label="Total expenses" amount={data.pl.totalExpense} strong />
                  </ul>
                </div>
              </div>
            )}
            <p className={`mt-4 border-t border-parchment pt-3 text-lg font-semibold ${data.pl.net >= 0 ? "text-emerald-800" : "text-terracotta-dark"}`}>
              {data.pl.net >= 0 ? "Profit" : "Loss"}: {usd(Math.abs(data.pl.net))}
            </p>
          </section>

          <section className="mt-6 rounded-2xl border border-parchment bg-white p-6">
            <h2 className="text-xl text-charcoal">Do your books match the bank?</h2>
            {data.rec.length === 0 ? (
              <p className="mt-3 text-sm text-ink/65">
                <Link href="/app/integrations" className="font-semibold text-terracotta-dark hover:underline">
                  Connect a bank or card
                </Link>{" "}
                to start.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-parchment">
                {data.rec.map((r) => {
                  const off = r.difference !== null && r.difference !== 0;
                  return (
                    <li key={r.id} className="py-4 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="font-semibold text-charcoal">
                          {r.name}
                          {r.mask ? ` ····${r.mask}` : ""}
                          {r.isLiability && <span className="ml-2 text-xs font-normal text-ink/55">amount owed</span>}
                        </span>
                        <span className={`font-semibold ${off ? "text-terracotta-dark" : "text-emerald-800"}`}>
                          {r.difference === null ? "Bank balance unknown" : off ? `Off by ${usd(Math.abs(r.difference))}` : "Matches"}
                        </span>
                      </div>
                      <p className="mt-1 text-ink/65">
                        Books {usd(r.books)}
                        {r.bank !== null ? ` · Bank ${usd(r.bank)}` : ""}
                        {r.openingDate ? ` · Opening balance on ${r.openingDate}` : ""}
                      </p>
                      {off && (
                        <ul className="mt-1 list-disc pl-5 text-xs text-ink/60">
                          {!r.openingDate && <li>No opening balance yet. Set it from a statement.</li>}
                          {r.unreviewed > 0 && (
                            <li>
                              {r.unreviewed} {r.unreviewed === 1 ? "line is" : "lines are"} still waiting to be{" "}
                              <Link href="/app/transactions" className="font-semibold text-terracotta-dark hover:underline">
                                sorted
                              </Link>
                              .
                            </li>
                          )}
                          {r.pending > 0 && <li>{r.pending} pending, which post once the bank clears them.</li>}
                          {r.excluded > 0 && (
                            <li>
                              {r.excluded} set aside as Not business. Personal spending from a business account is an Owner draw, not
                              Not business.
                            </li>
                          )}
                        </ul>
                      )}
                      <div className="mt-2">
                        <OpeningBalanceForm
                          bankAccountId={r.id}
                          defaultDate={r.openingDate ?? (r.earliest ? dayBefore(r.earliest) : t)}
                          isLiability={r.isLiability}
                          hasOpening={!!r.openingDate}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {clearing && clearing.amount !== 0 && (
              <p className="mt-3 rounded-xl bg-cream/70 p-3 text-xs text-ink/70">
                {usd(Math.abs(clearing.amount))} sits in Transfers in transit. That is a transfer or card payment with only one side
                on a connected account. Connect the other account, or sort that line as an owner draw or contribution instead.
              </p>
            )}
          </section>

          <section className="mt-6 rounded-2xl border border-parchment bg-white p-6">
            <h2 className="text-xl text-charcoal">Balances today</h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/55">What you have</h3>
                <ul className="mt-1 divide-y divide-parchment text-sm">
                  {data.bal.assets.map((a) => (
                    <Row key={a.id} label={a.name} code={a.code} amount={a.amount} />
                  ))}
                  <Row label="Total" amount={data.bal.totalAssets} strong />
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/55">What you owe, and what is yours</h3>
                <ul className="mt-1 divide-y divide-parchment text-sm">
                  {data.bal.liabilities.map((a) => (
                    <Row key={a.id} label={a.name} code={a.code} amount={a.amount} />
                  ))}
                  {data.bal.equity.map((a) => (
                    <Row key={a.id} label={a.name} code={a.code} amount={a.amount} />
                  ))}
                  <Row label="Earnings to date" amount={data.bal.earnings} />
                  <Row label="Total" amount={data.bal.totalLiabilities + data.bal.totalEquity} strong />
                </ul>
              </div>
            </div>
          </section>
        </>
      )}
    </AccountShell>
  );
}
