import { createHash } from "node:crypto";
import { ART_BY_THEME, type WeddingArt } from "@/lib/wedding-art";

/**
 * Server-only half of the art lookup, split from lib/wedding-art.ts because
 * that module is imported by a client component and node:crypto must never
 * reach the browser bundle.
 *
 * Two ways a wedding gets its art:
 *   1. weddings.art_theme, set from the owner dashboard. The way forward:
 *      self-serve, no deploy needed.
 *   2. This map, for weddings already set up before the column existed. The
 *      key is the SHA-256 of the share token, never the token itself. This
 *      repository is public and a share token is a live read credential, but
 *      a hash of 192 bits of entropy publishes nothing anyone can use, and it
 *      names no client.
 */
const THEME_BY_SHARE_TOKEN_HASH: Record<string, string> = {
  f861064087c8daf75df6108bd75a0e4f18f97fc66203baa71012c68af5e981f2: "kat-tanis",
};

export function resolveWeddingArt(
  artTheme: string | null | undefined,
  shareToken: string | null | undefined,
): WeddingArt | null {
  if (artTheme) return ART_BY_THEME[artTheme] ?? null;
  if (!shareToken) return null;
  const hash = createHash("sha256").update(shareToken).digest("hex");
  const theme = THEME_BY_SHARE_TOKEN_HASH[hash];
  return theme ? (ART_BY_THEME[theme] ?? null) : null;
}
