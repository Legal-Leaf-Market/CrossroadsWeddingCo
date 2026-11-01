"use client";

import { useEffect } from "react";
import { cleanSrcTag, SRC_STORAGE_KEY, SRC_TTL_MS } from "@/lib/lead-sources";

// Remembers the first ?src= tag a visitor arrived with (QR code, TV vanity URL,
// Zola profile link) so the booking form can send it even if they book days
// later from a plain visit. Renders nothing. Storage failures are ignored: a
// private window loses attribution, never the booking.
export default function SourceCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      let tag = cleanSrcTag(params.get("src"));
      // Printed business cards resolve to /book?with=<slug> and predate ?src=.
      if (!tag && params.get("with")) tag = "card";
      const now = Date.now();
      const raw = window.localStorage.getItem(SRC_STORAGE_KEY);
      const held = raw ? (JSON.parse(raw) as { tag?: string; at?: number }) : null;
      const fresh = held?.tag && typeof held.at === "number" && now - held.at < SRC_TTL_MS;
      if (tag && !fresh) {
        window.localStorage.setItem(SRC_STORAGE_KEY, JSON.stringify({ tag, at: now }));
      } else if (!fresh && raw) {
        window.localStorage.removeItem(SRC_STORAGE_KEY);
      }
    } catch {
      /* storage blocked: attribution is best-effort */
    }
  }, []);
  return null;
}

/** The stored first-touch tag, or null. */
export function readStoredSrc(): string | null {
  try {
    const raw = window.localStorage.getItem(SRC_STORAGE_KEY);
    if (!raw) return null;
    const held = JSON.parse(raw) as { tag?: string; at?: number };
    if (!held.tag || typeof held.at !== "number" || Date.now() - held.at >= SRC_TTL_MS) return null;
    return cleanSrcTag(held.tag);
  } catch {
    return null;
  }
}
