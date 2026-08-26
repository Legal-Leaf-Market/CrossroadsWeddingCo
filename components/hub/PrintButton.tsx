"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-terracotta px-4 py-1.5 text-sm font-semibold text-cream hover:bg-terracotta-dark"
    >
      Print or save as PDF
    </button>
  );
}
