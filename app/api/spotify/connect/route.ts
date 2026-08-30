import { NextResponse, type NextRequest } from "next/server";
import { adminKeyMatches } from "@/lib/admin";
import { isSpotifyConfigured, spotifyRedirectUri } from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// One-time owner ritual: /api/spotify/connect?key=<ADMIN_DASH_KEY> shows the
// exact redirect URI this deployment will send, then hands off to Spotify's
// authorize screen; the callback displays the refresh token to paste into
// Vercel as SPOTIFY_REFRESH_TOKEN. Needed because the February 2026 API
// migration made playlist reads require a user-authorized token (client
// credentials now 401 on /items).
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!adminKeyMatches(key)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isSpotifyConfigured()) {
    return NextResponse.json(
      { error: "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first." },
      { status: 501 },
    );
  }

  const redirectUri = spotifyRedirectUri();
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "playlist-read-private playlist-read-collaborative",
    // The callback re-checks this against ADMIN_DASH_KEY, so a stray visitor
    // completing the dance without the key still gets a 404.
    state: key,
  });
  const authorizeUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;

  // Spotify rejects the handoff unless the registered URI matches this one
  // character for character, and its error page never says what we sent. So
  // show it first; ?go=1 skips straight through on the next pass.
  if (req.nextUrl.searchParams.get("go") !== "1") {
    const continueUrl = `/api/spotify/connect?key=${encodeURIComponent(key)}&go=1`;
    const html =
      `<!doctype html><meta charset="utf-8"><title>Connect Spotify</title>` +
      `<body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; color: #2b2622; background: #faf5ec;">` +
      `<h1 style="font-size: 1.4rem;">Before you continue</h1>` +
      `<p>This deployment will send Spotify exactly this redirect URI. It has to be listed, ` +
      `character for character, in your app at ` +
      `<a href="https://developer.spotify.com/dashboard" style="color:#c1633d;">developer.spotify.com/dashboard</a> ` +
      `under Settings, Edit, Redirect URIs. No trailing slash, no www unless it is shown below.</p>` +
      `<textarea readonly onclick="this.select()" style="width: 100%; height: 3.5rem; font-family: monospace; font-size: 0.9rem; padding: 0.75rem; border-radius: 0.75rem; border: 1px solid #c1633d;">${escapeHtml(redirectUri)}</textarea>` +
      `<p><a href="${escapeHtml(continueUrl)}" style="display:inline-block; margin-top:0.5rem; background:#c1633d; color:#faf5ec; padding:0.6rem 1.2rem; border-radius:999px; text-decoration:none; font-weight:600;">It is saved in Spotify, continue</a></p>` +
      `<p style="color: #6b6257; font-size: 0.9rem;">Spotify takes a minute or two to pick up a newly saved redirect URI. If it still complains, wait, then reload this page.</p>` +
      `</body>`;
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html", "Cache-Control": "no-store" },
    });
  }

  return NextResponse.redirect(authorizeUrl);
}
