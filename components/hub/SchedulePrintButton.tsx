"use client";

// The share token is a read-only credential, so unlike the run sheet's button
// there is nothing here worth masking out of the browser's print header.
export default function SchedulePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      // The corner art can sit behind this button, and a hairline border vanishes
      // against a bright petal, so it carries its own dark backdrop.
      className="rounded-full border border-white/25 bg-black/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur-sm hover:border-white/60 hover:text-white print:hidden"
    >
      Print
    </button>
  );
}
