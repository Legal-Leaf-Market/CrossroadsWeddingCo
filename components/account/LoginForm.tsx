"use client";

import { useState, type FormEvent } from "react";

const field =
  "w-full rounded-lg border border-parchment bg-cream/40 px-3 py-2 text-base font-normal text-ink focus:border-terracotta focus:outline-none";

export default function LoginForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setState("sending");
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Try again in a minute.");
        setState("idle");
        return;
      }
      setMessage(json.message ?? "If that email has an account, a sign-in link is on its way.");
      setState("sent");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-parchment bg-white p-6" role="status">
        <p className="text-ink/80">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-parchment bg-white p-6">
      <label className="grid gap-1 text-sm font-semibold text-charcoal" htmlFor="li-email">
        Email
        <input id="li-email" name="email" type="email" required maxLength={255} autoComplete="email" className={field} />
      </label>
      {error && (
        <p className="text-sm font-semibold text-terracotta-dark" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="justify-self-start rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
      >
        {state === "sending" ? "Sending..." : "Email me a sign-in link"}
      </button>
    </form>
  );
}
