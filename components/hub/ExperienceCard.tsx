"use client";

import { useState } from "react";
import { hubInput } from "./shared";

// After the wedding, the hub asks the couple how it went. What they write goes
// to us for approval and then onto the page for their event.
export default function ExperienceCard({ token, coupleNames }: { token: string; coupleNames: string }) {
  const [name, setName] = useState(coupleNames);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function send() {
    setState("sending");
    setError("");
    const res = await fetch(`/api/hub/${token}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!res?.ok) {
      setError(json?.error ?? "That didn't go through. Try again.");
      setState("idle");
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <section className="rounded-2xl border-2 border-terracotta bg-white p-6" role="status">
        <h2 className="text-xl text-charcoal">Thank you. That means a lot.</h2>
        <p className="mt-2 text-sm text-ink/70">We&apos;ll read it and put it up on the page for your wedding.</p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border-2 border-terracotta bg-white p-6 shadow-sm">
      <h2 className="text-xl text-charcoal">How was your day?</h2>
      <p className="mt-1 text-sm text-ink/60">
        Tell us about your experience, in your own words. With your OK it goes on the page for your wedding, signed with the name below.
      </p>
      <label className="mt-4 grid gap-1 text-sm font-semibold text-charcoal">
        Signed as
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={hubInput} />
      </label>
      <label className="mt-3 grid gap-1 text-sm font-semibold text-charcoal">
        Your note
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000} className={hubInput} />
      </label>
      {error && (
        <p className="mt-3 text-sm font-semibold text-terracotta-dark" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={send}
        disabled={state === "sending" || message.trim().length < 2 || !name.trim()}
        className="mt-4 rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
      >
        {state === "sending" ? "Sending..." : "Send it to us"}
      </button>
    </section>
  );
}
