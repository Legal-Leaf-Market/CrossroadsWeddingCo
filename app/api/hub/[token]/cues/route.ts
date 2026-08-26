import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { musicCues } from "@/lib/db/schema";
import { CUE_TYPES, getWeddingByToken, withSectionRev } from "@/lib/hub";
import { CONFLICT_MESSAGE } from "@/lib/hub-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cueTypeValues = CUE_TYPES.map((c) => c.type) as [string, ...string[]];

const schema = z.object({
  rev: z.number().int().min(0).optional().default(0),
  cues: z
    .array(
      z.object({
        cueType: z.enum(cueTypeValues),
        trackTitle: z.string().trim().max(255),
        artist: z.string().trim().max(255),
        timeCue: z.string().trim().max(100).optional().default(""),
        isLivePerformance: z.boolean().optional().default(false),
      }),
    )
    .max(CUE_TYPES.length),
});

async function currentCues(weddingId: string) {
  const rows = await db.select().from(musicCues).where(eq(musicCues.weddingId, weddingId));
  return rows.map((c) => ({
    cueType: c.cueType,
    trackTitle: c.trackTitle,
    artist: c.artist === "Unknown artist" ? "" : c.artist,
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

  // The cue grid always shows all eight moments, so an empty track title is a
  // visible "cleared" state, not a hidden drop: the stored set stays exactly
  // equal to the filled-in set.
  const filled = parsed.data.cues.filter((c) => c.trackTitle.length > 0);
  const result = await withSectionRev(wedding.id, "cues", parsed.data.rev, async (tx) => {
    await tx.delete(musicCues).where(eq(musicCues.weddingId, wedding.id));
    if (filled.length > 0) {
      await tx.insert(musicCues).values(
        filled.map((c) => ({
          weddingId: wedding.id,
          cueType: c.cueType,
          trackTitle: c.trackTitle,
          artist: c.artist,
          timeCue: c.timeCue || null,
          isLivePerformance: c.isLivePerformance,
        })),
      );
    }
  });

  if (result.conflict) {
    return NextResponse.json(
      { error: CONFLICT_MESSAGE, rev: result.rev, cues: await currentCues(wedding.id) },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { ok: true, rev: result.rev },
    { headers: { "Cache-Control": "no-store" } },
  );
}
