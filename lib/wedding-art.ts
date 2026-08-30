/**
 * Per-wedding decorative art for the guest-facing order of events.
 *
 * Couples arrive with an invitation suite they have already sent to guests,
 * and the guest page reads better when it looks like it came from the same
 * set. Art lives under public/wedding-art/<slug>/ and is keyed here by that
 * slug, which is stored on the wedding row (weddings.art_theme). A wedding
 * with no theme simply renders the plain dark page.
 *
 * Keyed by slug and NOT by share token on purpose: this repository is public,
 * and a share token is a live read credential for that couple's schedule.
 * Nothing that identifies a client belongs in here, only folder names.
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

export const ART_BY_THEME: Record<string, WeddingArt> = {
  // Watercolor florals on near-black. Corners cut from the delivered 900x2400
  // columns, which are kept alongside so they can be re-cut.
  "kat-tanis": {
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

/** Slugs the owner dashboard can offer. */
export const ART_THEMES = Object.keys(ART_BY_THEME);
