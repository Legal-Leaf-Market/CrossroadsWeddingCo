"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Hide a booking from the dashboard, or bring it back.
 *
 * Single click, no confirmation, deliberately. Archiving is reversible and the
 * restore screen is one link away, so a confirm dialog would tax the common
 * case (clearing a pile of test bookings) to protect against something that
 * costs one click to undo. The irreversible version of this button does not
 * exist on purpose: nothing here deletes a wedding.
 */
export default function ArchiveButton({
  adminKey,
  weddingId,
  archived,
}: {
  /** The secret path segment, not the "/admin/<key>" base path. */
  adminKey: string;
  weddingId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/${encodeURIComponent(adminKey)}/archive/${weddingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !archived }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "That didn't work.");
        setBusy(false);
        return;
      }
      // Server-rendered lists, so re-fetch rather than splice locally: the row
      // has to move between two pages, not just change colour.
      router.refresh();
    } catch {
      setError("That didn't work.");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="rounded-full border border-parchment px-3 py-1 text-xs font-medium text-ink/70 hover:border-terracotta hover:text-terracotta disabled:opacity-50"
      >
        {busy ? "..." : archived ? "Restore" : "Archive"}
      </button>
      {error && <span className="text-xs text-terracotta-dark">{error}</span>}
    </span>
  );
}
