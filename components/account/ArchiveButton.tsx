"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Hide or restore a booking. Nothing is deleted; the client's links keep working. */
export default function ArchiveButton({ bookingId, archived }: { bookingId: string; archived: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/app/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !archived }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("Couldn't change that. Try again.");
      return;
    }
    router.push(archived ? `/app/bookings/${bookingId}` : "/app");
    router.refresh();
  }
  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="rounded-full border border-parchment px-4 py-2 text-sm font-semibold text-ink/70 hover:border-terracotta hover:text-terracotta-dark disabled:opacity-60"
      >
        {archived ? "Restore to the list" : "Archive"}
      </button>
      {error && <p className="mt-2 text-sm text-terracotta-dark" role="alert">{error}</p>}
    </div>
  );
}
