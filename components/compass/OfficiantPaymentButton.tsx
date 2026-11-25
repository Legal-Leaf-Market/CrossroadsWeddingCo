"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Mark one part of the officiating invoice received, or undo a mistaken tap.
export default function OfficiantPaymentButton({
  endpoint,
  part,
  paid,
}: {
  endpoint: string;
  part: "deposit" | "balance";
  paid: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payment", part, paid: !paid }),
      });
      if (!res.ok) setError("Didn't save. Try again.");
      else router.refresh();
    } catch {
      setError("No connection.");
    }
    setBusy(false);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        className={
          paid
            ? "rounded-full border border-parchment px-3 py-1 text-xs font-semibold text-ink/60 hover:border-terracotta"
            : "rounded-full bg-terracotta px-3 py-1 text-xs font-semibold text-cream hover:bg-terracotta-dark"
        }
      >
        {busy ? "Saving..." : paid ? "Undo: not received" : `Mark ${part} received`}
      </button>
      {error && <span className="text-xs text-terracotta-dark">{error}</span>}
    </span>
  );
}
