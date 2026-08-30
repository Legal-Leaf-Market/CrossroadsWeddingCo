"use client";

import { useState } from "react";
import type { ContractSection } from "@/lib/contract";
import { VENUE_TIME_ZONE } from "@/lib/site";

// The agreement, plus the accept box. Once accepted it becomes a read-only
// record with the acceptance stamped at the bottom, printable from either
// state (couples ask for a copy, and venues sometimes do too).
export default function ContractView({
  sections,
  endpoint,
  acceptedAt,
  acceptedName,
  demo = false,
}: {
  sections: ContractSection[];
  endpoint: string;
  acceptedAt: string | null;
  acceptedName: string | null;
  demo?: boolean;
}) {
  const [accepted, setAccepted] = useState<{ at: string; name: string } | null>(
    acceptedAt && acceptedName ? { at: acceptedAt, name: acceptedName } : null,
  );
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const stamp = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: VENUE_TIME_ZONE,
      dateStyle: "long",
      timeStyle: "short",
    }).format(d);
  };

  async function accept() {
    const typed = name.trim();
    if (typed.length < 2 || !agreed || busy) return;
    setBusy(true);
    setError("");
    if (demo) {
      setAccepted({ at: new Date().toISOString(), name: typed });
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedName: typed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "That didn't go through. Try again.");
        setBusy(false);
        return;
      }
      setAccepted({ at: json.acceptedAt, name: json.acceptedName });
    } catch {
      setError("No connection. Nothing was submitted; try again.");
    }
    setBusy(false);
  }

  return (
    <div>
      {accepted && (
        <div className="mb-6 rounded-2xl border-2 border-sage bg-sage/10 p-5 print:border print:border-charcoal">
          <p className="font-semibold text-charcoal">Accepted</p>
          <p className="mt-1 text-sm text-ink/70">
            Agreed to by {accepted.name} on {stamp(accepted.at)}. This page is your copy; print
            or save it any time.
          </p>
        </div>
      )}

      <article className="space-y-6">
        {sections.map((section) => (
          <section key={section.heading} className="break-inside-avoid">
            <h2 className="text-lg font-semibold text-charcoal">{section.heading}</h2>
            <div className="mt-2 space-y-2">
              {section.paragraphs.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-ink/80">
                  {p}
                </p>
              ))}
            </div>
          </section>
        ))}
      </article>

      {!accepted && (
        <div className="mt-8 rounded-2xl border-2 border-terracotta bg-white p-6 print:hidden">
          <h2 className="text-lg font-semibold text-charcoal">Accept this agreement</h2>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-semibold text-charcoal">
              Type your full name
            </span>
            <input
              value={name}
              maxLength={255}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg border border-parchment bg-cream px-4 py-2.5 text-charcoal placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
            />
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm text-ink/80">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 accent-terracotta"
            />
            <span>
              I have read this agreement and I agree to it. I understand that typing my name
              here has the same effect as signing it.
            </span>
          </label>
          {error && (
            <p role="alert" className="mt-3 text-sm text-terracotta-dark">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void accept()}
            disabled={busy || name.trim().length < 2 || !agreed}
            className="mt-4 w-full rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-50 sm:w-auto"
          >
            {busy ? "Saving..." : "Accept and continue"}
          </button>
        </div>
      )}
    </div>
  );
}
