"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const field =
  "min-w-0 rounded-lg border border-parchment bg-cream/40 px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none";

export default function OpeningBalanceForm({
  bankAccountId,
  defaultDate,
  isLiability,
  hasOpening,
}: {
  bankAccountId: string;
  defaultDate: string;
  isLiability: boolean;
  hasOpening: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/app/books/opening-balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankAccountId, date: String(f.get("date") ?? ""), balance: String(f.get("balance") ?? "").trim() }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res?.ok) return setMsg(json.error ?? "Couldn't save that.");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-parchment px-3 py-1 text-xs font-semibold text-ink/65 hover:border-terracotta hover:text-terracotta-dark"
      >
        {hasOpening ? "Change opening balance" : "Set opening balance"}
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="mt-2 grid gap-2 rounded-xl bg-cream/60 p-3 text-sm">
      <p className="text-ink/70">
        From a statement: the {isLiability ? "amount owed" : "balance"} at the END of this date. Pick the day before the first
        transaction here.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" name="date" required defaultValue={defaultDate} aria-label="Statement date" className={field} />
        <input name="balance" required inputMode="decimal" placeholder="0.00" aria-label="Statement balance in dollars" className={`${field} w-32`} />
        <button type="submit" disabled={busy} className="rounded-full bg-terracotta px-4 py-2 text-xs font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60">
          {busy ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-ink/60 hover:text-terracotta-dark">
          Cancel
        </button>
      </div>
      {msg && <p className="text-xs font-semibold text-terracotta-dark" role="status">{msg}</p>}
    </form>
  );
}
