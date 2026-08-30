"use client";

// The share token is a read-only credential, so unlike the run sheet's button
// there is nothing here worth masking out of the browser's print header.
export default function SchedulePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full border border-white/25 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 hover:border-white/60 hover:text-white print:hidden"
    >
      Print
    </button>
  );
}
