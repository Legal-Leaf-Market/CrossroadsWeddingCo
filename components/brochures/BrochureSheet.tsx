"use client";

import { useLayoutEffect, useRef, useState } from "react";

const FACE_W = 1056; // letter landscape at 96 px/in
const FACE_H = 816;

// One brochure face. The markup is drawn at print size and scaled to the
// column on screen, so the page shows exactly what prints. In print the
// scale comes off (see .brochure-sheet in globals.css) and each face fills
// one landscape letter page. The html is our own static markup from
// lib/brochure-html.ts, never visitor input.
export default function BrochureSheet({ html, label }: { html: string; label: string }) {
  const box = useRef<HTMLElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / FACE_W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <figure
      ref={box}
      aria-label={label}
      className="brochure-sheet relative m-0 w-full overflow-hidden rounded-md bg-white shadow-[0_10px_40px_-12px_rgba(43,38,34,0.35)] ring-1 ring-charcoal/10"
      style={{ aspectRatio: `${FACE_W} / ${FACE_H}` }}
    >
      <div
        className="brochure-sheet-inner absolute left-0 top-0 origin-top-left"
        style={{
          width: FACE_W,
          height: FACE_H,
          transform: `scale(${scale ?? 1})`,
          visibility: scale === null ? "hidden" : "visible",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}
