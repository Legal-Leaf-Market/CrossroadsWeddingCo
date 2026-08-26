"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        // Browsers print the page URL in the default header/footer, which
        // would hand the write-capable hub token to whoever gets the paper.
        // Swap in a tokenless path until printing finishes. Restoring in a
        // finally would defeat the mask where window.print() returns before
        // the dialog (Safari), so restoration waits for afterprint, with a
        // timeout fallback in case that event never fires.
        const real = window.location.href;
        let restored = false;
        const restore = () => {
          if (restored) return;
          restored = true;
          window.history.replaceState(null, "", real);
        };
        window.addEventListener("afterprint", restore, { once: true });
        window.setTimeout(restore, 120_000);
        window.history.replaceState(null, "", "/hub/runsheet");
        window.print();
      }}
      className="rounded-full bg-terracotta px-4 py-1.5 text-sm font-semibold text-cream hover:bg-terracotta-dark"
    >
      Print or save as PDF
    </button>
  );
}
