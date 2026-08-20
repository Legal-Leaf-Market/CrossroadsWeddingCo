import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Same-origin proxy for a single Unsplash photo, restricted to that one
 * hostname. Two reasons this exists instead of pointing the browser straight
 * at images.unsplash.com:
 *   - the PNG export draws the photo into a canvas, and a cross-origin image
 *     without permissive CORS headers taints that canvas and blocks toBlob();
 *     routing through our own origin removes the cross-origin step entirely.
 *   - the hostname allowlist below is the only thing standing between this
 *     route and being an open SSRF proxy, so it is not optional.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "missing url" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (parsed.hostname !== "images.unsplash.com") {
    return NextResponse.json({ error: "host not allowed" }, { status: 400 });
  }

  const res = await fetch(parsed.toString());
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }

  return new NextResponse(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") || "image/jpeg",
      "cache-control": "public, max-age=86400, immutable",
    },
  });
}
