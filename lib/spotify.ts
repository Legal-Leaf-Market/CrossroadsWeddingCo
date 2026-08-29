// Spotify is a priority integration (CLAUDE.md §9.2): couples curate playlists
// in their own accounts and share the link. This module reads those shared
// playlists and searches the catalog via the client-credentials flow, no user
// login involved. Everything fails closed until SPOTIFY_CLIENT_ID and
// SPOTIFY_CLIENT_SECRET exist (free app at developer.spotify.com).
// Write-back (collaborative playlists from our side) needs the OAuth
// authorization-code flow and ships with the Phase 2 portal.

export function isSpotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

// Accepts open.spotify.com/playlist/<id> (with or without query junk) and
// spotify:playlist:<id>. Defined in lib/hub-constants (client-safe) so the
// hub UI validates with the exact same logic as the API routes.
export { parsePlaylistId } from "@/lib/hub-constants";

let cachedToken: { value: string; expiresAt: number } | null = null;

// Since Spotify's February 2026 API migration, the playlist /items endpoint
// rejects client-credentials tokens (401): reading playlists now needs a
// user-authorized token. SPOTIFY_REFRESH_TOKEN carries a one-time
// authorization of the owner's own Spotify account (minted via
// /api/spotify/connect, admin-key gated); when present, tokens come from the
// refresh grant and every read runs as that account. Without it we fall back
// to client credentials, which still serves basic metadata and search.
async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString("base64");

  const refresh = process.env.SPOTIFY_REFRESH_TOKEN;
  const body = refresh
    ? new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }).toString()
    : "grant_type=client_credentials";

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token request failed (${res.status})`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  // Refresh a minute early so a token never expires mid-request.
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

export type SpotifyTrack = { title: string; artist: string; spotifyId: string };

export type SpotifyPlaylist = { name: string; total: number; tracks: SpotifyTrack[] };

type PlaylistEntryTrack = { id: string | null; name: string; artists: { name: string }[] };

/**
 * Reads a public/unlisted playlist shared by a couple.
 *
 * Uses the /playlists/{id}/items endpoint from Spotify's February 2026 API
 * migration (enforced 2026-03-09): the old /tracks path 403s for
 * development-mode apps, playlist objects renamed `tracks` to `items`, and
 * each entry's `track` became `item`. Parsing accepts both shapes so a
 * rollback on Spotify's side can't break us.
 */
export async function getPlaylist(playlistId: string): Promise<SpotifyPlaylist> {
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };

  const metaRes = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,items.total,tracks.total`,
    { headers },
  );
  if (!metaRes.ok) throw new Error(`Spotify playlist fetch failed (${metaRes.status})`);
  const meta = (await metaRes.json()) as {
    name: string;
    items?: { total?: number };
    tracks?: { total?: number };
  };

  const tracks: SpotifyTrack[] = [];
  // Cap paging: 8 pages = 800 tracks, far past any wedding playlist, and it
  // bounds the serial fetches a hostile playlist could make this server do.
  const MAX_PAGES = 8;
  let pages = 0;
  let url: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=100&fields=next,items(item(id,name,artists(name)),track(id,name,artists(name)))`;
  while (url && pages < MAX_PAGES) {
    pages += 1;
    const res: Response = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Spotify items fetch failed (${res.status})`);
    const page = (await res.json()) as {
      next: string | null;
      items: { item?: PlaylistEntryTrack | null; track?: PlaylistEntryTrack | null }[];
    };
    for (const entry of page.items) {
      const t = entry.item ?? entry.track;
      // Local files and removed tracks come back with null ids; skip them.
      if (t?.id) {
        tracks.push({
          title: t.name,
          artist: t.artists.map((a) => a.name).join(", "),
          spotifyId: t.id,
        });
      }
    }
    url = page.next;
  }

  const total = meta.items?.total ?? meta.tracks?.total ?? tracks.length;
  return { name: meta.name, total, tracks };
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
