import { NextResponse } from "next/server";
import { TOKEN_RE } from "@/lib/hub-constants";
import { SITE_NAME } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-wedding PWA manifest: start_url and scope point at the couple's own hub,
// so the pinned home-screen icon opens their planning hub, not the marketing
// homepage. Only the token's format is checked; the manifest contains nothing
// but the path the requester already knows.
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(
    {
      name: `${SITE_NAME} planning hub`,
      short_name: "Crossroads",
      description: "Your wedding planning hub: timeline, music, and the names we say out loud.",
      id: `/hub/${token}`,
      start_url: `/hub/${token}`,
      scope: `/hub/${token}`,
      display: "standalone",
      background_color: "#faf5ec",
      theme_color: "#faf5ec",
      icons: [
        { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "X-Robots-Tag": "noindex",
        "Cache-Control": "private, max-age=3600",
      },
    },
  );
}
