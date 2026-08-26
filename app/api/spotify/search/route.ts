import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getWeddingByToken } from "@/lib/hub";
import { isSpotifyConfigured, searchTracks } from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Track search for the portal's cue and playlist pickers. Gated on a valid
// portal token so it is a couples' feature, not an open Spotify proxy, and it
// fails closed until the Spotify keys exist (CLAUDE.md §9.4).
export async function POST(req: NextRequest) {
  if (!isSpotifyConfigured()) {
    return NextResponse.json({ error: "Search not available yet" }, { status: 501 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = z
    .object({ token: z.string().max(64), query: z.string().trim().min(2).max(200) })
    .safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const wedding = await getWeddingByToken(parsed.data.token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const tracks = await searchTracks(parsed.data.query, 8);
    return NextResponse.json({ tracks }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[spotify] search failed:", (err as Error).message);
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}
