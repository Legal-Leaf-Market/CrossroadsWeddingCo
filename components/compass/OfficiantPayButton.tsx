"use client";

import { useState } from "react";

// "Pay by card" on the couple's officiating invoice. Asks the server for a
// Stripe Checkout page and goes there; the webhook marks the part received
// when Stripe confirms the payment, so this button never does.
export default function OfficiantPayButton({
  token,
  part,
  amountLabel,
}: {
  token: string;
  part: "deposit" | "balance";
  amountLabel: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/hub/${token}/officiant/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && body.url) {
        window.location.assign(body.url);
        return;
      }
      setError(body.error ?? "Card payment could not start. Nothing was charged.");
    } catch {
      setError("Card payment could not start. Check your connection and try again. Nothing was charged.");
    }
    setBusy(false);
  }

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-white hover:bg-terracotta-dark disabled:opacity-60"
      >
        {busy ? "Opening secure checkout..." : `Pay the ${amountLabel} ${part} by card`}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-terracotta-dark">
          {error}
        </p>
      )}
    </div>
  );
}
