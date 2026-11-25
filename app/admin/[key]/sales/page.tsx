import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminKeyMatches } from "@/lib/admin";
import AccountManagerSelect from "@/components/admin/AccountManagerSelect";
import SalesOrderForm from "@/components/admin/SalesOrderForm";
import { centsLabel } from "@/lib/costing-logic";
import { formatEventDate } from "@/lib/hub-constants";
import { activeCrew, commissionsByPerson, listAccounts, pipeline } from "@/lib/sales";
import { ACCOUNT_MANAGEMENT_BPS, CRM_KIND_LABEL, DIRECT_COMMISSION_CENTS, STAGE_LABEL, type CrmKind } from "@/lib/sales-logic";
import { SITE_NAME } from "@/lib/site";

// Sales: the pipeline from the playbook to the books (2026-11-13, Jake: "can
// the playbook play into like sales orders and such and be a direct pipeline
// into invoicing and CRM"; commissions "per event commission direct and
// account management commissions ongoing"). A playbook deal opens the order
// form here filled in; the order is a booking with its invoice, job plan and
// commission terms; the books post revenue and commissions on the event day.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sales", robots: { index: false, follow: false } };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function SalesPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { key } = await params;
  if (!adminKeyMatches(key)) notFound();
  const q = await searchParams;
  const [crew, accounts, rows, people] = await Promise.all([activeCrew(), listAccounts(), pipeline(), commissionsByPerson()]);
  const crewName = new Map(crew.map((c) => [c.id, c.name]));
  const by = one(q.by).toLowerCase();
  const prefill = {
    name: one(q.name).slice(0, 255),
    type: one(q.type) === "corporate" ? ("corporate" as const) : ("wedding" as const),
    date: /^\d{4}-\d{2}-\d{2}$/.test(one(q.date)) ? one(q.date) : "",
    closerId: crew.find((c) => c.name.toLowerCase() === by)?.id ?? "",
    lead: /^[a-z0-9-]{1,100}$/.test(one(q.lead)) ? one(q.lead) : "",
    accountName: one(q.account).slice(0, 160),
    accountId: "",
  };
  const fromPlaybook = !!(prefill.name || prefill.lead || prefill.accountName);
  const orders = rows.filter((r) => r.accountId || r.closer);
  const open = rows.filter((r) => r.stage !== "paid" && r.stage !== "cancelled");
  const totals = {
    booked: open.reduce((s, r) => s + r.contractCents, 0),
    collected: open.reduce((s, r) => s + r.creditedCents, 0),
  };
  const link = "font-semibold text-terracotta underline decoration-parchment underline-offset-2";

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
          <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
          <h1 className="text-2xl text-charcoal">Sales</h1>
          <p className="text-sm text-ink/60">
            Playbook lead to sales order to invoice to the books. Commissions: {centsLabel(DIRECT_COMMISSION_CENTS)} to whoever closes each event, and{" "}
            {ACCOUNT_MANAGEMENT_BPS / 100}% of every later event from an account to whoever manages it. Earned on the event day, paid once the client has
            paid in full.
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm font-medium">
            <a href={`/admin/${key}`} className={link}>
              Back to the command center
            </a>
            <a href={`/admin/${key}/playbook`} className={link}>
              Playbook
            </a>
            <a href={`/admin/${key}/jobs`} className={link}>
              Job costing
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6">
        <section id="new">
          <h2 className="mb-1 text-lg font-semibold text-charcoal">{fromPlaybook ? "New sales order from the playbook" : "New sales order"}</h2>
          <p className="mb-3 text-sm text-ink/60">
            Saving it makes the booking: it gets its invoice, its job plan and the couple&apos;s or client&apos;s hub, and nobody is emailed.
          </p>
          <SalesOrderForm adminKey={key} accounts={accounts.map((a) => ({ id: a.id, name: a.name, manager: a.managerCrewId ? crewName.get(a.managerCrewId) ?? null : null }))} crew={crew.map((c) => ({ id: c.id, name: c.name }))} prefill={prefill} />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-charcoal">Commissions</h2>
          {people.length === 0 ? (
            <p className="rounded-2xl border border-parchment bg-white p-5 text-sm text-ink/60">None yet. They start with the first sales order that names who closed it.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-parchment bg-white p-3">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink/55">
                    <th className="pb-2 font-medium">Person</th>
                    <th className="pb-2 text-right font-medium">Owed (in the books)</th>
                    <th className="pb-2 text-right font-medium">Ready to pay</th>
                    <th className="pb-2 text-right font-medium">On events still ahead</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.name} className="border-t border-parchment tabular-nums">
                      <td className="py-1.5 font-semibold text-charcoal">{p.name}</td>
                      <td className="py-1.5 text-right">{centsLabel(p.owedCents)}</td>
                      <td className="py-1.5 text-right">{centsLabel(p.readyCents)}</td>
                      <td className="py-1.5 text-right">{centsLabel(p.aheadCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-ink/55">
                Owed is 2600 Commissions payable, by person. Ready to pay counts held events whose client has paid in full. Paying it out from the bank is the
                next step (cash payout requests).
              </p>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold text-charcoal">Pipeline</h2>
          <p className="mb-3 text-sm text-ink/60">
            {open.length} open, {centsLabel(totals.booked)} booked, {centsLabel(totals.collected)} collected so far.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-parchment bg-white p-3">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink/55">
                  <th className="pb-2 font-medium">Order</th>
                  <th className="pb-2 font-medium">Account</th>
                  <th className="pb-2 font-medium">Stage</th>
                  <th className="pb-2 text-right font-medium">Contract</th>
                  <th className="pb-2 text-right font-medium">Collected</th>
                  <th className="pb-2 font-medium">Commissions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-parchment align-top tabular-nums">
                    <td className="py-1.5 pr-2">
                      <span className="font-semibold text-charcoal">{r.name}</span>
                      <span className="block text-xs text-ink/55">
                        {formatEventDate(r.eventDate)} · {r.type}
                        {r.closer ? ` · closed by ${r.closer}` : ""}
                      </span>
                      <span className="block text-xs">
                        <a href={`/admin/${key}/invoice/${r.id}`} className="text-terracotta underline">
                          Invoice
                        </a>{" "}
                        ·{" "}
                        <a href={`/admin/${key}/costing/${r.id}`} className="text-terracotta underline">
                          Job plan
                        </a>
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-ink/75">{r.accountName ?? ""}</td>
                    <td className="py-1.5 pr-2 text-ink/75">{STAGE_LABEL[r.stage]}</td>
                    <td className="py-1.5 text-right">{centsLabel(r.contractCents)}</td>
                    <td className="py-1.5 text-right">{centsLabel(r.creditedCents)}</td>
                    <td className="py-1.5 pl-2 text-xs text-ink/70">
                      {r.commissions.length === 0
                        ? ""
                        : r.commissions.map((c) => (
                            <span key={c.role} className="block">
                              {c.person} {centsLabel(c.cents)} {c.role === "closer" ? "closing" : "account"}
                              {c.payable ? ", ready to pay" : c.earned ? ", waiting on the client" : ", on the event day"}
                            </span>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {orders.length === 0 && <p className="mt-2 text-sm text-ink/60">No sales orders yet: bookings made before the pipeline carry no account or closer.</p>}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-charcoal">Accounts</h2>
          {accounts.length === 0 ? (
            <p className="rounded-2xl border border-parchment bg-white p-5 text-sm text-ink/60">No accounts yet. Pick &quot;New account&quot; on a sales order, or start one from the playbook.</p>
          ) : (
            <ul className="divide-y divide-parchment rounded-2xl border border-parchment bg-white px-4 text-sm">
              {accounts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 break-words">
                    <span className="font-semibold text-charcoal">{a.name}</span>{" "}
                    <span className="text-ink/55">
                      {CRM_KIND_LABEL[a.kind as CrmKind] ?? a.kind} · {a.bookings} booking{a.bookings === 1 ? "" : "s"} · {centsLabel(a.bookedCents)}
                    </span>
                  </span>
                  <AccountManagerSelect adminKey={key} accountId={a.id} value={a.managerCrewId ?? ""} crew={crew.map((c) => ({ id: c.id, name: c.name }))} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
