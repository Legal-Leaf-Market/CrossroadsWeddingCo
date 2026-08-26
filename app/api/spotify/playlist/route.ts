import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPlaylist, isSpotifyConfigured, parsePlaylistId } from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Internal tool: reads a couple's shared playlist so it can be ingested into
// playlist_curations. Admin-token gated — without the gate this would be an
// open Spotify proxy. The Phase 2 portal will call this server-side with the
// couple's own magic-link session instead.
export async function POST(req: NextRequest) {
  if (!isSpotifyConfigured()) {
    return NextResponse.json(
      { error: "Spotify is not configured yet — set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET" },
      { status: 501 },
    );
  }
  const adminToken = process.env.ADMIN_API_TOKEN;
  if (!adminToken || req.headers.get("x-admin-token") !== adminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = z.object({ url: z.string().max(500) }).safeParse(raw);
  const playlistId = parsed.success ? parsePlaylistId(parsed.data.url) : null;
  if (!playlistId) {
    return NextResponse.json({ error: "Not a Spotify playlist link" }, { status: 400 });
  }

  try {
    const playlist = await getPlaylist(playlistId);
    return NextResponse.json(playlist);
  } catch (err) {
    console.error("[spotify] playlist fetch failed:", (err as Error).message);
    return NextResponse.json({ error: "Could not read that playlist — is it public or unlisted?" }, { status: 502 });
  }
}
