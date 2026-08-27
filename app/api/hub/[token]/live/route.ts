import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gt, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { timelineItems } from "@/lib/db/schema";
import { getLiveBlocks, getWeddingByToken } from "@/lib/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live day-of control, guarded by the hub's write token. Single-field writes
// with last-write-wins semantics: the 15-second poll reconverges every open
// device, and mid-ceremony taps must never be blocked by a version check.

const schema = z.object({
  action: z.enum(["start", "complete", "reset"]),
  itemId: z.string().uuid(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(
    { blocks: await getLiveBlocks(wedding.id), shareToken: wedding.shareToken },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
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
  const { action, itemId } = parsed.data;

  const [item] = await db
    .select()
    .from(timelineItems)
    .where(and(eq(timelineItems.id, itemId), eq(timelineItems.weddingId, wedding.id)))
    .limit(1);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.transaction(async (tx) => {
    const mine = (extra: ReturnType<typeof gt> | ReturnType<typeof lt>) =>
      and(eq(timelineItems.weddingId, wedding.id), extra);
    if (action === "start") {
      // Starting a block closes everything before it and reopens everything
      // after it, so tapping an earlier block by mistake self-heals.
      await tx
        .update(timelineItems)
        .set({ actualStartTime: new Date(), isCompleted: false })
        .where(and(eq(timelineItems.id, itemId), eq(timelineItems.weddingId, wedding.id)));
      await tx
        .update(timelineItems)
        .set({ isCompleted: true })
        .where(mine(lt(timelineItems.orderIndex, item.orderIndex)));
      await tx
        .update(timelineItems)
        .set({ actualStartTime: null, isCompleted: false })
        .where(mine(gt(timelineItems.orderIndex, item.orderIndex)));
    } else if (action === "complete") {
      await tx
        .update(timelineItems)
        .set({ isCompleted: true })
        .where(and(eq(timelineItems.id, itemId), eq(timelineItems.weddingId, wedding.id)));
    } else {
      // reset: this block and everything after go back to untouched.
      await tx
        .update(timelineItems)
        .set({ actualStartTime: null, isCompleted: false })
        .where(mine(gt(timelineItems.orderIndex, item.orderIndex - 1)));
    }
  });

  return NextResponse.json(
    { blocks: await getLiveBlocks(wedding.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
