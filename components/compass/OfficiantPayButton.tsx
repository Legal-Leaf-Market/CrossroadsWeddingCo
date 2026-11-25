"use client";

import { useState } from "react";

// "Pay by card" on the couple's officiating invoice. Asks the server for a
// Stripe Checkout page and goes there; the webhook marks the part received
// when Stripe confirms the payment, so this button never does.
export default function OfficiantPayButton({
  token,
  part,
  amountLabel,
  lockedReason,
  lockedHref,
}: {
  token: string;
  part: "deposit" | "balance";
  amountLabel: string;
  /** Shown greyed out with this reason (hover, and as text for phones) instead of payable. */
  lockedReason?: string;
  /** Where the reason points, e.g. "#accept". */
  lockedHref?: string;
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

  const label = `Pay the ${amountLabel} ${part} by card`;

  if (lockedReason) {
    // Greyed out, never hidden: the couple should see that card payment exists
    // and exactly what unlocks it. The reason is a hover tooltip on a computer
    // and a plain line under the button on a phone, which has no hover.
    return (
      <div className="print:hidden">
        <span className="group relative inline-block" title={lockedReason}>
          <button
            type="button"
            disabled
            aria-disabled="true"
            aria-describedby={`lock-${part}`}
            className="cursor-not-allowed rounded-full bg-parchment px-4 py-2 text-sm font-semibold text-ink/50"
          >
            {label}
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max max-w-[16rem] -translate-x-1/2 rounded-lg bg-charcoal px-3 py-1.5 text-xs font-semibold text-cream shadow group-hover:block"
          >
            {lockedReason}
          </span>
        </span>
        <p id={`lock-${part}`} className="mt-1 text-sm text-ink/70">
          {lockedHref ? (
            <a href={lockedHref} className="font-semibold text-terracotta underline hover:text-terracotta-dark">
              {lockedReason}
            </a>
          ) : (
            lockedReason
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-white hover:bg-terracotta-dark disabled:opacity-60"
      >
        {busy ? "Opening secure checkout..." : label}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-terracotta-dark">
          {error}
        </p>
      )}
    </div>
  );
}
