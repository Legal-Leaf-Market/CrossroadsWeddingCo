"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Shown when the couple accepted money terms that have since changed, so their
// signed copy disagrees with the invoice. Reissuing clears their acceptance and
// regenerates the agreement from the booking's current money; they accept it
// again in their hub. The old signed copy is kept in the audit log.
export default function ReissueContractButton({
  adminKey,
  weddingId,
}: {
  /** The secret path segment, not the "/admin/<key>" base path. */
  adminKey: string;
  weddingId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function reissue() {
    if (busy) return;
    const ok = window.confirm(
      "Reissue this agreement with the current money and services? The couple's acceptance is cleared and they accept the updated agreement in their hub. Your Crossroads signature stays.",
    );
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/${encodeURIComponent(adminKey)}/contract/${weddingId}?reissue=1`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "That didn't go through. Try again.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("No connection. Nothing was changed; try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border-2 border-terracotta bg-terracotta/10 px-4 py-3 text-sm text-ink print:hidden">
      <p className="font-semibold text-charcoal">This signed agreement is out of date.</p>
      <p className="mt-1">
        The money or services on this booking changed after the couple accepted, so the agreement
        below no longer matches their invoice. Reissue it to update the agreement to the current
        terms and send it back to the couple to accept.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-terracotta-dark">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void reissue()}
        disabled={busy}
        className="mt-3 w-full rounded-full bg-terracotta px-6 py-2.5 font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-50 sm:w-auto"
      >
        {busy ? "Reissuing..." : "Reissue with current terms"}
      </button>
    </div>
  );
}
