"use client";

import { useState } from "react";
import { SectionCard } from "@/components/hub/shared";

const MAX = 10;

/**
 * Who the couple has shared their hub with.
 *
 * Worded carefully, because the obvious wording would be a lie. This is a
 * record of who the couple meant to include, not a gate: the hub link is the
 * only credential, so adding an address here grants nothing on its own and
 * removing one locks nobody out. Saying "invite" and "remove access" would
 * promise an account system this product does not have, and a couple who
 * believed it might share the link freely and then "revoke" it.
 *
 * Deliberately explicit save rather than the debounced autosave the other
 * sections use: a half-typed address is a normal intermediate state, and
 * autosaving it would flicker rows in and out as somebody types.
 */
export default function AccessSection({
  token,
  initial,
  demo = false,
}: {
  token: string;
  initial: string[];
  demo?: boolean;
}) {
  const [emails, setEmails] = useState<string[]>(initial.length ? initial : [""]);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function save(next: string[]) {
    setEmails(next);
    if (demo) {
      setState("saved");
      return;
    }
    setState("saving");
    setError("");
    try {
      const res = await fetch(`/api/hub/${token}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "That didn't save. Try again.");
        setState("error");
        return;
      }
      // The server drops anything unusable, so show what it actually kept
      // rather than what was typed, and keep one empty row to type into.
      if (Array.isArray(json.emails)) {
        setEmails(json.emails.length ? json.emails : [""]);
      }
      setState("saved");
    } catch {
      setError("That didn't save. Try again.");
      setState("error");
    }
  }

  return (
    <SectionCard
      title="Who else can see this hub"
      subtitle="Anyone with the link can open your hub. Keep this list as a note of who you have shared it with, and add anyone helping you plan."
      badge={
        state === "saving" ? (
          <span className="text-xs text-ink/50">Saving...</span>
        ) : state === "saved" ? (
          <span className="text-xs text-sage-dark">Saved</span>
        ) : null
      }
    >
      <div className="space-y-2">
        {emails.map((value, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="email"
              value={value}
              maxLength={255}
              placeholder="planner@example.com"
              aria-label={`Email ${i + 1}`}
              onChange={(e) => setEmails((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
              onBlur={() => void save(emails)}
              className="w-full rounded-lg border border-parchment bg-white px-3 py-2 text-sm text-charcoal focus:border-terracotta focus:outline-none"
            />
            {emails.length > 1 && (
              <button
                type="button"
                onClick={() => void save(emails.filter((_, j) => j !== i))}
                aria-label={`Remove email ${i + 1}`}
                className="shrink-0 rounded-lg border border-parchment px-3 text-ink/50 hover:text-terracotta"
              >
                &times;
              </button>
            )}
          </div>
        ))}
      </div>

      {emails.length < MAX && (
        <button
          type="button"
          onClick={() => setEmails((prev) => [...prev, ""])}
          className="mt-3 rounded-full border border-parchment px-4 py-1.5 text-sm font-medium text-ink hover:border-terracotta hover:text-terracotta"
        >
          + Add another
        </button>
      )}

      {error && <p className="mt-3 text-sm text-terracotta-dark">{error}</p>}

      <p className="mt-4 text-xs text-ink/50">
        Sharing the link is what gives someone access, and this list does not change that. If you
        need to shut a link off, message us and we will issue you a new one.
      </p>
    </SectionCard>
  );
}
