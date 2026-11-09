"use client";

import { useState, type FormEvent } from "react";

export default function FindMyWedding() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setBusy(true);
    setError("");
    const res = await fetch("/api/my-wedding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { message?: string; error?: string };
    setBusy(false);
    if (!res?.ok) return setError(json.error ?? "That didn't work. Try again in a minute.");
    setDone(json.message ?? "Check your inbox.");
  }

  if (done) {
    return (
      <p className="rounded-2xl border border-parchment bg-white p-6 text-ink/80" role="status">
        {done}
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-parchment bg-white p-6">
      <label className="grid gap-1 text-sm font-semibold text-charcoal">
        The email on your booking
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          maxLength={255}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-parchment bg-cream/40 px-3 py-2 text-base font-normal text-ink focus:border-terracotta focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="justify-self-start rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
      >
        {busy ? "Sending..." : "Email me my link"}
      </button>
      {error && (
        <p className="text-sm font-semibold text-terracotta-dark" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
