"use client";

import { useRef } from "react";

export default function PrintButton() {
  // Captured on the first click, before any masking; later clicks reuse it,
  // so printing again while the URL is still masked can never capture the
  // masked path as the "real" URL and strand the page on it.
  const realHref = useRef<string | null>(null);

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
        if (realHref.current === null) realHref.current = window.location.href;
        const real = realHref.current;
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
