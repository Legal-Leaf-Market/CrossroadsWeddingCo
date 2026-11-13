"use client";

import { useMemo, useState } from "react";
import {
  centsLabel,
  costEvent,
  hoursLabel,
  isPayMethod,
  PAY_METHODS,
  PAY_METHOD_LABELS,
  type CostLine,
  type Owner,
  type PayMethod,
} from "@/lib/costing-logic";
import {
  bpsToText,
  centsToText,
  inputClass,
  minutesToText,
  ROLE_SUGGESTIONS,
  textToBps,
  textToCents,
  textToMinutes,
  textToQty,
} from "@/components/admin/costing-inputs";

export type PlanCrew = {
  id: string;
  name: string;
  defaultRole: string;
  payMethod: string;
  rateCents: number | null;
  percentBps: number | null;
  retired: boolean;
};

export type PlanItem = { id: string; name: string; unit: string; unitCostCents: number | null; retired: boolean };

export type PlanLine = {
  kind: "labor" | "material";
  crewMemberId: string | null;
  resourceItemId: string | null;
  label: string;
  role: string;
  payMethod: string | null;
  rateCents: number | null;
  percentBps: number | null;
  plannedMinutes: number | null;
  actualMinutes: number | null;
  unit: string;
  unitCostCents: number | null;
  plannedQty: number | null;
  actualQty: number | null;
  actualCostCents: number | null;
  notes: string;
};

// Everything the owner types stays text until save, so "6:30" or "$1,200"
// survives a half-typed state.
type Draft = {
  key: number;
  kind: "labor" | "material";
  crewMemberId: string | null;
  resourceItemId: string | null;
  label: string;
  role: string;
  payMethod: PayMethod | null;
  amount: string;
  plannedHours: string;
  actualHours: string;
  unit: string;
  unitCost: string;
  plannedQty: string;
  actualQty: string;
  paid: string;
  notes: string;
};

let nextKey = 1;

function lineToDraft(l: PlanLine): Draft {
  const pm = isPayMethod(l.payMethod) ? l.payMethod : null;
  return {
    key: nextKey++,
    kind: l.kind,
    crewMemberId: l.crewMemberId,
    resourceItemId: l.resourceItemId,
    label: l.label,
    role: l.role,
    payMethod: pm,
    amount: pm === "percent" ? bpsToText(l.percentBps) : centsToText(l.rateCents),
    plannedHours: minutesToText(l.plannedMinutes),
    actualHours: minutesToText(l.actualMinutes),
    unit: l.unit,
    unitCost: centsToText(l.unitCostCents),
    plannedQty: l.plannedQty == null ? "" : String(l.plannedQty),
    actualQty: l.actualQty == null ? "" : String(l.actualQty),
    paid: centsToText(l.actualCostCents),
    notes: l.notes,
  };
}

function draftToLine(d: Draft): PlanLine {
  const pct = d.payMethod === "percent";
  return {
    kind: d.kind,
    crewMemberId: d.crewMemberId,
    resourceItemId: d.resourceItemId,
    label: d.label.trim(),
    role: d.role.trim(),
    payMethod: d.kind === "labor" ? d.payMethod : null,
    rateCents: d.kind === "labor" && !pct && d.payMethod !== "owner" ? textToCents(d.amount) : null,
    percentBps: d.kind === "labor" && pct ? textToBps(d.amount) : null,
    plannedMinutes: d.kind === "labor" ? textToMinutes(d.plannedHours) : null,
    actualMinutes: d.kind === "labor" ? textToMinutes(d.actualHours) : null,
    unit: d.kind === "material" ? d.unit.trim() : "",
    unitCostCents: d.kind === "material" ? textToCents(d.unitCost) : null,
    plannedQty: d.kind === "material" ? textToQty(d.plannedQty) : null,
    actualQty: d.kind === "material" ? textToQty(d.actualQty) : null,
    actualCostCents: textToCents(d.paid),
    notes: d.notes,
  };
}

function toCostLine(l: PlanLine): CostLine {
  return { ...l, payMethod: isPayMethod(l.payMethod) ? l.payMethod : null };
}

const pct = (f: number | null) => (f == null ? "" : `${Math.round(f * 100)}%`);

function Money({ label, value, strong = false, warn = false }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-ink/65">{label}</span>
      <span className={`tabular-nums ${strong ? "text-lg font-semibold" : ""} ${warn ? "text-terracotta-dark" : "text-charcoal"}`}>{value}</span>
    </div>
  );
}

export default function EventPlanEditor({
  adminKey,
  weddingId,
  revenueCents,
  eventPast,
  crew,
  items,
  owners,
  initial,
}: {
  adminKey: string;
  weddingId: string;
  revenueCents: number;
  /** After the event, the summary leads with actuals. */
  eventPast: boolean;
  crew: PlanCrew[];
  items: PlanItem[];
  owners: Owner[];
  initial: PlanLine[];
}) {
  const [drafts, setDrafts] = useState<Draft[]>(initial.map(lineToDraft));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  const names = useMemo(() => Object.fromEntries(crew.map((c) => [c.id, c.name])), [crew]);
  const lines = drafts.map(draftToLine);
  const costing = costEvent({ revenueCents, lines: lines.map(toCostLine), owners, names });

  const edit = (key: number, patch: Partial<Draft>) => {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
    setStatus("idle");
  };
  const remove = (key: number) => {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
    setStatus("idle");
  };

  function addPerson(id: string) {
    const c = crew.find((x) => x.id === id);
    if (!c) return;
    const pm = isPayMethod(c.payMethod) ? c.payMethod : "project";
    setDrafts((p) => [
      ...p,
      {
        key: nextKey++,
        kind: "labor",
        crewMemberId: c.id,
        resourceItemId: null,
        label: c.name,
        role: c.defaultRole,
        payMethod: pm,
        amount: pm === "percent" ? bpsToText(c.percentBps) : pm === "owner" ? "" : centsToText(c.rateCents),
        plannedHours: "",
        actualHours: "",
        unit: "",
        unitCost: "",
        plannedQty: "",
        actualQty: "",
        paid: "",
        notes: "",
      },
    ]);
    setStatus("idle");
  }

  function addItem(id: string) {
    const it = items.find((x) => x.id === id);
    setDrafts((p) => [
      ...p,
      {
        key: nextKey++,
        kind: "material",
        crewMemberId: null,
        resourceItemId: it?.id ?? null,
        label: it?.name ?? "",
        role: "",
        payMethod: null,
        amount: "",
        plannedHours: "",
        actualHours: "",
        unit: it?.unit ?? "each",
        unitCost: centsToText(it?.unitCostCents ?? null),
        plannedQty: "1",
        actualQty: "",
        paid: "",
        notes: "",
      },
    ]);
    setStatus("idle");
  }

  async function save() {
    for (const d of drafts) {
      const name = d.label || "A line";
      const bad = (field: string, v: string, ok: unknown) => v.trim() !== "" && (ok == null);
      if (d.kind === "labor") {
        const pctPay = d.payMethod === "percent";
        if (d.payMethod !== "owner" && bad("amount", d.amount, pctPay ? textToBps(d.amount) : textToCents(d.amount))) return fail(`${name}: the pay amount isn't a number.`);
        if (bad("hours", d.plannedHours, textToMinutes(d.plannedHours)) || bad("hours", d.actualHours, textToMinutes(d.actualHours)))
          return fail(`${name}: hours go in like 6, 6.5 or 6:30.`);
      } else {
        if (!d.label.trim()) return fail("Every material line needs a name.");
        if (bad("cost", d.unitCost, textToCents(d.unitCost))) return fail(`${name}: the unit cost isn't a dollar amount.`);
        if (bad("qty", d.plannedQty, textToQty(d.plannedQty)) || bad("qty", d.actualQty, textToQty(d.actualQty))) return fail(`${name}: quantity isn't a number.`);
      }
      if (bad("paid", d.paid, textToCents(d.paid))) return fail(`${name}: the paid amount isn't a dollar amount.`);
    }
    setStatus("saving");
    setError("");
    try {
      const res = await fetch(`/api/admin/${encodeURIComponent(adminKey)}/costing/${weddingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        return fail(json.error ?? "That didn't save.");
      }
      setStatus("saved");
    } catch {
      fail("That didn't save.");
    }
  }

  function fail(msg: string) {
    setError(msg);
    setStatus("error");
  }

  const labor = drafts.filter((d) => d.kind === "labor");
  const material = drafts.filter((d) => d.kind === "material");
  const onEvent = new Set(labor.map((d) => d.crewMemberId));
  const addable = crew.filter((c) => !c.retired && !onEvent.has(c.id));
  const showActual = eventPast || costing.actualComplete;
  const view = showActual ? costing.actual : costing.planned;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <datalist id="plan-roles">
          {ROLE_SUGGESTIONS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>

        <section>
          <h2 className="text-lg font-semibold text-charcoal">Labor</h2>
          <p className="mb-3 text-sm text-ink/60">
            Who works it, doing what, and for how many hours. Owners aren&apos;t a cost; their hours show what their share of
            what&apos;s left works out to per hour. &quot;Paid&quot; is what actually went out through Found, and it wins over the plan.
          </p>
          <div className="space-y-3">
            {labor.length === 0 && <p className="rounded-2xl border border-parchment bg-white p-4 text-sm text-ink/60">No one on this event yet.</p>}
            {labor.map((d) => (
              <div key={d.key} className="rounded-2xl border border-parchment bg-white p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-charcoal">{d.label || "Crew"}</p>
                  <button type="button" onClick={() => remove(d.key)} className="text-xs font-semibold text-ink/50 hover:text-terracotta-dark">
                    Remove
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <label className="col-span-2 text-xs font-semibold text-ink/60 sm:col-span-1 lg:col-span-2">
                    Role
                    <input className={`${inputClass} mt-1`} list="plan-roles" value={d.role} onChange={(e) => edit(d.key, { role: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-ink/60">
                    Paid as
                    <select
                      className={`${inputClass} mt-1`}
                      value={d.payMethod ?? ""}
                      onChange={(e) => edit(d.key, { payMethod: (e.target.value || null) as PayMethod | null, amount: "" })}
                    >
                      {PAY_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {PAY_METHOD_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-ink/60">
                    {d.payMethod === "hour" ? "$ / hour" : d.payMethod === "percent" ? "% of event" : d.payMethod === "owner" ? "Share" : "$ this event"}
                    {d.payMethod === "owner" ? (
                      <span className="mt-1 block rounded-lg bg-cream px-2.5 py-1.5 text-sm font-normal text-ink/60">from crew page</span>
                    ) : (
                      <input className={`${inputClass} mt-1`} inputMode="decimal" placeholder="not set" value={d.amount} onChange={(e) => edit(d.key, { amount: e.target.value })} />
                    )}
                  </label>
                  <label className="text-xs font-semibold text-ink/60">
                    Hours planned
                    <input className={`${inputClass} mt-1`} inputMode="decimal" placeholder="0" value={d.plannedHours} onChange={(e) => edit(d.key, { plannedHours: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-ink/60">
                    Hours actual
                    <input className={`${inputClass} mt-1`} inputMode="decimal" value={d.actualHours} onChange={(e) => edit(d.key, { actualHours: e.target.value })} />
                  </label>
                  {d.payMethod !== "owner" && (
                    <label className="text-xs font-semibold text-ink/60">
                      Paid
                      <input className={`${inputClass} mt-1`} inputMode="decimal" placeholder="not yet" value={d.paid} onChange={(e) => edit(d.key, { paid: e.target.value })} />
                    </label>
                  )}
                  <label className="col-span-2 text-xs font-semibold text-ink/60 sm:col-span-3 lg:col-span-6">
                    Notes
                    <input className={`${inputClass} mt-1`} value={d.notes} onChange={(e) => edit(d.key, { notes: e.target.value })} />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {addable.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => addPerson(c.id)}
                className="rounded-full border border-terracotta px-3.5 py-1.5 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
              >
                + {c.name}
              </button>
            ))}
            {crew.length === 0 && <p className="text-sm text-ink/60">Add people on the crew page first.</p>}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-charcoal">Materials</h2>
          <p className="mb-3 text-sm text-ink/60">Rentals, consumables, gear, fuel: anything the event uses, by quantity.</p>
          <div className="space-y-3">
            {material.length === 0 && <p className="rounded-2xl border border-parchment bg-white p-4 text-sm text-ink/60">No materials on this event.</p>}
            {material.map((d) => (
              <div key={d.key} className="grid grid-cols-2 gap-2 rounded-2xl border border-parchment bg-white p-3 sm:grid-cols-6">
                <label className="col-span-2 text-xs font-semibold text-ink/60">
                  Item
                  <input className={`${inputClass} mt-1`} value={d.label} onChange={(e) => edit(d.key, { label: e.target.value })} />
                </label>
                <label className="text-xs font-semibold text-ink/60">
                  $ per {d.unit || "unit"}
                  <input className={`${inputClass} mt-1`} inputMode="decimal" placeholder="not set" value={d.unitCost} onChange={(e) => edit(d.key, { unitCost: e.target.value })} />
                </label>
                <label className="text-xs font-semibold text-ink/60">
                  Qty planned
                  <input className={`${inputClass} mt-1`} inputMode="decimal" value={d.plannedQty} onChange={(e) => edit(d.key, { plannedQty: e.target.value })} />
                </label>
                <label className="text-xs font-semibold text-ink/60">
                  Qty used
                  <input className={`${inputClass} mt-1`} inputMode="decimal" value={d.actualQty} onChange={(e) => edit(d.key, { actualQty: e.target.value })} />
                </label>
                <label className="text-xs font-semibold text-ink/60">
                  Paid
                  <input className={`${inputClass} mt-1`} inputMode="decimal" placeholder="not yet" value={d.paid} onChange={(e) => edit(d.key, { paid: e.target.value })} />
                </label>
                <div className="col-span-2 flex justify-end sm:col-span-6">
                  <button type="button" onClick={() => remove(d.key)} className="text-xs font-semibold text-ink/50 hover:text-terracotta-dark">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              className={`${inputClass} w-auto`}
              value=""
              onChange={(e) => {
                if (e.target.value) addItem(e.target.value === "__custom" ? "" : e.target.value);
              }}
              aria-label="Add a material"
            >
              <option value="">+ Add a material...</option>
              {items
                .filter((i) => !i.retired)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              <option value="__custom">Something not on the list</option>
            </select>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={status === "saving"}
            className="rounded-full bg-terracotta px-6 py-2 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
          >
            {status === "saving" ? "Saving..." : "Save plan"}
          </button>
          {status === "saved" && <span className="text-sm text-sage-dark">Saved.</span>}
          {status === "error" && <span className="text-sm text-terracotta-dark">{error}</span>}
        </div>
      </div>

      <aside className="h-fit space-y-4 lg:sticky lg:top-4">
        <div className="rounded-2xl border border-parchment bg-white p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink/55">{showActual ? "Actual so far" : "Plan"}</p>
          <Money label="Event total" value={centsLabel(costing.revenue)} />
          <Money label="Labor (non-owner)" value={centsLabel(view.labor)} />
          <Money label="Materials" value={centsLabel(view.material)} />
          <div className="my-1 h-px bg-parchment" />
          <Money label="Left to split" value={centsLabel(view.left)} strong warn={view.left < 0} />
          <p className="text-right text-xs text-ink/55">{pct(showActual ? costing.actualMargin : costing.plannedMargin)} of the event kept</p>
          {showActual && (
            <p className="mt-1 text-xs text-ink/55">
              Plan was {centsLabel(costing.planned.left)} left.{!costing.actualComplete && " Lines without an actual still count at plan."}
            </p>
          )}
        </div>

        {costing.owners.length > 0 && (
          <div className="rounded-2xl border border-parchment bg-white p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/55">Owners&apos; split</p>
            {costing.owners.map((o) => (
              <Money key={o.id} label={`${o.name} (${Math.round(o.bps) / 100}%)`} value={centsLabel(showActual ? o.actual : o.planned)} />
            ))}
            {costing.sharesOver && <p className="mt-1 text-xs font-semibold text-terracotta-dark">Owner shares add up to more than 100%. Fix them on the crew page.</p>}
          </div>
        )}

        {costing.people.length > 0 && (
          <div className="rounded-2xl border border-parchment bg-white p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/55">Per person</p>
            <table className="mt-1 w-full">
              <tbody>
                {costing.people.map((p, i) => {
                  const pay = showActual && p.actualPay != null ? p.actualPay : p.plannedPay;
                  const mins = showActual && p.actualMinutes ? p.actualMinutes : p.plannedMinutes;
                  const ph = showActual && p.actualPerHour != null ? p.actualPerHour : p.plannedPerHour;
                  return (
                    <tr key={`${p.crewMemberId ?? i}`} className="border-t border-parchment first:border-0">
                      <td className="py-1.5 text-charcoal">
                        {p.name}
                        <span className="block text-xs text-ink/50">{hoursLabel(mins) || "no hours"}</span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {centsLabel(pay)}
                        <span className="block text-xs text-ink/50">{ph != null ? `${centsLabel(ph)}/hr` : ""}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {costing.missing.length > 0 && (
          <div className="rounded-2xl border border-gold bg-gold/10 p-4 text-sm">
            <p className="font-semibold text-charcoal">Needs a number</p>
            <ul className="mt-1 list-inside list-disc text-ink/75">
              {costing.missing.map((m, i) => (
                <li key={i}>
                  {m.label}: {m.reason}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-ink/55">Totals leave these out until they&apos;re filled in.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
