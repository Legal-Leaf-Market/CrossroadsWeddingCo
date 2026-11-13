import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { getBooksWorkspace } from "@/lib/auth";
import { entryDetail } from "@/lib/books/subledger";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

// One journal entry, all the way down (2026-11-13, docs/handoff task 3): its
// lines and their subledger keys, every version the live sync has posted for
// the same source (voids and corrections included), the source record itself,
// and the audit history of both.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Journal entry | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const when = (s: string) => new Date(s).toLocaleString("en-US", { timeZone: "America/Indiana/Indianapolis" });

function short(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = JSON.stringify(v);
  return s.length > 300 ? `${s.slice(0, 300)}...` : s;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink/55">{label}</dt>
      <dd className="break-words text-charcoal">{children}</dd>
    </div>
  );
}

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  const d = await entryDetail(ws.tenant.id, (await params).id);
  if (!d) notFound();
  const { entry: e, lines, versions, source: s, history } = d;
  const house = ws.tenant.kind === "house";
  const debits = lines.reduce((x, l) => x + l.debit, 0);
  const credits = lines.reduce((x, l) => x + l.credit, 0);
  const jobLine = s.kind === "job" ? lines.find((l) => l.sub === `job:${s.id}`) : undefined;
  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

  return (
    <AccountShell signedIn house={house}>
      <div className="flex flex-wrap gap-x-4 text-sm font-semibold">
        <Link href="/app/books" className="text-ink/60 hover:text-terracotta-dark">
          &larr; Books
        </Link>
        <Link href="/app/books/accounts" className="text-ink/60 hover:text-terracotta-dark">
          Trial balance
        </Link>
      </div>
      <h1 className="mt-2 break-words text-2xl text-charcoal">{e.memo || "Journal entry"}</h1>
      <p className="mt-1 text-sm text-ink/60">
        Dated {e.date}. {e.status === "void" ? `Voided: ${e.voidReason ?? "no reason recorded"}.` : "Posted."}
        {e.adjustsPeriod && ` A correction to ${e.adjustsPeriod.slice(0, 7)}, which was closed when this posted.`}
        {" "}Entry {e.id.slice(0, 8)}, recorded {when(e.createdAt)}.
      </p>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-parchment bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-parchment text-xs text-ink/55">
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="px-3 py-2 font-medium">Subledger</th>
              <th className="px-3 py-2 text-right font-medium">Debit</th>
              <th className="px-3 py-2 text-right font-medium">Credit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-parchment/60 tabular-nums">
                <td className="px-3 py-1.5">
                  <Link href={`/app/books/accounts/${l.accountId}?to=${e.date}`} className="text-charcoal underline decoration-parchment underline-offset-2 hover:text-terracotta">
                    <span className="mr-2 text-xs text-ink/45">{l.code}</span>
                    {l.name}
                  </Link>
                </td>
                <td className="px-3 py-1.5 text-ink/70">
                  {l.sub ? (
                    <Link href={`/app/books/accounts/${l.accountId}?sub=${encodeURIComponent(l.sub)}`} className="underline decoration-parchment underline-offset-2 hover:text-terracotta">
                      {l.subLabel}
                    </Link>
                  ) : (
                    ""
                  )}
                </td>
                <td className="px-3 py-1.5 text-right">{l.debit ? usd(l.debit) : ""}</td>
                <td className="px-3 py-1.5 text-right">{l.credit ? usd(l.credit) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold tabular-nums text-charcoal">
              <td className="px-3 py-2" colSpan={2}>
                {debits === credits ? "Balanced" : "Does not balance"}
              </td>
              <td className="px-3 py-2 text-right">{usd(debits)}</td>
              <td className="px-3 py-2 text-right">{usd(credits)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <section className="mt-6 rounded-2xl border border-parchment bg-white p-5">
        <h2 className="text-lg text-charcoal">Where it came from</h2>
        {s.kind === "bank_transaction" && s.row && (
          <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label="Bank line">{str(s.row.merchant) || str(s.row.description)}</Field>
            <Field label="Amount">{usd(Number(s.row.amountCents))} {Number(s.row.amountCents) > 0 ? "in" : "out"}</Field>
            <Field label="Posted">{str(s.row.postedDate)}</Field>
            <Field label="Account">
              {str(s.row.bankName)}
              {s.row.mask ? ` ····${str(s.row.mask)}` : ""}
            </Field>
            <Field label="Sorted as">{str(s.row.categoryName) || str(s.row.reviewStatus)}</Field>
            {s.row.bookingName ? (
              <Field label="Matched to">
                {house ? (
                  str(s.row.bookingName)
                ) : (
                  <Link href={`/app/bookings/${str(s.row.bookingId)}`} className="text-terracotta underline">
                    {str(s.row.bookingName)}
                  </Link>
                )}{" "}
                ({str(s.row.paymentKind) || "job cost"}, event {str(s.row.eventDate)})
              </Field>
            ) : null}
            {s.row.removedAt ? <Field label="Withdrawn by the bank">{str(s.row.removedAt)}</Field> : null}
            <div className="sm:col-span-2">
              <Link href="/app/transactions" className="text-sm font-semibold text-terracotta underline">
                Open transactions
              </Link>
            </div>
          </dl>
        )}
        {s.kind === "job" && s.row && (
          <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label={s.which === "revenue" ? "Revenue recognized for" : "Direct cost matched to"}>
              {house ? (
                str(s.row.names)
              ) : (
                <Link href={`/app/bookings/${s.id}`} className="text-terracotta underline">
                  {str(s.row.names)}
                </Link>
              )}
            </Field>
            <Field label="Event date">{str(s.row.eventDate)}</Field>
            <Field label="Contract total">{usd(Math.round(Number(s.row.total) * 100) || 0)}</Field>
            <Field label="Status">{str(s.row.status)}{s.row.archivedAt ? ", archived" : ""}</Field>
            <div className="sm:col-span-2">
              {jobLine && (
                <Link href={`/app/books/accounts/${jobLine.accountId}?sub=${encodeURIComponent(jobLine.sub!)}`} className="text-sm font-semibold text-terracotta underline">
                  This job in the subledger
                </Link>
              )}
            </div>
          </dl>
        )}
        {s.kind === "expense_claim" && s.row && (
          <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label="Expense report">{str(s.row.claimant)}: {str(s.row.merchant)}</Field>
            <Field label="Amount">{usd(Number(s.row.amountCents))}</Field>
            <Field label="Spent on">{str(s.row.spentOn)}</Field>
            <Field label="Report / payout">{str(s.row.status)} / {str(s.row.payoutStatus)}</Field>
            {s.row.jobName ? <Field label="Job">{str(s.row.jobName)} ({str(s.row.eventDate)})</Field> : null}
            {s.row.description ? <Field label="What for">{str(s.row.description)}</Field> : null}
            <div className="sm:col-span-2">
              <Link href="/app/books/expenses" className="text-sm font-semibold text-terracotta underline">
                Open expense reports
              </Link>
            </div>
          </dl>
        )}
        {s.kind === "opening_balance" && s.row && (
          <p className="mt-2 text-sm text-ink/75">
            Opening balance entered from a statement for {str(s.row.name)}
            {s.row.mask ? ` ····${str(s.row.mask)}` : ""}.
          </p>
        )}
        {(s.kind === "other" || !s.row) && (
          <p className="mt-2 text-sm text-ink/65">{e.sourceRef ? `Source ${e.sourceRef}.` : "No source recorded on this entry."}</p>
        )}
      </section>

      {versions.length > 1 && (
        <section className="mt-6 rounded-2xl border border-parchment bg-white p-5">
          <h2 className="text-lg text-charcoal">Every version from this source</h2>
          <p className="mt-1 text-xs text-ink/55">The live sync voids and reposts while a month is open; after a close, it posts a dated correction instead.</p>
          <ul className="mt-2 divide-y divide-parchment text-sm">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap justify-between gap-x-4 py-1.5">
                <Link href={`/app/books/entries/${v.id}`} className={`min-w-0 break-words underline decoration-parchment underline-offset-2 hover:text-terracotta ${v.id === e.id ? "font-semibold text-charcoal" : "text-ink/75"}`}>
                  {v.date} · {v.memo || "Journal entry"}
                </Link>
                <span className={`text-xs ${v.status === "void" ? "text-ink/45" : "text-sage-dark"}`}>
                  {v.status === "void" ? `void${v.voidReason ? `: ${v.voidReason}` : ""}` : v.adjustsPeriod ? `correction to ${v.adjustsPeriod.slice(0, 7)}` : "posted"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-parchment bg-white p-5">
        <h2 className="text-lg text-charcoal">Audit history</h2>
        <p className="mt-1 text-xs text-ink/55">This entry, every posting from its source, and the changes to the source itself. Newest first.</p>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-ink/60">Nothing logged yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-parchment text-xs">
            {history.map((h) => (
              <li key={h.id} className="py-2">
                <span className="font-semibold text-charcoal">{h.action}</span> <span className="text-ink/60">by {h.actor}, {when(h.at)}</span>
                {h.reason && <span className="block text-ink/70">Why: {h.reason}</span>}
                {h.cause && <span className="block text-ink/70">Cause: {h.cause}</span>}
                {h.before != null && <span className="block break-words text-ink/60">Before: {short(h.before)}</span>}
                {h.after != null && <span className="block break-words text-ink/60">After: {short(h.after)}</span>}
              </li>
            ))}
          </ul>
        )}
        <Link href={`/app/books/audit?type=journal_entry&id=${e.id}`} className="mt-2 inline-block text-sm font-semibold text-terracotta underline">
          Open in the audit log
        </Link>
      </section>
    </AccountShell>
  );
}
