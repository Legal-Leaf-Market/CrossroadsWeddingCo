"use client";

import { useState } from "react";

export default function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this link:", url);
        }
      }}
      className="rounded-full border border-parchment px-3 py-1 text-xs font-semibold text-ink/70 hover:border-terracotta hover:text-terracotta-dark"
      aria-label={`Copy ${label}`}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
