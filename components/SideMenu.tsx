"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MENU_SECTIONS } from "@/lib/nav";

// The side menu: a drawer from the right on every width. On a phone it is the
// only menu (the top links need lg, 1024px); on desktop it sits beside the
// top bar and holds every page, including the ones the bar has no room for.
// Width: 88vw on a phone, never past 360px, so the page behind stays visible
// as a strip you can tap to close.
export default function SideMenu() {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  // The drawer renders on <body>, not inside the header: the header's
  // backdrop-blur makes it the containing block for anything `fixed` in it,
  // which sized the drawer to the 64px bar instead of the screen.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key !== "Tab" || !panel.current) return;
      const items = panel.current.querySelectorAll<HTMLElement>("a, button");
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      button.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="side-menu"
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-parchment px-3 text-sm font-semibold text-charcoal hover:border-terracotta hover:text-terracotta"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <span>Menu</span>
      </button>

      {/* One fixed layer that clips the panel: a closed drawer parked off
          screen by a transform still widens the page (measured: 360px of
          sideways scroll on every page) unless something clips it. */}
      {mounted && createPortal(
      <div className={`fixed inset-0 z-[60] overflow-hidden ${open ? "" : "pointer-events-none"}`}>
      <div
        className={`absolute inset-0 bg-charcoal/50 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        id="side-menu"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        aria-hidden={!open}
        inert={!open}
        className={`absolute inset-y-0 right-0 flex w-[88vw] max-w-[360px] flex-col bg-cream transition-transform duration-200 ${open ? "translate-x-0 shadow-2xl" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-parchment px-6 py-4">
          <span className="text-base font-semibold text-charcoal">Menu</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="grid h-10 w-10 place-items-center rounded-full text-charcoal hover:bg-parchment"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-6 py-5" aria-label="All pages">
          {MENU_SECTIONS.map((s) => (
            <div key={s.title} className="mb-6 last:mb-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-terracotta">{s.title}</p>
              <ul className="mt-2">
                {s.links.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-2 py-2 text-[15px] text-ink hover:bg-parchment hover:text-charcoal"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-parchment px-6 py-4">
          <a
            href="/book"
            className="block rounded-full bg-terracotta px-5 py-3 text-center text-sm font-semibold text-cream hover:bg-terracotta-dark"
          >
            Check your date
          </a>
        </div>
      </div>
      </div>,
      document.body,
      )}
    </>
  );
}
