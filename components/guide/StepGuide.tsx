"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { noteFont } from "@/components/guide/noteFont";

// The step-by-step helper (2026-11-12, Jake: "blur out everything but the
// current step ... a handwritten note with an arrow towards the section, think
// clippy, old school"). Our own drawing: a yellow sticky note held by a plain
// paperclip, a handwritten line and a hand-drawn arrow, plus a small note in
// the corner that always says what to do next. It is a guide, never a gate:
// blurred parts are one tap from clear ("Show me everything"), and that choice
// is remembered on this device. Areas opt in with data-zone; the step decides
// which zones blur, in globals.css under [data-guide].

const GuideCtx = createContext<{ on: boolean; step: string; setOn: (v: boolean) => void }>({
  on: false,
  step: "",
  setOn: () => {},
});

const STORE = "cw-step-guide-off";

export function StepGuide({
  step,
  next,
  children,
}: {
  /** Which step is current; "" means nothing to do, so nothing blurs. */
  step: string;
  /** The corner note: what to do and where it is. */
  next?: { label: string; href: string };
  children: ReactNode;
}) {
  const [on, setOnState] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(STORE) === "1") setOnState(false);
    } catch {}
  }, []);
  const setOn = (v: boolean) => {
    setOnState(v);
    try {
      if (v) localStorage.removeItem(STORE);
      else localStorage.setItem(STORE, "1");
    } catch {}
  };
  const active = on && Boolean(step);
  return (
    <GuideCtx.Provider value={{ on: active, step, setOn }}>
      <div data-guide={active ? step : undefined}>{children}</div>
      {next && step && (
        <div className="fixed bottom-4 right-4 z-40 print:hidden">
          {active ? (
            <a
              href={next.href}
              className={`${noteFont.className} block -rotate-2 rounded-sm bg-[#fff2a8] px-4 py-2 text-xl leading-none text-charcoal shadow-[2px_4px_10px_rgba(0,0,0,0.2)] hover:rotate-0`}
            >
              Next: {next.label} ↓
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setOn(true)}
              className="rounded-full border border-charcoal/20 bg-white px-3 py-1.5 text-xs font-semibold text-charcoal shadow"
            >
              Show me what to do
            </button>
          )}
        </div>
      )}
    </GuideCtx.Provider>
  );
}

/** The sticky note, placed right above the area it points at. */
export function GuideNote({ forStep, children }: { forStep: string; children: ReactNode }) {
  const { on, step, setOn } = useContext(GuideCtx);
  if (!on || step !== forStep) return null;
  return (
    <div className="relative mx-auto my-6 max-w-md print:hidden" data-guide-note>
      <div className="relative -rotate-1 rounded-sm bg-[#fff2a8] px-6 pb-4 pt-6 shadow-[2px_4px_10px_rgba(0,0,0,0.18)]">
        {/* A plain paperclip holding the note on. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 60"
          className="absolute -top-5 left-6 h-14 w-6 text-ink/50"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M8 40V12a4 4 0 0 1 8 0v34a7 7 0 0 1-14 0V16" />
        </svg>
        <div className={`${noteFont.className} text-[1.35rem] leading-snug text-charcoal`}>{children}</div>
        <button
          type="button"
          onClick={() => setOn(false)}
          className="mt-3 text-xs font-semibold text-ink/60 underline hover:text-charcoal"
        >
          Show me everything (hide these notes)
        </button>
      </div>
      {/* The hand-drawn arrow down to the step. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 80 70"
        className="mx-auto -mb-2 mt-1 h-16 w-20 text-terracotta"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 4c-6 18 4 30 22 36 8 3 12 9 11 22" />
        <path d="M40 52l11 11 9-13" />
      </svg>
    </div>
  );
}
