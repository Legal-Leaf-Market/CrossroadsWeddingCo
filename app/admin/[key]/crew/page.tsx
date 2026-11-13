import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CrewEditor from "@/components/admin/CrewEditor";
import MaterialsEditor from "@/components/admin/MaterialsEditor";
import { adminKeyMatches } from "@/lib/admin";
import { listCrew, listItems, listVendorChoices, scheduledLabor, unplannedEvents } from "@/lib/costing";
import { centsLabel, crewLoad, hoursLabel, isPayMethod } from "@/lib/costing-logic";
import { formatEventDate } from "@/lib/hub-constants";
import { SITE_NAME, VENUE_TIME_ZONE } from "@/lib/site";
import { HOUSE_TENANT_ID } from "@/lib/tenant-constants";
import { listVendors } from "@/lib/vendors";

// Crew, pay and materials (2026-11-13, Jake: "project costing and planning for
// material and hour resources starting with labor for Nic, Terry, and Jake";
// "fully customizable"). Who works events and how they are paid, the owner's
// materials list, everyone's planned hours over the next twelve months, and
// what each linked 1099 vendor has actually been paid this year.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crew and costs",
  robots: { index: false, follow: false },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function CrewPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!adminKeyMatches(key)) notFound();

  const today = new Date().toLocaleDateString("en-CA", { timeZone: VENUE_TIME_ZONE });
  const [crew, items, vendorChoices, vendorRows, labor, unplanned] = await Promise.all([
    listCrew(),
    listItems(),
    listVendorChoices(),
    listVendors(HOUSE_TENANT_ID).catch(() => []),
    scheduledLabor(today),
    unplannedEvents(today),
  ]);

  const [ty, tm] = today.split("-").map(Number);
  const months = Array.from({ length: 12 }, (_, i) => {
    const m0 = tm - 1 + i;
    const y = ty + Math.floor(m0 / 12);
    const m = (m0 % 12) + 1;
    return { key: `${y}-${String(m).padStart(2, "0")}`, label: MONTHS[m - 1], year: y };
  });
  const load = crewLoad(labor, months.map((m) => m.key));
  const nameOf = new Map(crew.map((c) => [c.id, c.name]));
  const paidThisYear = new Map(vendorRows.map((v) => [v.id, v.thisYear]));
  const active = crew.filter((c) => !c.retiredAt);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
          <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
          <h1 className="text-2xl text-charcoal">Crew, pay and materials</h1>
          <p className="text-sm text-ink/60">
            Everything here is yours to set. Pay defaults are copied onto an event when you add someone to it, so changing them
            later never rewrites an event you already planned.
          </p>
          <a href={`/admin/${key}`} className="mt-2 inline-block text-sm font-medium text-terracotta underline decoration-parchment underline-offset-2">
            Back to the command center
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6">
        {(load.conflicts.length > 0 || unplanned.length > 0) && (
          <section className="space-y-3">
            {load.conflicts.map((c) => (
              <p key={`${c.crewMemberId}-${c.date}`} className="rounded-2xl border border-terracotta bg-white p-4 text-sm text-charcoal">
                <span className="font-semibold text-terracotta-dark">Double-booked: </span>
                {nameOf.get(c.crewMemberId) ?? "Someone"} is on {c.events.join(" and ")} on {formatEventDate(c.date)}.
              </p>
            ))}
            {unplanned.length > 0 && (
              <div className="rounded-2xl border border-gold bg-gold/10 p-4 text-sm">
                <p className="font-semibold text-charcoal">Events with no crew planned</p>
                <ul className="mt-1 space-y-0.5">
                  {unplanned.map((w) => (
                    <li key={w.id}>
                      <a href={`/admin/${key}/costing/${w.id}`} className="text-terracotta underline decoration-parchment underline-offset-2">
                        {w.coupleNames}
                      </a>{" "}
                      <span className="text-ink/60">{formatEventDate(w.eventDate)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section id="load">
          <h2 className="text-lg font-semibold text-charcoal">Planned hours, next 12 months</h2>
          <p className="mb-3 text-sm text-ink/60">Hours from each event&apos;s plan, with the number of events under them.</p>
          <div className="overflow-x-auto rounded-2xl border border-parchment bg-white p-3">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink/55">
                  <th className="pb-2 pr-2 font-medium">Person</th>
                  {months.map((m) => (
                    <th key={m.key} className="pb-2 text-center font-medium">
                      {m.label}
                      {m.label === "Jan" && <span className="block text-[10px]">{m.year}</span>}
                    </th>
                  ))}
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {active.map((c) => {
                  const cells = load.byPerson[c.id] ?? months.map((m) => ({ key: m.key, minutes: 0, events: 0 }));
                  const total = cells.reduce((s, x) => s + x.minutes, 0);
                  const events = cells.reduce((s, x) => s + x.events, 0);
                  return (
                    <tr key={c.id} className="border-t border-parchment">
                      <td className="py-2 pr-2 font-semibold text-charcoal">{c.name}</td>
                      {cells.map((x) => (
                        <td key={x.key} className="py-2 text-center tabular-nums">
                          {x.events > 0 ? (
                            <span className="inline-block min-w-10 rounded-md bg-terracotta/15 px-1 py-0.5 text-charcoal" title={`${x.events} event${x.events === 1 ? "" : "s"}`}>
                              {hoursLabel(x.minutes) || "0h"}
                              <span className="block text-[10px] text-ink/55">{x.events} ev</span>
                            </span>
                          ) : (
                            <span className="text-ink/25">·</span>
                          )}
                        </td>
                      ))}
                      <td className="py-2 text-right tabular-nums text-charcoal">
                        {hoursLabel(total) || "0h"}
                        <span className="block text-[10px] text-ink/55">{events} events</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section id="crew">
          <h2 className="text-lg font-semibold text-charcoal">Crew and default pay</h2>
          <p className="mb-3 text-sm text-ink/60">
            Owners split what each event leaves after every cost; leave their share blank to split evenly. Everyone else is a cost
            on the event: per project, hourly, or a percent of the event. Link each person to their 1099 vendor record to see what
            actually went out through the bank.
          </p>
          {active.some((c) => c.vendorId) && (
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              {active
                .filter((c) => c.vendorId)
                .map((c) => {
                  const y = paidThisYear.get(c.vendorId!);
                  return (
                    <div key={c.id} className="rounded-2xl border border-parchment bg-white p-4">
                      <p className="text-xs uppercase tracking-wider text-ink/55">{c.name}, paid {ty}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-charcoal">{centsLabel(y?.paidCents ?? 0)}</p>
                      <p className="text-xs text-ink/55">
                        {y ? `${y.payments} payment${y.payments === 1 ? "" : "s"} · 1099-NEC ${y.status === "over" ? "required" : y.status === "under" ? "not yet required" : "threshold not published"}` : "No payments found yet"}
                      </p>
                    </div>
                  );
                })}
            </div>
          )}
          <CrewEditor
            adminKey={key}
            vendors={vendorChoices}
            initial={crew.map((c) => ({
              id: c.id,
              name: c.name,
              defaultRole: c.defaultRole,
              payMethod: isPayMethod(c.payMethod) ? c.payMethod : "project",
              rateCents: c.rateCents,
              percentBps: c.percentBps,
              shareBps: c.shareBps,
              vendorId: c.vendorId,
              notes: c.notes,
              retired: c.retiredAt !== null,
            }))}
          />
        </section>

        <section id="materials">
          <h2 className="text-lg font-semibold text-charcoal">Materials list</h2>
          <p className="mb-3 text-sm text-ink/60">Your own items and what one unit costs you. Pick from this list on any event.</p>
          <MaterialsEditor
            adminKey={key}
            initial={items.map((i) => ({
              id: i.id,
              name: i.name,
              category: i.category,
              unit: i.unit,
              unitCostCents: i.unitCostCents,
              notes: i.notes,
              retired: i.retiredAt !== null,
            }))}
          />
        </section>
      </main>
    </div>
  );
}
