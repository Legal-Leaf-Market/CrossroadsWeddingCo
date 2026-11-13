import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import CloseActions from "@/components/account/CloseActions";
import { getBooksWorkspace } from "@/lib/auth";
import { availableActions, LOCKED_STATUSES } from "@/lib/books/accrual";
import { listPeriods, periodBlockers } from "@/lib/books/close";
import { postLedger } from "@/lib/books/ledger";
import { listRoles, rolesFor } from "@/lib/finance-roles";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

// Month-end close (2026-11-13). Live sync until the month is approved closed,
// then a hard cutoff the database enforces. Jake prepares, Terry approves or
// vetoes, Nic breaks a tie. Every step is in the audit log.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Close the books | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const STATUS_LABEL: Record<string, string> = {
  open: "Open (live)",
  prepared: "Prepared, waiting for approval",
  vetoed: "Vetoed",
  escalated: "With the tie-breaker",
  closed: "Closed",
  reopen_requested: "Reopen requested",
  reopen_vetoed: "Reopen vetoed",
  reopen_escalated: "Reopen with the tie-breaker",
};

const ROLE_LABEL: Record<string, string> = { preparer: "Prepares (triggers)", approver: "Approves or vetoes", tiebreaker: "Breaks ties" };

function monthName(p: string) {
  return new Date(`${p.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function ClosePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  try {
    await postLedger(ws.tenant.id, { actor: ws.user.email, cause: "close page opened" });
  } catch (err) {
    console.error("[close] sync failed", err);
  }
  const { m } = await searchParams;
  const [periods, roles, seats] = await Promise.all([listPeriods(ws.tenant.id), rolesFor(ws.tenant.id, ws.user.email), listRoles(ws.tenant.id)]);
  const selected = periods.find((p) => p.periodStart === m) ?? periods.find((p) => !LOCKED_STATUSES.includes(p.status) && p.periodStart < periods[0]?.periodStart) ?? periods[0];
  const blockers = selected ? await periodBlockers(ws.tenant.id, selected.periodStart) : [];
  const actions = selected ? availableActions(selected.status, roles) : [];
  const r = selected?.row;

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <Link href="/app/books" className="text-sm font-semibold text-ink/60 hover:text-terracotta-dark">
        &larr; Books
      </Link>
      <h1 className="mt-2 text-2xl text-charcoal">Close the books</h1>
      <p className="mt-1 text-sm text-ink/60">
        Accrual basis, US GAAP. An open month follows every change live. A closed month never changes: anything that moves
        later posts as a dated correction in the current month. Signed in as {ws.user.email}
        {roles.size ? ` (${[...roles].map((x) => ROLE_LABEL[x]).join(", ")})` : " (no seat in the close)"}.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav className="space-y-1">
          {periods.map((p) => (
            <Link
              key={p.periodStart}
              href={`/app/books/close?m=${p.periodStart}`}
              className={`flex items-baseline justify-between gap-2 rounded-xl px-3 py-2 text-sm ${p.periodStart === selected?.periodStart ? "bg-white font-semibold text-charcoal ring-1 ring-parchment" : "text-ink/75 hover:bg-white"}`}
            >
              <span>{monthName(p.periodStart)}</span>
              <span className={`text-xs ${LOCKED_STATUSES.includes(p.status) ? "text-sage-dark" : p.status === "open" ? "text-ink/45" : "text-terracotta-dark"}`}>
                {LOCKED_STATUSES.includes(p.status) ? "locked" : p.status.replace(/_/g, " ")}
              </span>
            </Link>
          ))}
        </nav>

        {selected && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-parchment bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl text-charcoal">{monthName(selected.periodStart)}</h2>
                <span className="text-sm font-semibold text-charcoal">{STATUS_LABEL[selected.status] ?? selected.status}</span>
              </div>
              <p className="mt-1 text-sm text-ink/60">{selected.entries} posted entries dated in this month.</p>
              {r && (
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {r.preparedBy && (
                    <div>
                      <dt className="text-ink/55">Prepared</dt>
                      <dd className="text-charcoal">{r.preparedBy}, {r.preparedAt?.toLocaleString("en-US", { timeZone: "America/Indiana/Indianapolis" })}</dd>
                    </div>
                  )}
                  {r.decidedBy && (
                    <div>
                      <dt className="text-ink/55">Last decision</dt>
                      <dd className="text-charcoal">{r.decidedBy}{r.decisionNote ? `: ${r.decisionNote}` : ""}</dd>
                    </div>
                  )}
                  {r.reopenReason && (
                    <div className="sm:col-span-2">
                      <dt className="text-ink/55">Reopen reason</dt>
                      <dd className="text-charcoal">{r.reopenReason} ({r.reopenRequestedBy})</dd>
                    </div>
                  )}
                  {r.closedHash && (
                    <div className="sm:col-span-2">
                      <dt className="text-ink/55">Frozen totals fingerprint</dt>
                      <dd className="break-all font-mono text-xs text-charcoal">{r.closedHash}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>

            {!LOCKED_STATUSES.includes(selected.status) && (
              <div className="rounded-2xl border border-parchment bg-white p-5">
                <h3 className="font-semibold text-charcoal">Before it can close</h3>
                {blockers.length === 0 ? (
                  <p className="mt-1 text-sm text-sage-dark">Nothing in the way.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {blockers.map((b) => (
                      <li key={b.key} className="flex justify-between gap-3">
                        <span className={b.hard ? "text-terracotta-dark" : "text-ink/80"}>
                          {b.hard ? "Must fix: " : "Acknowledge: "}
                          {b.label}
                        </span>
                        <span className="tabular-nums text-ink/60">{b.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-parchment bg-white p-5">
              <h3 className="mb-2 font-semibold text-charcoal">Your move</h3>
              <CloseActions period={selected.periodStart} actions={actions} soft={blockers.filter((b) => !b.hard)} />
            </div>

            <div className="rounded-2xl border border-parchment bg-white p-5 text-sm">
              <h3 className="font-semibold text-charcoal">Seats in the close</h3>
              <ul className="mt-1 space-y-0.5 text-ink/75">
                {seats.map((s) => (
                  <li key={s.id}>
                    {s.name || s.email} ({s.email}): {ROLE_LABEL[s.role] ?? s.role}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink/55">
                Whoever triggers a step can never approve it. <Link href={`/app/books/audit?type=period&id=${selected.periodStart}`} className="underline">This month&apos;s history</Link>
              </p>
            </div>
          </section>
        )}
      </div>
    </AccountShell>
  );
}
