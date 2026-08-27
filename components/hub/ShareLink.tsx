"use client";

import { useState } from "react";

/** The vendor share URL with a copy button; falls back to select-and-copy UIs. */
export default function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        readOnly
        aria-label="Read-only live link for your vendors"
        className="min-w-0 flex-1 rounded-lg border border-parchment bg-white px-3 py-2 text-xs text-ink/70"
        value={url}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard can be blocked; the input stays selectable.
          }
        }}
        className="min-h-10 rounded-full border border-terracotta px-4 py-1.5 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
