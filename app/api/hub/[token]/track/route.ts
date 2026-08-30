import { NextResponse, type NextRequest } from "next/server";
import { getWeddingByToken } from "@/lib/hub";
import { getTrack, isSpotifyConfigured } from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Names the song behind a link the couple pasted, so the moment row (and the
// printed run sheet) carries the track and artist rather than a bare URL.
// Gated on the couple's own hub token, and fails closed like every other
// Spotify-backed route.
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isSpotifyConfigured()) {
    return NextResponse.json({ error: "Spotify isn't connected yet." }, { status: 501 });
  }

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9]{1,40}$/.test(id)) {
    return NextResponse.json({ error: "Bad track id." }, { status: 400 });
  }

  try {
    const track = await getTrack(id);
    if (!track) return NextResponse.json({ error: "No such track." }, { status: 404 });
    return NextResponse.json(track, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[spotify] hub track fetch failed:", (err as Error).message);
    return NextResponse.json({ error: "Couldn't reach Spotify." }, { status: 502 });
  }
}
