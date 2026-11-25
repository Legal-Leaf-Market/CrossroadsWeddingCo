"use client";

import { useState } from "react";
import type { AdminWedding } from "@/lib/admin";
import { DETAIL_PROMPT, LEAD_SOURCES, leadSourceLabel, type LeadSource } from "@/lib/lead-sources";

// "Found us via" on a booking card, editable by the owner (2026-11-25, Jacob:
// bookings that came through WeddingPro before the "How did you find us?"
// question existed need The Knot or WeddingWire on them). Saves only the
// source and its detail: never the money, the agreement or the books.
export default function LeadSourceEditor({
  wedding,
  basePath,
  demo = false,
}: {
  wedding: AdminWedding;
  basePath: string;
  demo?: boolean;
}) {
  const [saved, setSaved] = useState({
    source: wedding.leadSource ?? "",
    detail: wedding.leadSourceDetail ?? "",
  });
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(saved.source);
  const [detail, setDetail] = useState(saved.detail);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const detailPrompt = DETAIL_PROMPT[source as LeadSource];

  async function save() {
    setBusy(true);
    setNote("");
    const next = { source, detail: detailPrompt ? detail.trim() : "" };
    if (demo) {
      setSaved(next);
      setOpen(false);
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/${basePath.split("/").pop()}/wedding/${wedding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadSource: next.source, leadSourceDetail: next.detail }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaved(next);
        setOpen(false);
      } else {
        setNote(json.error || "That didn't save.");
      }
    } catch {
      setNote("No connection. Nothing saved.");
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <p className="mt-2 text-xs text-ink/50">
        Found us via:{" "}
        {leadSourceLabel(saved.source) ?? "not answered"}
        {saved.detail && ` (${saved.detail})`}
        {wedding.leadSrcTag && ` · link tag: ${wedding.leadSrcTag}`}{" "}
        <button
          type="button"
          onClick={() => {
            setSource(saved.source);
            setDetail(saved.detail);
            setNote("");
            setOpen(true);
          }}
          className="font-semibold text-terracotta underline-offset-2 hover:underline"
        >
          Change
        </button>
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-2">
        <span className="text-xs font-semibold text-charcoal">Found us via</span>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-lg border border-parchment bg-white px-2 py-1 text-charcoal focus:border-terracotta focus:outline-none"
        >
          <option value="">Not answered</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {detailPrompt && (
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          maxLength={200}
          placeholder={detailPrompt}
          aria-label={detailPrompt}
          className="min-w-0 flex-1 rounded-lg border border-parchment bg-white px-2 py-1 text-charcoal placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
        />
      )}
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="rounded-full bg-terracotta px-4 py-1 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-50"
      >
        {busy ? "Saving..." : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm font-semibold text-ink/60 hover:text-terracotta"
      >
        Cancel
      </button>
      {note && <span className="text-sm text-ink/70">{note}</span>}
    </div>
  );
}
