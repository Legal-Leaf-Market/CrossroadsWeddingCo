"use client";

import { useState } from "react";
import { ACTION_LABEL, type Blocker, type CloseAction } from "@/lib/books/accrual";

/**
 * The buttons for one month's close. Which ones appear is decided on the
 * server from the person's seat; the server checks again on every press.
 */
export default function CloseActions({ period, actions, soft }: { period: string; actions: CloseAction[]; soft: Blocker[] }) {
  const [note, setNote] = useState("");
  const [acked, setAcked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blockers, setBlockers] = useState<Blocker[]>([]);

  async function go(action: CloseAction) {
    setBusy(true);
    setError("");
    setBlockers([]);
    try {
      const res = await fetch("/api/app/books/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, action, note, acknowledged: acked }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; blockers?: Blocker[] };
      if (!res.ok) {
        setError(json.error ?? "That didn't go through.");
        setBlockers(json.blockers ?? []);
        return;
      }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  if (actions.length === 0) return <p className="text-sm text-ink/60">Nothing for you to do on this month right now.</p>;
  return (
    <div className="space-y-3">
      {actions.includes("prepare") && soft.length > 0 && (
        <div className="rounded-xl border border-gold bg-gold/10 p-3 text-sm">
          <p className="font-semibold text-charcoal">Acknowledge before preparing</p>
          {soft.map((b) => (
            <label key={b.key} className="mt-1 flex items-start gap-2 text-ink/80">
              <input type="checkbox" className="mt-1" checked={acked.includes(b.key)} onChange={(e) => setAcked((a) => (e.target.checked ? [...a, b.key] : a.filter((k) => k !== b.key)))} />
              <span>
                {b.label} ({b.count})
              </span>
            </label>
          ))}
          <p className="mt-1 text-xs text-ink/55">Say why each is acceptable in the note below.</p>
        </div>
      )}
      <textarea
        className="w-full rounded-lg border border-parchment bg-cream px-3 py-2 text-sm text-charcoal focus:border-terracotta focus:outline-none"
        rows={3}
        placeholder="Note (required for a veto, an escalation, a reopen or a tie-break)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            disabled={busy}
            onClick={() => go(a)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-60 ${
              a.startsWith("veto") || a === "withdraw" || a.includes("keep")
                ? "border border-terracotta text-terracotta hover:bg-terracotta hover:text-cream"
                : "bg-terracotta text-cream hover:bg-terracotta-dark"
            }`}
          >
            {ACTION_LABEL[a]}
          </button>
        ))}
      </div>
      {error && <p className="text-sm font-semibold text-terracotta-dark">{error}</p>}
      {blockers.length > 0 && (
        <ul className="list-inside list-disc text-sm text-ink/80">
          {blockers.map((b) => (
            <li key={b.key}>
              {b.label} ({b.count})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
