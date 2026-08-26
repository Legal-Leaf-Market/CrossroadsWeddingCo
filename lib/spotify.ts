// Spotify is a priority integration (CLAUDE.md §9.2): couples curate playlists
// in their own accounts and share the link. This module reads those shared
// playlists and searches the catalog via the client-credentials flow — no user
// login involved. Everything fails closed until SPOTIFY_CLIENT_ID and
// SPOTIFY_CLIENT_SECRET exist (free app at developer.spotify.com).
// Write-back (collaborative playlists from our side) needs the OAuth
// authorization-code flow and ships with the Phase 2 portal.

export function isSpotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

/** Accepts open.spotify.com/playlist/<id> (with or without query junk) and spotify:playlist:<id>. */
export function parsePlaylistId(input: string): string | null {
  const trimmed = input.trim();
  const uri = trimmed.match(/^spotify:playlist:([A-Za-z0-9]+)$/);
  if (uri) return uri[1];
  try {
    const url = new URL(trimmed);
    if (!/(^|\.)spotify\.com$/.test(url.hostname)) return null;
    const match = url.pathname.match(/\/playlist\/([A-Za-z0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token request failed (${res.status})`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  // Refresh a minute early so a token never expires mid-request.
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

export type SpotifyTrack = { title: string; artist: string; spotifyId: string };

export type SpotifyPlaylist = { name: string; total: number; tracks: SpotifyTrack[] };

/** Reads a public/unlisted playlist shared by a couple. */
export async function getPlaylist(playlistId: string): Promise<SpotifyPlaylist> {
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };

  const metaRes = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,tracks.total`,
    { headers },
  );
  if (!metaRes.ok) throw new Error(`Spotify playlist fetch failed (${metaRes.status})`);
  const meta = (await metaRes.json()) as { name: string; tracks: { total: number } };

  const tracks: SpotifyTrack[] = [];
  let url: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(id,name,artists(name)))`;
  while (url) {
    const res: Response = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Spotify tracks fetch failed (${res.status})`);
    const page = (await res.json()) as {
      next: string | null;
      items: { track: { id: string | null; name: string; artists: { name: string }[] } | null }[];
    };
    for (const item of page.items) {
      // Local files and removed tracks come back with null ids — skip them.
      if (item.track?.id) {
        tracks.push({
          title: item.track.name,
          artist: item.track.artists.map((a) => a.name).join(", "),
          spotifyId: item.track.id,
        });
      }
    }
    url = page.next;
  }

  return { name: meta.name, total: meta.tracks.total, tracks };
}

/** Track search for the Phase 2 portal's must-play / do-not-play pickers. */
export async function searchTracks(query: string, limit = 10): Promise<SpotifyTrack[]> {
  const token = await getToken();
  const res = await fetch(
    `https://api.spotify.com/v1/search?type=track&limit=${limit}&q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Spotify search failed (${res.status})`);
  const data = (await res.json()) as {
    tracks: { items: { id: string; name: string; artists: { name: string }[] }[] };
  };
  return data.tracks.items.map((t) => ({
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    spotifyId: t.id,
  }));
}
