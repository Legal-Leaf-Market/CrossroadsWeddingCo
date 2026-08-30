import { NextResponse, type NextRequest } from "next/server";
import { adminKeyMatches } from "@/lib/admin";
import { spotifyRedirectUri } from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Second half of the owner's one-time Spotify authorization (see
// ../connect/route.ts). Exchanges the code and shows the refresh token ONCE,
// for pasting into Vercel as SPOTIFY_REFRESH_TOKEN; nothing is stored here.
export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state") ?? "";
  if (!adminKeyMatches(state)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const err = req.nextUrl.searchParams.get("error");
  if (err) {
    return new NextResponse(`Spotify said: ${escapeHtml(err)}. Close this tab and try again.`, {
      status: 400,
      headers: { "Content-Type": "text/plain" },
    });
  }
  const code = req.nextUrl.searchParams.get("code") ?? "";
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: spotifyRedirectUri(),
    }).toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[spotify] code exchange failed:", res.status, detail.slice(0, 300));
    return new NextResponse(
      `Token exchange failed (${res.status}). Check that the app's redirect URI is exactly ${spotifyRedirectUri()} and try again.`,
      { status: 502, headers: { "Content-Type": "text/plain" } },
    );
  }
  const data = (await res.json()) as { refresh_token?: string };
  if (!data.refresh_token) {
    return new NextResponse("Spotify returned no refresh token. Try the connect link again.", {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const html =
    `<!doctype html><meta charset="utf-8"><title>Spotify connected</title>` +
    `<body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; color: #2b2622; background: #faf5ec;">` +
    `<h1 style="font-size: 1.4rem;">Spotify connected</h1>` +
    `<p>Last step: copy this refresh token into Vercel as the environment variable ` +
    `<strong>SPOTIFY_REFRESH_TOKEN</strong>, then redeploy. This token is shown once and ` +
    `stored nowhere; treat it like a password.</p>` +
    `<textarea readonly onclick="this.select()" style="width: 100%; height: 7rem; font-family: monospace; font-size: 0.85rem; padding: 0.75rem; border-radius: 0.75rem; border: 1px solid #c1633d;">${escapeHtml(data.refresh_token)}</textarea>` +
    `<p style="color: #6b6257; font-size: 0.9rem;">After the redeploy, playlist track lists in the planning hub light up.</p>` +
    `</body>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html", "Cache-Control": "no-store" } });
}
