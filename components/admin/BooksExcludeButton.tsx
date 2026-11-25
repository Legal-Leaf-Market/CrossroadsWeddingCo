"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * "Not a real job": leave a test booking out of the books, with a reason, or
 * put it back. Nothing is deleted and every change is audited (lib/admin.ts
 * setBooksExcluded). A reason is asked for inline, not in a browser dialog.
 */
export default function BooksExcludeButton({ adminKey, weddingId, excluded }: { adminKey: string; weddingId: string; excluded: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(exclude: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/${encodeURIComponent(adminKey)}/books-exclude/${weddingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exclude, reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "That didn't work.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("That didn't work.");
      setBusy(false);
    }
  }

  if (excluded) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => send(false)} disabled={busy} className="rounded-full border border-parchment px-3 py-1 text-xs font-medium text-ink/70 hover:border-terracotta hover:text-terracotta disabled:opacity-50">
          {busy ? "Saving..." : "Put back in the books"}
        </button>
        {error && <span className="text-xs text-terracotta-dark">{error}</span>}
      </span>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-ink/55 underline decoration-parchment underline-offset-2 hover:text-terracotta">
        Not a real job?
      </button>
    );
  }
  return (
    <span className="mt-1 flex flex-wrap items-center gap-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        placeholder="Why, e.g. a test booking I made"
        className="min-w-0 flex-1 rounded-lg border border-parchment bg-white px-2 py-1 text-xs text-charcoal"
        aria-label="Why this isn't a real job"
      />
      <button type="button" onClick={() => send(true)} disabled={busy || reason.trim().length < 10} className="rounded-full bg-charcoal px-3 py-1 text-xs font-semibold text-cream disabled:opacity-50">
        {busy ? "Saving..." : "Leave out of the books"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink/55">
        Cancel
      </button>
      {error && <span className="w-full text-xs text-terracotta-dark">{error}</span>}
    </span>
  );
}
