/**
 * Per-wedding decorative art for the guest-facing order of events.
 *
 * Couples arrive with an invitation suite they have already sent to guests,
 * and the guest page reads better when it looks like it came from the same
 * set. Art lives under public/wedding-art/<slug>/ and is keyed here by share
 * token, so a wedding without art simply renders the plain dark page.
 *
 * Entries go in only once the files are actually in the repo: a missing PNG
 * would render as a broken image on a page guests see.
 */
export type WeddingArt = {
  /** Directory under /public, no trailing slash. */
  dir: string;
  /**
   * Four corner pieces. Corners rather than full-height columns because the
   * page is as tall as the couple's timeline is long, and stretching one
   * painting over that would distort it.
   */
  corners: {
    leftTop: string;
    leftBottom: string;
    rightTop: string;
    rightBottom: string;
  };
  /** Small ornament under the title. */
  sprig?: string;
  /** Wider ornament above the footer. */
  footer?: string;
};

const ART_BY_SHARE_TOKEN: Record<string, WeddingArt> = {
  // Kat & Tanis, 2026-11-07, Forge on 4th. Watercolor florals matched to their
  // invitation suite; corners cut from the delivered 900x2400 columns, which
  // are kept alongside so they can be re-cut.
  "9c3eb87495740cceaf2f5622368cea9ecbfc009a9255713e": {
    dir: "/wedding-art/kat-tanis",
    corners: {
      leftTop: "corner-left-top.png",
      leftBottom: "corner-left-bottom.png",
      rightTop: "corner-right-top.png",
      rightBottom: "corner-right-bottom.png",
    },
    sprig: "sprig-divider.png",
    footer: "moons-divider.png",
  },
};

export function weddingArt(shareToken: string | null): WeddingArt | null {
  if (!shareToken) return null;
  return ART_BY_SHARE_TOKEN[shareToken] ?? null;
}
