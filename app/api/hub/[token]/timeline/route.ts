import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { timelineItems } from "@/lib/db/schema";
import { getWeddingByToken, TIMELINE_CATEGORIES } from "@/lib/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(255),
        category: z.enum(TIMELINE_CATEGORIES),
        startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM"),
        durationMinutes: z.number().int().min(1).max(600),
        mcNotes: z.string().trim().max(2000).optional().default(""),
      }),
    )
    .max(60),
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

  // Replace-all inside a transaction: the client owns ordering, the server
  // owns scoping, and a half-applied save can never survive.
  await db.transaction(async (tx) => {
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

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
