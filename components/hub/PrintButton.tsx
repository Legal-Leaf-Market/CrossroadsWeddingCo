"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        // Browsers print the page URL in the default header/footer, which
        // would hand the write-capable hub token to whoever gets the paper.
        // Swap in a tokenless path for the duration of the print dialog.
        const real = window.location.href;
        const restore = () => window.history.replaceState(null, "", real);
        window.addEventListener("afterprint", restore, { once: true });
        window.history.replaceState(null, "", "/hub/runsheet");
        try {
          window.print();
        } finally {
          restore();
        }
      }}
      className="rounded-full bg-terracotta px-4 py-1.5 text-sm font-semibold text-cream hover:bg-terracotta-dark"
    >
      Print or save as PDF
    </button>
  );
}
