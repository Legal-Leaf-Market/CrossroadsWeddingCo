"use client";

import { useState, type FormEvent } from "react";
import { RELATIONS } from "@/lib/review-constants";

const field =
  "w-full rounded-lg border border-parchment bg-white px-4 py-2.5 text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none";

/** The public sign-the-board form. Name and a note; no email, no login. */
export default function ReviewForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          relation: String(form.get("relation") ?? "Other"),
          message: String(form.get("message") ?? ""),
          website: String(form.get("website") ?? ""),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "That didn't go through. Try again.");
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch {
      setError("That didn't go through. Check your connection and try again.");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-parchment bg-white p-6" role="status">
        <h3 className="text-xl text-charcoal">Thank you. We got it.</h3>
        <p className="mt-2 text-ink/70">
          We read every note before it goes up, so yours will show here once one of us has seen it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-parchment bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-charcoal" htmlFor="rv-name">
          Your name
          <input id="rv-name" name="name" required maxLength={80} autoComplete="name" className={field} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-charcoal" htmlFor="rv-relation">
          You&apos;re writing about
          <select id="rv-relation" name="relation" defaultValue="Our wedding" className={field}>
            {RELATIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm font-semibold text-charcoal" htmlFor="rv-message">
        Your note
        <textarea id="rv-message" name="message" required minLength={2} maxLength={2000} rows={5} className={field} />
      </label>
      {/* Honeypot: hidden from people and screen readers, filled by bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="rv-website">Website</label>
        <input id="rv-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <p className="text-sm text-ink/60">
        No email or account needed. Your name and note show on this page once we&apos;ve read it.
      </p>
      {error && (
        <p className="text-sm font-semibold text-terracotta-dark" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "sending"}
        className="justify-self-start rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
      >
        {status === "sending" ? "Sending..." : "Sign the board"}
      </button>
    </form>
  );
}
