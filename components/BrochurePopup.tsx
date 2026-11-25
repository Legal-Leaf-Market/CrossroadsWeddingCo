"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BROCHURES, shareUrl } from "@/lib/brochures";

// The floating "share us" pop-up (owner directive 2026-11-03: "make it kind of
// obnoxious ... share with a boss, share with a friend, share with a bride").
// A wiggling pill rides every public page and cycles who to share with; it
// pops its card open once per visit (after a few seconds, or halfway down the
// page) and can be shrunk back to the pill, never removed. It stays off the
// pages where a visitor is mid-task or the page is private: booking, the
// planning hub, admin, live and guest views, and the brochure pages themselves.
const HIDDEN_ON = ["/admin", "/hub", "/live", "/schedule", "/book", "/brochures", "/ig-studio", "/messaging"];

const LINES = [
  "Share with your boss",
  "Share with a bride",
  "Share with a friend",
  "Share with the group chat",
  "Share with HR",
  "Share with the best man",
  "Share with your mom",
  "Share with the party planner",
];

const AUTO_KEY = "cw_share_seen"; // sessionStorage: the card already popped this visit
const AUTO_DELAY_MS = 7000;

export default function BrochurePopup() {
  const pathname = usePathname() ?? "/";
  const hidden = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState(0);
  const [copied, setCopied] = useState(false);
  const pill = useRef<HTMLButtonElement>(null);

  // Cycle the pill's line.
  useEffect(() => {
    if (hidden) return;
    const t = window.setInterval(() => setLine((n) => (n + 1) % LINES.length), 2400);
    return () => window.clearInterval(t);
  }, [hidden]);

  // Pop the card once per visit: after a few seconds, or halfway down the page.
  useEffect(() => {
    if (hidden) return;
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(AUTO_KEY) === "1";
    } catch {
      /* storage blocked: pop anyway, once per page */
    }
    if (seen) return;
    const pop = () => {
      try {
        window.sessionStorage.setItem(AUTO_KEY, "1");
      } catch {
        /* ignore */
      }
      setOpen(true);
      cleanup();
    };
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max > 0.45) pop();
    };
    const timer = window.setTimeout(pop, AUTO_DELAY_MS);
    window.addEventListener("scroll", onScroll, { passive: true });
    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    }
    return cleanup;
  }, [hidden]);

  // Escape shrinks it back to the pill.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        pill.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (hidden) return null;

  const link = shareUrl("all", "popup");
  const text = "Everything Crossroads does, on two brochures (weddings and company events):";

  async function share() {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Crossroads brochures", text, url: link });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${link}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* share sheet closed or clipboard blocked: the brochure links still work */
    }
  }

  return (
    <div className="cw-share-float fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 print:hidden">
      {open && (
        <div
          id="cw-share-card"
          role="dialog"
          aria-modal="false"
          aria-labelledby="cw-share-title"
          className="cw-pop w-[22rem] max-w-full rounded-2xl border-2 border-terracotta bg-cream p-5 text-ink shadow-[0_20px_60px_-15px_rgba(43,38,34,0.55)]"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-terracotta-dark">Psst. Do us a favor?</p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                pill.current?.focus();
              }}
              aria-label="Shrink this"
              className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-full text-charcoal/60 hover:bg-parchment hover:text-charcoal"
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l10 10M14 4L4 14" />
              </svg>
            </button>
          </div>
          <h2 id="cw-share-title" className="mt-1 text-2xl leading-tight text-charcoal">
            Know a bride? A boss? A party waiting to happen?
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed">
            Our whole menu fits on one brochure. Send it to the person who needs a DJ: it&rsquo;s the
            nicest thing you&rsquo;ll do today.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {(["wedding", "corporate"] as const).map((k) => (
              <a
                key={k}
                href={BROCHURES[k].path}
                className="flex min-h-11 flex-col rounded-xl bg-white px-4 py-3 ring-1 ring-charcoal/10 hover:ring-2 hover:ring-terracotta"
              >
                <span className="font-semibold text-charcoal">{BROCHURES[k].short} &rarr;</span>
                <span className="text-sm text-ink/75">{BROCHURES[k].priceLine}</span>
              </a>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={share}
              className="min-h-11 flex-1 rounded-full bg-terracotta px-4 text-sm font-semibold text-cream hover:bg-terracotta-dark"
            >
              {copied ? "Link copied!" : "Share both brochures"}
            </button>
            <a
              href={`sms:?&body=${encodeURIComponent(`${text} ${link}`)}`}
              className="inline-flex min-h-11 items-center rounded-full border border-charcoal/20 bg-white px-4 text-sm font-semibold text-charcoal hover:border-terracotta"
            >
              Text it
            </a>
          </div>
        </div>
      )}

      <button
        ref={pill}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="cw-share-card"
        className="relative inline-flex min-h-12 items-center gap-2 rounded-full bg-terracotta py-2 pl-3 pr-5 text-sm font-bold text-cream shadow-[0_10px_30px_-8px_rgba(193,99,61,0.8)] hover:bg-terracotta-dark"
      >
        {!open && <span aria-hidden="true" className="cw-ping absolute inset-0 rounded-full bg-terracotta" />}
        <span aria-hidden="true" className={`relative flex h-8 w-8 items-center justify-center rounded-full bg-cream text-terracotta ${open ? "" : "cw-wiggle"}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
            <path d="M16 6l-4-4-4 4" />
            <path d="M12 2v13" />
          </svg>
        </span>
        <span className="relative" aria-live="off">
          {open ? "Close" : LINES[line]}
        </span>
      </button>
    </div>
  );
}
