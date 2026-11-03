"use client";

// Prints the two faces as two landscape letter pages (the page's own @page
// rule sets the size). Print double-sided, flip on the short edge, fold in thirds.
export default function PrintBrochure({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-11 rounded-full border border-charcoal/20 bg-white px-5 text-sm font-semibold text-charcoal hover:border-terracotta"
    >
      {label}
    </button>
  );
}
