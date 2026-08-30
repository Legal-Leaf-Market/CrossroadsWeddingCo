import { NextResponse, type NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { musicCues } from "@/lib/db/schema";
import { getWeddingByToken, withSectionRev, type Tx } from "@/lib/hub";
import { CONFLICT_MESSAGE } from "@/lib/hub-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  rev: z.number().int().min(0).optional().default(0),
  saveId: z.string().max(64).optional().default(""),
  cues: z
    .array(
      z.object({
        // No longer an enum: a wedding can carry two processionals, or a
        // moment we never thought of. The type is a grouping hint for the
        // send-to-a-moment menu; the label is what the couple actually reads.
        cueType: z.string().trim().max(60).regex(/^[a-z0-9_]*$/),
        label: z.string().trim().max(120).optional().default(""),
        trackTitle: z.string().trim().max(255),
        artist: z.string().trim().max(255),
        timeCue: z.string().trim().max(100).optional().default(""),
        notes: z.string().trim().max(2000).optional().default(""),
        spotifyUrl: z.string().trim().max(500).optional().default(""),
        isLivePerformance: z.boolean().optional().default(false),
      }),
    )
    .max(40),
});

async function currentCues(ex: Tx | typeof db, weddingId: string) {
  const rows = await ex
    .select()
    .from(musicCues)
    .where(eq(musicCues.weddingId, weddingId))
    .orderBy(asc(musicCues.orderIndex));
  return rows.map((c) => ({
    cueType: c.cueType,
    label: c.label ?? "",
    trackTitle: c.trackTitle,
    artist: c.artist === "Unknown artist" ? "" : c.artist,
    notes: c.notes ?? "",
    spotifyUrl: c.spotifyUrl ?? "",
    isLivePerformance: c.isLivePerformance ?? false,
  }));
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

  // A standard moment left blank is a visible "not chosen yet" state, so it
  // is dropped rather than stored. A row the couple added themselves is kept
  // on its label alone: they named it deliberately and it must not vanish
  // while they are still deciding the song.
  const filled = parsed.data.cues.filter(
    (c) =>
      c.trackTitle.length > 0 ||
      c.artist.length > 0 ||
      c.notes.length > 0 ||
      c.spotifyUrl.length > 0 ||
      c.label.length > 0,
  );
  const result = await withSectionRev(
    wedding.id,
    "cues",
    parsed.data.rev,
    parsed.data.saveId,
    async (tx) => {
      await tx.delete(musicCues).where(eq(musicCues.weddingId, wedding.id));
      if (filled.length > 0) {
        await tx.insert(musicCues).values(
          filled.map((c, index) => ({
            weddingId: wedding.id,
            cueType: c.cueType,
            label: c.label || null,
            orderIndex: index,
            trackTitle: c.trackTitle,
            artist: c.artist,
            timeCue: c.timeCue || null,
            notes: c.notes || null,
            spotifyUrl: c.spotifyUrl || null,
            isLivePerformance: c.isLivePerformance,
          })),
        );
      }
    },
    (tx) => currentCues(tx, wedding.id),
  );

  if (result.conflict) {
    return NextResponse.json(
      { error: CONFLICT_MESSAGE, rev: result.rev, lastSaveId: result.lastSaveId, cues: result.current },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { ok: true, rev: result.rev },
    { headers: { "Cache-Control": "no-store" } },
  );
}
