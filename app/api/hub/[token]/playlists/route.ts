import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { playlistCurations, weddings } from "@/lib/db/schema";
import { getWeddingByToken, withSectionRev, type Tx } from "@/lib/hub";
import { CONFLICT_MESSAGE, MAX_PLAYLIST_LINKS, normalizePlaylistLinks } from "@/lib/hub-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const track = z.object({
  // Both fields may be empty: a visible row (say, artist typed first) must
  // round-trip exactly, never be silently dropped from a replace-all save.
  trackTitle: z.string().trim().max(255),
  artist: z.string().trim().max(255).optional().default(""),
});

const playlistLink = z.object({
  // A row with a label but no URL yet (or the reverse) must round-trip.
  // The URL is deliberately not format-validated here: a link that isn't a
  // playlist saves as typed with the field flagged in the UI, because a 400
  // on this replace-all route would block the couple's track-list edits too.
  label: z.string().trim().max(100),
  url: z.string().trim().max(500),
});

const schema = z.object({
  rev: z.number().int().min(0).optional().default(0),
  saveId: z.string().max(64).optional().default(""),
  mustPlay: z.array(track).max(100),
  doNotPlay: z.array(track).max(100),
  playlists: z.array(playlistLink).max(MAX_PLAYLIST_LINKS).optional().default([]),
});

function toClient(rows: { category: string; trackTitle: string; artist: string }[], category: string) {
  return rows
    .filter((r) => r.category === category)
    .map((r) => ({
      trackTitle: r.trackTitle,
      artist: r.artist === "Unknown artist" ? "" : r.artist,
    }));
}

async function currentLists(ex: Tx | typeof db, weddingId: string) {
  const rows = await ex
    .select()
    .from(playlistCurations)
    .where(
      and(
        eq(playlistCurations.weddingId, weddingId),
        inArray(playlistCurations.category, ["must_play", "do_not_play"]),
      ),
    );
  const [w] = await ex
    .select({ spotifyPlaylistUrls: weddings.spotifyPlaylistUrls })
    .from(weddings)
    .where(eq(weddings.id, weddingId));
  const playlists = normalizePlaylistLinks(w?.spotifyPlaylistUrls);
  return {
    mustPlay: toClient(rows, "must_play"),
    doNotPlay: toClient(rows, "do_not_play"),
    playlists,
  };
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Only the two portal-owned categories are replaced; anything else (future
  // cocktail or dinner vibes) is untouched.
  const rows = [
    ...parsed.data.mustPlay.map((t) => ({
      weddingId: wedding.id,
      category: "must_play",
      trackTitle: t.trackTitle,
      artist: t.artist,
    })),
    ...parsed.data.doNotPlay.map((t) => ({
      weddingId: wedding.id,
      category: "do_not_play",
      trackTitle: t.trackTitle,
      artist: t.artist,
    })),
  ];
  const result = await withSectionRev(
    wedding.id,
    "playlists",
    parsed.data.rev,
    parsed.data.saveId,
    async (tx) => {
      await tx
        .delete(playlistCurations)
        .where(
          and(
            eq(playlistCurations.weddingId, wedding.id),
            inArray(playlistCurations.category, ["must_play", "do_not_play"]),
          ),
        );
      if (rows.length > 0) await tx.insert(playlistCurations).values(rows);
      // Clearing the booking-captured single link on every managed save is
      // what lets a deleted seed row STAY deleted: the hub page only seeds
      // from that column while this list has never been saved. updated_at is
      // stamped by withSectionRev's rev bump in this same transaction.
      await tx
        .update(weddings)
        .set({ spotifyPlaylistUrls: parsed.data.playlists, spotifyPlaylistUrl: null })
        .where(eq(weddings.id, wedding.id));
    },
    (tx) => currentLists(tx, wedding.id),
  );

  if (result.conflict) {
    return NextResponse.json(
      { error: CONFLICT_MESSAGE, rev: result.rev, lastSaveId: result.lastSaveId, ...result.current },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { ok: true, rev: result.rev },
    { headers: { "Cache-Control": "no-store" } },
  );
}
