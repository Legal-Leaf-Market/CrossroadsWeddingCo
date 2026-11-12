import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { getBooksWorkspace } from "@/lib/auth";
import { moneyHome, type MoneyHome } from "@/lib/money";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Money | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const THIS_YEAR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Indiana/Indianapolis" }).slice(0, 4);
// The year shows only when it isn't this year, so "last Nov 20, 2025" and
// "next about Nov 20" can't be mistaken for the same day.
const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(iso.slice(0, 4) !== THIS_YEAR ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "warn" }) {
  return (
    <div className="rounded-2xl border border-parchment bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink/55">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-terracotta-dark" : "text-charcoal"}`}>{value}</p>
      <p className="mt-1 text-sm text-ink/60">{sub}</p>
    </div>
  );
}

export default async function MoneyPage() {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  let m: MoneyHome | null = null;
  try {
    m = await moneyHome(ws.tenant.id);
  } catch (err) {
    console.error("[money] load failed:", err);
  }

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <h1 className="text-3xl text-charcoal">Money</h1>
      <p className="mt-2 text-ink/70">Where your money is, what&apos;s owed to you, and what&apos;s coming in the next 30 days.</p>

      {!m ? (
        <p className="mt-8 rounded-2xl border border-parchment bg-white p-6 text-ink/70">This didn&apos;t load just now. Refresh in a minute.</p>
      ) : (
        <>
          {(m.toSort > 0 || m.needsLogin > 0 || m.pastDue.length > 0) && (
            <section className="mt-8 rounded-2xl border-2 border-terracotta bg-white p-5">
              <h2 className="text-lg font-semibold text-charcoal">Needs you</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {m.needsLogin > 0 && (
                  <li>
                    <Link href="/app/integrations" className="font-semibold text-terracotta-dark underline underline-offset-2">
                      {m.needsLogin === 1 ? "A bank wants you to log in again" : `${m.needsLogin} banks want you to log in again`}
                    </Link>{" "}
                    <span className="text-ink/60">or its transactions stop coming in.</span>
                  </li>
                )}
                {m.toSort > 0 && (
                  <li>
                    <Link href="/app/transactions" className="font-semibold text-terracotta-dark underline underline-offset-2">
                      {m.toSort} bank {m.toSort === 1 ? "line" : "lines"} to sort
                    </Link>{" "}
                    <span className="text-ink/60">before they count in your books.</span>
                  </li>
                )}
                {m.pastDue.map((p) => (
                  <li key={p.id}>
                    <span className="font-semibold text-charcoal">{p.name}</span>{" "}
                    <span className="text-ink/60">
                      still owes {usd(p.cents)} for {day(p.eventDate)}.
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {m.hasBank ? (
              <>
                <Tile
                  label="Cash in the bank"
                  value={usd(m.cashCents)}
                  sub={`${m.cashAccounts} ${m.cashAccounts === 1 ? "account" : "accounts"}${m.lastSyncedAt ? `, as of ${new Date(m.lastSyncedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Indiana/Indianapolis" })}` : ""}`}
                />
                <Tile label="Owed on cards" value={usd(m.cardOwedCents)} sub={`${m.cardAccounts} ${m.cardAccounts === 1 ? "card" : "cards"}`} />
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-parchment bg-white/60 p-5 sm:col-span-2">
                <p className="font-semibold text-charcoal">Connect your bank to see your cash here.</p>
                <Link href="/app/integrations" className="mt-2 inline-block text-sm font-semibold text-terracotta-dark underline underline-offset-2">
                  Connect a bank or card
                </Link>
              </div>
            )}
            <Tile
              label="Owed to you"
              value={usd(m.owedCents)}
              sub={`${m.owedBookings} ${m.owedBookings === 1 ? "booking" : "bookings"}${m.pastDue.length ? `, ${m.pastDue.length} past the event` : ""}`}
              tone={m.pastDue.length ? "warn" : undefined}
            />
            <Tile
              label="Collected for future events"
              value={usd(m.heldCents)}
              sub={`${m.heldBookings} ${m.heldBookings === 1 ? "event" : "events"} still to come`}
            />
          </section>
          {m.heldCents > 0 && (
            <p className="mt-3 text-sm text-ink/60">
              Money collected for events that haven&apos;t happened yet may have to go back if one cancels, depending on your
              contract. Ask your accountant how much of it to treat as spendable.
            </p>
          )}

          <section className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-parchment bg-white p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold text-charcoal">Coming in, next 30 days</h2>
                <span className="font-semibold tabular-nums text-charcoal">{usd(m.in30Cents)}</span>
              </div>
              {m.in30.length === 0 ? (
                <p className="mt-3 text-sm text-ink/60">No balances due from events in the next 30 days.</p>
              ) : (
                <ul className="mt-3 divide-y divide-parchment text-sm">
                  {m.in30.map((x) => (
                    <li key={x.id} className="flex justify-between gap-3 py-2">
                      <span className="min-w-0 break-words text-charcoal">
                        {x.name} <span className="text-ink/55">· {day(x.eventDate)}</span>
                      </span>
                      <span className="tabular-nums">{usd(x.cents)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-ink/50">Balances still owed on events in the window.</p>
            </div>
            <div className="rounded-2xl border border-parchment bg-white p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold text-charcoal">Going out, next 30 days</h2>
                <span className="font-semibold tabular-nums text-charcoal">{usd(m.out30Cents)}</span>
              </div>
              {m.out30.length === 0 ? (
                <p className="mt-3 text-sm text-ink/60">No repeat charges expected. One-off bills aren&apos;t predicted.</p>
              ) : (
                <ul className="mt-3 divide-y divide-parchment text-sm">
                  {m.out30.map((x, i) => (
                    <li key={i} className="flex justify-between gap-3 py-2">
                      <span className="min-w-0 break-words text-charcoal">
                        {x.name} <span className="text-ink/55">· {day(x.date)}</span>
                      </span>
                      <span className="tabular-nums">{usd(x.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-ink/50">Repeat charges seen on your accounts, expected on their usual day.</p>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-parchment bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold text-charcoal">Subscriptions and repeat charges</h2>
              <span className="text-sm text-ink/60">
                about <strong className="tabular-nums text-charcoal">{usd(m.recurringMonthlyCents)}</strong> a month
              </span>
            </div>
            {m.recurring.length === 0 ? (
              <p className="mt-3 text-sm text-ink/60">
                {m.hasBank
                  ? "None found yet. A charge shows here after three on a steady schedule (two for yearly)."
                  : "Connect a bank or card and repeat charges show up here by themselves."}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-parchment text-sm">
                {m.recurring.map((r) => (
                  <li key={r.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                    <span className="min-w-0 break-words">
                      <span className="font-semibold text-charcoal">{r.name}</span>
                      {r.isNew && <span className="ml-2 rounded-full bg-terracotta/15 px-2 py-0.5 text-xs font-semibold text-terracotta-dark">New</span>}
                      <span className="block text-xs text-ink/55">
                        {r.cadence}, last {day(r.lastDate)}, next about {day(r.nextDate)}
                      </span>
                    </span>
                    <span className="tabular-nums text-charcoal">{usd(r.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AccountShell>
  );
}
