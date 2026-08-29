import { NextResponse, type NextRequest } from "next/server";
import { getWeddingByToken } from "@/lib/hub";
import { parsePlaylistId } from "@/lib/hub-constants";
import { getPlaylist, isSpotifyConfigured } from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reads one of the couple's shared playlists so the hub can unfold its
// tracks inline. Gated on the couple's own hub token (this must never be an
// open Spotify proxy) and fails closed with a friendly 501 until the Spotify
// keys exist.
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isSpotifyConfigured()) {
    return NextResponse.json(
      { error: "We're still wiring up our Spotify connection. Track lists will appear here soon." },
      { status: 501 },
    );
  }

  const url = req.nextUrl.searchParams.get("url") ?? "";
  const playlistId = parsePlaylistId(url);
  if (!playlistId) {
    return NextResponse.json({ error: "That link doesn't look like a Spotify playlist." }, { status: 400 });
  }

  try {
    const playlist = await getPlaylist(playlistId);
    return NextResponse.json(playlist, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[spotify] hub playlist fetch failed:", (err as Error).message);
    return NextResponse.json(
      { error: "We couldn't read that playlist. Make sure it's public or unlisted in Spotify." },
      { status: 502 },
    );
  }
}
