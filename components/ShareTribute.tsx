"use client";

import { useState } from "react";

/**
 * Share a page: the phone's own share sheet where there is one, else copy the
 * link. Says "Shared" or "Link copied" only after it actually happened, and
 * says nothing when someone cancels the share sheet.
 */
export default function ShareTribute({ url, title, text }: { url: string; title: string; text: string }) {
  const [msg, setMsg] = useState("");

  async function share() {
    setMsg("");
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ url, title, text });
        setMsg("Shared. Thank you.");
        return;
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setMsg("Link copied. Paste it anywhere.");
    } catch {
      setMsg(`Copy this link: ${url}`);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={share}
        className="rounded-full bg-[#1f2a44] px-6 py-3 text-sm font-semibold text-[#f6f0e4] hover:bg-[#2c3b5f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a8834f]"
      >
        Share this tribute
      </button>
      <p className="text-sm text-[#4a443b]" role="status" aria-live="polite">
        {msg}
      </p>
    </div>
  );
}
