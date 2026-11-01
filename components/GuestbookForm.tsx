"use client";

import { useState, type FormEvent } from "react";
import { GUESTBOOK_MESSAGE_MAX, GUESTBOOK_NAME_MAX, GUESTBOOK_RELATIONS } from "@/lib/guestbook-constants";

const inputClass =
  "w-full rounded-lg border border-parchment bg-white px-4 py-2.5 text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none";

// Sign the guestbook: a name and a few words, no account. Entries are held for
// the owner's approval, and the confirmation says so, so nobody wonders why
// their note isn't on the page yet.
export default function GuestbookForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("gbName"),
          relation: data.get("gbRelation") ?? "",
          message: data.get("gbMessage"),
          website: data.get("website") ?? "",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="rounded-2xl border border-parchment bg-white p-6">
        <p className="text-lg text-charcoal">Thank you! Your note is in.</p>
        <p className="mt-1 text-ink/70">We read every entry before it goes up, so it will appear here shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-parchment bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-charcoal">Your name</span>
          <input id="gbName" name="gbName" required maxLength={GUESTBOOK_NAME_MAX} className={inputClass} placeholder="How you'd like it signed" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-charcoal">
            You were <span className="font-normal text-ink/50">(optional)</span>
          </span>
          <select id="gbRelation" name="gbRelation" className={inputClass} defaultValue="">
            <option value="">Pick one</option>
            {GUESTBOOK_RELATIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-charcoal">Your note</span>
        <textarea id="gbMessage" name="gbMessage" required rows={4} maxLength={GUESTBOOK_MESSAGE_MAX} className={inputClass} placeholder="What was the night like?" />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {status === "error" && <p className="text-sm font-semibold text-terracotta">{error}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={status === "sending"} className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60">
          {status === "sending" ? "Sending..." : "Sign the guestbook"}
        </button>
        <p className="text-xs text-ink/50">No account needed. Every note is read before it goes up.</p>
      </div>
    </form>
  );
}
