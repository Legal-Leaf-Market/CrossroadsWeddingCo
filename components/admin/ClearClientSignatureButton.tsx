"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Clears the couple's signature when it was entered by mistake on their behalf,
// so the accept box comes back in their hub. Asks first; the cleared signature
// is kept in the audit log on the server.
export default function ClearClientSignatureButton({
  adminKey,
  weddingId,
  signedName,
}: {
  /** The secret path segment, not the "/admin/<key>" base path. */
  adminKey: string;
  weddingId: string;
  signedName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function clear() {
    if (busy) return;
    const ok = window.confirm(
      `Clear the couple's signature ("${signedName}")? Their hub will show the agreement as unsigned so they can sign it themselves. Your Crossroads signature stays.`,
    );
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/${encodeURIComponent(adminKey)}/contract/${weddingId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "That didn't go through. Try again.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("No connection. Nothing was cleared; try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-parchment bg-white p-6 print:hidden">
      <h2 className="text-lg font-semibold text-charcoal">Signed by mistake?</h2>
      <p className="mt-1 text-sm text-ink/70">
        If someone other than the couple accepted this agreement, clear their signature here. The
        agreement goes back to unsigned in their hub, and they can sign it when it suits them.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-terracotta-dark">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void clear()}
        disabled={busy}
        className="mt-4 w-full rounded-full border-2 border-terracotta px-6 py-3 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream disabled:opacity-50 sm:w-auto"
      >
        {busy ? "Clearing..." : "Clear client signature"}
      </button>
    </div>
  );
}
