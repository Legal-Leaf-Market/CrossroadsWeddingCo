"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Action = "approve" | "hide" | "feature" | "unfeature";

/** Approve / hide / feature for one note. Every action is reversible. */
export default function ReviewModerationButtons({
  adminKey,
  id,
  state,
  featured,
}: {
  adminKey: string;
  id: string;
  state: "waiting" | "approved" | "hidden";
  featured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function act(action: Action) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/${encodeURIComponent(adminKey)}/reviews/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "That didn't work.");
      } else {
        router.refresh();
      }
    } catch {
      setError("That didn't work.");
    }
    setBusy(false);
  }

  const btn =
    "rounded-full border border-parchment px-3 py-1 text-xs font-medium text-ink/70 hover:border-terracotta hover:text-terracotta disabled:opacity-50";
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {state !== "approved" && (
        <button type="button" disabled={busy} onClick={() => act("approve")} className={btn}>
          {state === "hidden" ? "Show again" : "Approve"}
        </button>
      )}
      {state !== "hidden" && (
        <button type="button" disabled={busy} onClick={() => act("hide")} className={btn}>
          Hide
        </button>
      )}
      {state !== "hidden" && (
        <button type="button" disabled={busy} onClick={() => act(featured ? "unfeature" : "feature")} className={btn}>
          {featured ? "Unpin" : "Pin to top"}
        </button>
      )}
      {error && <span className="text-xs text-terracotta-dark">{error}</span>}
    </span>
  );
}
