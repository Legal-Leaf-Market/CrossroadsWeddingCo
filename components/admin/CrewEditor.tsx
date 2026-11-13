"use client";

import { useState } from "react";
import { PAY_METHODS, PAY_METHOD_LABELS, type PayMethod } from "@/lib/costing-logic";
import { bpsToText, centsToText, inputClass, ROLE_SUGGESTIONS, textToBps, textToCents } from "@/components/admin/costing-inputs";

export type CrewRow = {
  id: string | null;
  name: string;
  defaultRole: string;
  payMethod: PayMethod;
  rateCents: number | null;
  percentBps: number | null;
  shareBps: number | null;
  vendorId: string | null;
  notes: string;
  retired: boolean;
};

type Draft = Omit<CrewRow, "rateCents" | "percentBps" | "shareBps"> & { amount: string };

function toDraft(r: CrewRow): Draft {
  const amount =
    r.payMethod === "percent" ? bpsToText(r.percentBps) : r.payMethod === "owner" ? bpsToText(r.shareBps) : centsToText(r.rateCents);
  return { id: r.id, name: r.name, defaultRole: r.defaultRole, payMethod: r.payMethod, vendorId: r.vendorId, notes: r.notes, retired: r.retired, amount };
}

function amountHint(m: PayMethod): string {
  switch (m) {
    case "project":
      return "$ per event";
    case "hour":
      return "$ per hour";
    case "percent":
      return "% of event total";
    case "owner":
      return "% of what's left (blank = even split)";
  }
}

/**
 * Who works events and how each person is paid by default. Every field is the
 * owner's: nothing here has a preset amount. Defaults are copied onto an event
 * when the person is added to it, so changing one here never rewrites an event
 * already planned.
 */
export default function CrewEditor({
  adminKey,
  initial,
  vendors,
}: {
  adminKey: string;
  initial: CrewRow[];
  vendors: { id: string; name: string; kind: string }[];
}) {
  const [rows, setRows] = useState<Draft[]>(initial.map(toDraft));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  const edit = (i: number, patch: Partial<Draft>) => {
    setRows((prev) => prev.map((r, n) => (n === i ? { ...r, ...patch } : r)));
    setStatus("idle");
  };

  async function save() {
    const crew: CrewRow[] = [];
    for (const r of rows) {
      if (!r.name.trim()) {
        setError("Every person needs a name.");
        setStatus("error");
        return;
      }
      const isPct = r.payMethod === "percent" || r.payMethod === "owner";
      const cents = isPct ? null : textToCents(r.amount);
      const bps = isPct ? textToBps(r.amount) : null;
      if (r.amount.trim() && cents == null && bps == null) {
        setError(`${r.name}: "${r.amount}" isn't a number ${isPct ? "from 0 to 100" : "of dollars"}.`);
        setStatus("error");
        return;
      }
      crew.push({
        id: r.id,
        name: r.name.trim(),
        defaultRole: r.defaultRole.trim(),
        payMethod: r.payMethod,
        rateCents: cents,
        percentBps: r.payMethod === "percent" ? bps : null,
        shareBps: r.payMethod === "owner" ? bps : null,
        vendorId: r.vendorId,
        notes: r.notes,
        retired: r.retired,
      });
    }
    setStatus("saving");
    setError("");
    try {
      const res = await fetch(`/api/admin/${encodeURIComponent(adminKey)}/crew`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crew }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? "That didn't save.");
        setStatus("error");
        return;
      }
      setStatus("saved");
      // New people need their ids before an event can point at them.
      if (rows.some((r) => !r.id)) window.location.reload();
    } catch {
      setError("That didn't save.");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-3">
      <datalist id="crew-roles">
        {ROLE_SUGGESTIONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      {rows.map((r, i) => (
        <div key={r.id ?? `new-${i}`} className={`rounded-2xl border border-parchment bg-white p-4 ${r.retired ? "opacity-60" : ""}`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-ink/60">
              Name
              <input className={`${inputClass} mt-1`} value={r.name} onChange={(e) => edit(i, { name: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-ink/60">
              Usual role
              <input className={`${inputClass} mt-1`} list="crew-roles" value={r.defaultRole} onChange={(e) => edit(i, { defaultRole: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-ink/60">
              Paid
              <select className={`${inputClass} mt-1`} value={r.payMethod} onChange={(e) => edit(i, { payMethod: e.target.value as PayMethod, amount: "" })}>
                {PAY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAY_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-ink/60">
              {amountHint(r.payMethod)}
              <input
                className={`${inputClass} mt-1`}
                inputMode="decimal"
                placeholder={r.payMethod === "owner" ? "even split" : "not set"}
                value={r.amount}
                onChange={(e) => edit(i, { amount: e.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-ink/60 sm:col-span-2">
              1099 vendor record (payments found on the bank feed)
              <select className={`${inputClass} mt-1`} value={r.vendorId ?? ""} onChange={(e) => edit(i, { vendorId: e.target.value || null })}>
                <option value="">Not linked</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.kind !== "contractor" ? ` (${v.kind})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-ink/60 sm:col-span-2">
              Notes
              <input className={`${inputClass} mt-1`} value={r.notes} onChange={(e) => edit(i, { notes: e.target.value })} />
            </label>
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-sm text-ink/70">
            <input type="checkbox" checked={r.retired} onChange={(e) => edit(i, { retired: e.target.checked })} />
            Retired (kept on past events, hidden when planning new ones)
          </label>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setRows((p) => [...p, { id: null, name: "", defaultRole: "", payMethod: "project", vendorId: null, notes: "", retired: false, amount: "" }])}
          className="rounded-full border border-terracotta px-4 py-1.5 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
        >
          Add a person
        </button>
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="rounded-full bg-terracotta px-5 py-1.5 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
        >
          {status === "saving" ? "Saving..." : "Save crew"}
        </button>
        {status === "saved" && <span className="text-sm text-sage-dark">Saved.</span>}
        {status === "error" && <span className="text-sm text-terracotta-dark">{error}</span>}
      </div>
    </div>
  );
}
