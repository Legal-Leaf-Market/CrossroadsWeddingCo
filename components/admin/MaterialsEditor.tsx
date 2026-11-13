"use client";

import { useState } from "react";
import { centsToText, inputClass, textToCents } from "@/components/admin/costing-inputs";

export type ItemRow = {
  id: string | null;
  name: string;
  category: string;
  unit: string;
  unitCostCents: number | null;
  notes: string;
  retired: boolean;
};

type Draft = Omit<ItemRow, "unitCostCents"> & { cost: string };

/**
 * The owner's own list of materials, rentals and consumables. Nothing is
 * preloaded: what a wedding uses is the owner's to say. The unit cost is a
 * default copied onto an event when the item is added there.
 */
export default function MaterialsEditor({ adminKey, initial }: { adminKey: string; initial: ItemRow[] }) {
  const [rows, setRows] = useState<Draft[]>(initial.map((r) => ({ ...r, cost: centsToText(r.unitCostCents) })));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  const edit = (i: number, patch: Partial<Draft>) => {
    setRows((prev) => prev.map((r, n) => (n === i ? { ...r, ...patch } : r)));
    setStatus("idle");
  };

  async function save() {
    const items: ItemRow[] = [];
    for (const r of rows) {
      if (!r.name.trim()) {
        setError("Every item needs a name.");
        setStatus("error");
        return;
      }
      const cents = textToCents(r.cost);
      if (r.cost.trim() && cents == null) {
        setError(`${r.name}: "${r.cost}" isn't a dollar amount.`);
        setStatus("error");
        return;
      }
      items.push({ id: r.id, name: r.name.trim(), category: r.category.trim(), unit: r.unit.trim() || "each", unitCostCents: cents, notes: r.notes, retired: r.retired });
    }
    setStatus("saving");
    setError("");
    try {
      const res = await fetch(`/api/admin/${encodeURIComponent(adminKey)}/materials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? "That didn't save.");
        setStatus("error");
        return;
      }
      setStatus("saved");
      if (rows.some((r) => !r.id)) window.location.reload();
    } catch {
      setError("That didn't save.");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="rounded-2xl border border-parchment bg-white p-4 text-sm text-ink/60">
          No materials yet. Add what an event uses (rentals, consumables, gear wear, fuel) with its unit and what one unit costs you.
        </p>
      )}
      {rows.map((r, i) => (
        <div key={r.id ?? `new-${i}`} className={`grid gap-2 rounded-2xl border border-parchment bg-white p-3 sm:grid-cols-[2fr_1.2fr_1fr_1fr_auto] ${r.retired ? "opacity-60" : ""}`}>
          <label className="text-xs font-semibold text-ink/60">
            Item
            <input className={`${inputClass} mt-1`} value={r.name} onChange={(e) => edit(i, { name: e.target.value })} />
          </label>
          <label className="text-xs font-semibold text-ink/60">
            Category
            <input className={`${inputClass} mt-1`} placeholder="rental, bar, gear" value={r.category} onChange={(e) => edit(i, { category: e.target.value })} />
          </label>
          <label className="text-xs font-semibold text-ink/60">
            Unit
            <input className={`${inputClass} mt-1`} placeholder="each" value={r.unit} onChange={(e) => edit(i, { unit: e.target.value })} />
          </label>
          <label className="text-xs font-semibold text-ink/60">
            $ per unit
            <input className={`${inputClass} mt-1`} inputMode="decimal" placeholder="not set" value={r.cost} onChange={(e) => edit(i, { cost: e.target.value })} />
          </label>
          <label className="flex items-end gap-1.5 pb-2 text-xs text-ink/60">
            <input type="checkbox" checked={r.retired} onChange={(e) => edit(i, { retired: e.target.checked })} />
            Retired
          </label>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setRows((p) => [...p, { id: null, name: "", category: "", unit: "each", notes: "", retired: false, cost: "" }])}
          className="rounded-full border border-terracotta px-4 py-1.5 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
        >
          Add an item
        </button>
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="rounded-full bg-terracotta px-5 py-1.5 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
        >
          {status === "saving" ? "Saving..." : "Save materials"}
        </button>
        {status === "saved" && <span className="text-sm text-sage-dark">Saved.</span>}
        {status === "error" && <span className="text-sm text-terracotta-dark">{error}</span>}
      </div>
    </div>
  );
}
