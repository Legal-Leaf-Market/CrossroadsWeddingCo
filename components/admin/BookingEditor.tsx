"use client";

import { useState } from "react";
import { ACOUSTIC_ADDON_USD, BARTENDER_MIN_USD } from "@/lib/site";
import { ART_THEMES } from "@/lib/wedding-art";
import type { AdminWedding } from "@/lib/admin";

// The owner's only write surface: the money, the paid flags, the status, and
// a bespoke arrangement for weddings that predate the pricing model or settle
// in trade. Everything else about a wedding still comes from the couple's hub.
export default function BookingEditor({
  wedding,
  basePath,
  demo = false,
}: {
  wedding: AdminWedding;
  basePath: string;
  demo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState(wedding.totalAmount);
  const [depositPaid, setDepositPaid] = useState(wedding.isDepositPaid);
  const [balancePaid, setBalancePaid] = useState(wedding.isBalancePaid);
  const [customTerms, setCustomTerms] = useState(wedding.customTerms ?? "");
  const [artTheme, setArtTheme] = useState(wedding.artTheme ?? "");
  // Add-ons drive the service agreement, so a stale one puts a service the
  // couple is not getting into their contract.
  const [acoustic, setAcoustic] = useState(
    wedding.addons.some((a) => a.type === "acoustic_set"),
  );
  const [bar, setBar] = useState(wedding.addons.some((a) => a.type === "bar_service"));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function save() {
    setBusy(true);
    setNote("");
    if (demo) {
      setBusy(false);
      setNote("Saved (preview only)");
      return;
    }
    try {
      const res = await fetch(`/api/admin/${basePath.split("/").pop()}/wedding/${wedding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: Number(total).toFixed(2),
          isDepositPaid: depositPaid,
          isBalancePaid: balancePaid,
          customTerms,
          artTheme,
          // Keep whatever fee was already recorded; only membership changes here.
          addons: [
            ...(acoustic
              ? [
                  wedding.addons.find((a) => a.type === "acoustic_set") ?? {
                    type: "acoustic_set",
                    fee: ACOUSTIC_ADDON_USD,
                  },
                ]
              : []),
            ...(bar
              ? [
                  wedding.addons.find((a) => a.type === "bar_service") ?? {
                    type: "bar_service",
                    fee: null,
                    minFee: BARTENDER_MIN_USD,
                  },
                ]
              : []),
          ],
        }),
      });
      const json = await res.json().catch(() => ({}));
      setNote(res.ok ? "Saved. Refresh to see it on the card." : json.error || "That didn't save.");
    } catch {
      setNote("No connection. Nothing saved.");
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-parchment px-4 py-1.5 text-sm font-semibold text-ink/70 hover:border-terracotta hover:text-terracotta"
      >
        Edit money
      </button>
    );
  }

  return (
    <div className="mt-3 w-full rounded-xl border border-terracotta bg-parchment/20 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-charcoal">Total ($)</span>
          <input
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            inputMode="decimal"
            className="w-full rounded-lg border border-parchment bg-white px-3 py-2 text-charcoal focus:border-terracotta focus:outline-none"
          />
        </label>
        <div className="flex items-end gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={depositPaid}
              onChange={(e) => setDepositPaid(e.target.checked)}
              className="accent-terracotta"
            />
            Deposit received
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={balancePaid}
              onChange={(e) => setBalancePaid(e.target.checked)}
              className="accent-terracotta"
            />
            Balance settled
          </label>
        </div>
      </div>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-semibold text-charcoal">
          Custom arrangement (replaces the money section of their agreement)
        </span>
        <textarea
          value={customTerms}
          rows={4}
          maxLength={5000}
          onChange={(e) => setCustomTerms(e.target.value)}
          placeholder="Leave empty for standard pricing. Anything typed here appears word for word in their agreement instead of the usual deposit and balance terms."
          className="w-full rounded-lg border border-parchment bg-white px-3 py-2 text-charcoal placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
        />
      </label>
      <div className="mt-3 text-sm">
        <span className="mb-1 block font-semibold text-charcoal">
          Add-ons on this booking (these appear in their service agreement)
        </span>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={acoustic}
              onChange={(e) => setAcoustic(e.target.checked)}
              className="accent-terracotta"
            />
            Live solo acoustic set
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={bar}
              onChange={(e) => setBar(e.target.checked)}
              className="accent-terracotta"
            />
            Bar service
          </label>
        </div>
      </div>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-semibold text-charcoal">
          Art theme (their own invitation art on the guest schedule and hub header)
        </span>
        <select
          value={artTheme}
          onChange={(e) => setArtTheme(e.target.value)}
          className="w-full rounded-lg border border-parchment bg-white px-3 py-2 text-charcoal focus:border-terracotta focus:outline-none"
        >
          <option value="">None, the plain look</option>
          {ART_THEMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-semibold text-ink/60 hover:text-terracotta"
        >
          Close
        </button>
        {note && <span className="text-sm text-ink/70">{note}</span>}
      </div>
    </div>
  );
}
