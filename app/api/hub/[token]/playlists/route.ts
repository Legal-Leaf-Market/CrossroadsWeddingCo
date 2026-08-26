import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { playlistCurations } from "@/lib/db/schema";
import { getWeddingByToken } from "@/lib/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const track = z.object({
  trackTitle: z.string().trim().min(1).max(255),
  artist: z.string().trim().max(255).optional().default(""),
});

const schema = z.object({
  mustPlay: z.array(track).max(100),
  doNotPlay: z.array(track).max(100),
});

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
      artist: t.artist || "Unknown artist",
    })),
    ...parsed.data.doNotPlay.map((t) => ({
      weddingId: wedding.id,
      category: "do_not_play",
      trackTitle: t.trackTitle,
      artist: t.artist || "Unknown artist",
    })),
  ];
  await db.transaction(async (tx) => {
    await tx
      .delete(playlistCurations)
      .where(
        and(
          eq(playlistCurations.weddingId, wedding.id),
          inArray(playlistCurations.category, ["must_play", "do_not_play"]),
        ),
      );
    if (rows.length > 0) await tx.insert(playlistCurations).values(rows);
  });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
