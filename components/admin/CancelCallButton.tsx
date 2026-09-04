"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Cancels a booked call. Soft: the row stays, the slot reopens. */
export default function CancelCallButton({
  adminKey,
  appointmentId,
}: {
  adminKey: string;
  appointmentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await fetch(`/api/admin/${encodeURIComponent(adminKey)}/hours`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId }),
      });
      router.refresh();
    } finally {
      setBusy(false);
      setArmed(false);
    }
  }

  // Two taps, because the person on the other end of this row is expecting a
  // phone call and nothing here tells them it was cancelled.
  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-sm text-ink/50 underline decoration-parchment underline-offset-2 hover:text-terracotta"
      >
        Cancel
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-sm">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="font-semibold text-terracotta underline underline-offset-2 disabled:opacity-60"
      >
        {busy ? "Cancelling..." : "Really cancel"}
      </button>
      <button type="button" onClick={() => setArmed(false)} className="text-ink/50">
        Keep
      </button>
    </span>
  );
}
