"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const field =
  "w-full rounded-lg border border-parchment bg-cream px-3 py-2 text-base text-charcoal focus:border-terracotta focus:outline-none";

// Set up the officiating agreement for a booking, or edit it until the couple
// accepts. Defaults are Terry's texted terms: $250, $125 deposit, balance
// within 48 hours after the ceremony.
export default function OfficiantSetupForm({
  endpoint,
  initial,
  exists,
}: {
  endpoint: string;
  initial: {
    officiantName: string;
    credential: string;
    rehearsal: string;
    notes: string;
    feeUsd: number;
    depositUsd: number;
    balanceDueHours: number;
  };
  exists: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const body = { action: "save", ...Object.fromEntries(new FormData(e.currentTarget).entries()) };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "That didn't save. Try again.");
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("No connection. Nothing was saved.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border-2 border-terracotta bg-white p-6 print:hidden">
      <h2 className="text-lg font-semibold text-charcoal">{exists ? "Edit the terms" : "Set up the officiant agreement"}</h2>
      <p className="text-sm text-ink/70">
        {exists
          ? "You can change these until the couple accepts. After that the accepted text is frozen."
          : "Creates the agreement and its two-part invoice at a separate link in this couple's hub. Nobody is emailed."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-charcoal">
          Officiant
          <input name="officiantName" defaultValue={initial.officiantName} required minLength={2} maxLength={120} className={field} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-charcoal">
          Authorized to marry in Indiana by <span className="font-normal text-ink/55">(printed if filled)</span>
          <input
            name="credential"
            defaultValue={initial.credential}
            maxLength={300}
            placeholder="e.g. ordained by ..., on ..."
            className={field}
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-semibold text-charcoal">
        Rehearsal <span className="font-normal text-ink/55">(date, time and place, if known)</span>
        <input name="rehearsal" defaultValue={initial.rehearsal} maxLength={300} className={field} />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-charcoal">
        Anything else agreed <span className="font-normal text-ink/55">(optional, printed as written)</span>
        <textarea name="notes" defaultValue={initial.notes} maxLength={1000} rows={2} className={field} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold text-charcoal">
          Fee ($)
          <input name="feeUsd" type="number" min={0} step="0.01" defaultValue={initial.feeUsd} required className={field} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-charcoal">
          Deposit ($)
          <input name="depositUsd" type="number" min={0} step="0.01" defaultValue={initial.depositUsd} required className={field} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-charcoal">
          Balance due, hours after
          <input name="balanceDueHours" type="number" min={0} step={1} defaultValue={initial.balanceDueHours} required className={field} />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-terracotta-dark">
          {error}
        </p>
      )}
      {saved && <p className="text-sm font-semibold text-sage-dark">Saved.</p>}
      <button
        type="submit"
        disabled={busy}
        className="justify-self-start rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
      >
        {busy ? "Saving..." : exists ? "Save changes" : "Create agreement"}
      </button>
    </form>
  );
}
