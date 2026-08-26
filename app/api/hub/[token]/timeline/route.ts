import { NextResponse, type NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { timelineItems } from "@/lib/db/schema";
import { getWeddingByToken, TIMELINE_CATEGORIES, withSectionRev } from "@/lib/hub";
import { CONFLICT_MESSAGE, TIME_RE } from "@/lib/hub-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  rev: z.number().int().min(0).optional().default(0),
  items: z
    .array(
      z.object({
        // Empty titles are allowed: a row the couple can see must round-trip
        // as-is, never be silently dropped from a replace-all save.
        title: z.string().trim().max(255),
        category: z.enum(TIMELINE_CATEGORIES),
        startTime: z.string().regex(TIME_RE, "Time must be HH:MM"),
        durationMinutes: z.number().int().min(1).max(600),
        mcNotes: z.string().trim().max(2000).optional().default(""),
      }),
    )
    .max(60),
});

async function currentItems(weddingId: string) {
  const rows = await db
    .select()
    .from(timelineItems)
    .where(eq(timelineItems.weddingId, weddingId))
    .orderBy(asc(timelineItems.orderIndex));
  return rows.map((item) => ({
    title: item.title,
    category: item.category ?? "reception",
    startTime: item.scheduledStartTime.slice(0, 5),
    durationMinutes: item.estimatedDurationMinutes,
    mcNotes: item.mcNotes ?? "",
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

  // Replace-all under the section revision: the client owns ordering, the
  // server owns scoping, and a stale snapshot gets a 409 instead of a wipe.
  const result = await withSectionRev(wedding.id, "timeline", parsed.data.rev, async (tx) => {
    await tx.delete(timelineItems).where(eq(timelineItems.weddingId, wedding.id));
    if (parsed.data.items.length > 0) {
      await tx.insert(timelineItems).values(
        parsed.data.items.map((item, index) => ({
          weddingId: wedding.id,
          orderIndex: index,
          title: item.title,
          category: item.category,
          scheduledStartTime: item.startTime,
          estimatedDurationMinutes: item.durationMinutes,
          mcNotes: item.mcNotes || null,
        })),
      );
    }
  });

  if (result.conflict) {
    return NextResponse.json(
      { error: CONFLICT_MESSAGE, rev: result.rev, items: await currentItems(wedding.id) },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { ok: true, rev: result.rev },
    { headers: { "Cache-Control": "no-store" } },
  );
}
