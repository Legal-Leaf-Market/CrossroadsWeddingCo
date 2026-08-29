import { NextResponse, type NextRequest } from "next/server";
import { adminKeyMatches } from "@/lib/admin";
import { isSpotifyConfigured } from "@/lib/spotify";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-time owner ritual: /api/spotify/connect?key=<ADMIN_DASH_KEY> sends the
// owner through Spotify's authorize screen; the callback below displays the
// refresh token to paste into Vercel as SPOTIFY_REFRESH_TOKEN. Needed because
// the February 2026 API migration made playlist reads require a
// user-authorized token (client credentials now 401 on /items).
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!adminKeyMatches(key)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isSpotifyConfigured()) {
    return NextResponse.json(
      { error: "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first." },
      { status: 501 },
    );
  }

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: `${SITE_URL}/api/spotify/callback`,
    scope: "playlist-read-private playlist-read-collaborative",
    // The callback re-checks this against ADMIN_DASH_KEY, so a stray visitor
    // completing the dance without the key still gets a 404.
    state: key,
  });
  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
}
