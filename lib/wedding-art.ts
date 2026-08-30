/**
 * Per-wedding decorative art for the guest-facing order of events.
 *
 * Couples arrive with an invitation suite they have already sent out, and the
 * guest page reads better when it looks like it came from the same set. Art is
 * committed under public/wedding-art/<slug>/ and keyed here by share token, so
 * a wedding without art simply renders the plain dark page.
 *
 * Entries are added only once the files are actually in the repo: a missing
 * PNG would render as a broken image on a page guests see.
 */
export type WeddingArt = {
  /** Directory under /public, no trailing slash. */
  dir: string;
  /** Tall floral column hugging the left edge. */
  left: string;
  /** Its counterpart on the right. Falls back to a mirrored left. */
  right?: string;
  /** Small ornament under the title. */
  sprig?: string;
  /**
   * True when the PNGs carry a real alpha channel. When false the art was
   * delivered on pure black and is composited with mix-blend-mode: screen,
   * which drops the black and keeps the colour.
   */
  transparent: boolean;
};

const ART_BY_SHARE_TOKEN: Record<string, WeddingArt> = {
  // Kat & Tanis, 2026-11-07: waiting on the files described in
  // content/wedding-art/ASSET_BRIEF_kat-tanis.md.
};

export function weddingArt(shareToken: string | null): WeddingArt | null {
  if (!shareToken) return null;
  return ART_BY_SHARE_TOKEN[shareToken] ?? null;
}
