"use client";

import { useState, type FormEvent } from "react";
import { BUSINESS_TYPES } from "@/lib/tenant-constants";
import { SRC_STORAGE_KEY } from "@/lib/lead-sources";

const field =
  "w-full rounded-lg border border-parchment bg-cream/40 px-3 py-2 text-base font-normal text-ink focus:border-terracotta focus:outline-none";

export default function SignupForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setState("sending");
    const body: Record<string, unknown> = Object.fromEntries(new FormData(e.currentTarget).entries());
    // First-touch ?src= tag (expo QR, meetup card, ad) that SourceCapture kept.
    try {
      const held = JSON.parse(window.localStorage.getItem(SRC_STORAGE_KEY) ?? "null") as { tag?: string } | null;
      if (held?.tag) body.src = held.tag;
    } catch {
      /* storage blocked: attribution is best-effort */
    }
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Try again in a minute.");
        setState("idle");
        return;
      }
      setMessage(json.message ?? "Check your email for a link to sign in.");
      setState("sent");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-parchment bg-white p-6" role="status">
        <h2 className="text-xl text-charcoal">Almost there.</h2>
        <p className="mt-2 text-ink/70">{message} The link works once and lasts 30 minutes.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-parchment bg-white p-6">
      <label className="grid gap-1 text-sm font-semibold text-charcoal" htmlFor="su-business">
        Business name
        <input id="su-business" name="businessName" required minLength={2} maxLength={120} autoComplete="organization" className={field} />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-charcoal" htmlFor="su-type">
        What you do
        <select id="su-type" name="businessType" required defaultValue="" className={field}>
          <option value="" disabled>
            Pick one
          </option>
          {BUSINESS_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-charcoal" htmlFor="su-name">
          Your name
          <input id="su-name" name="fullName" required minLength={2} maxLength={120} autoComplete="name" className={field} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-charcoal" htmlFor="su-phone">
          Phone <span className="font-normal text-ink/55">(optional)</span>
          <input id="su-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" className={field} />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-semibold text-charcoal" htmlFor="su-email">
        Email
        <input id="su-email" name="email" type="email" required maxLength={255} autoComplete="email" className={field} />
      </label>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <p className="text-sm text-ink/60">No password and no card. We email you a link to sign in.</p>
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
        {state === "sending" ? "Creating your account..." : "Start your free trial"}
      </button>
    </form>
  );
}
