import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { vipRoster } from "@/lib/db/schema";
import { getWeddingByToken } from "@/lib/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  vips: z
    .array(
      z.object({
        role: z.string().trim().min(1).max(100),
        fullName: z.string().trim().min(1).max(255),
        phoneticSpelling: z.string().trim().max(255).optional().default(""),
        entranceSongOverride: z.string().trim().max(255).optional().default(""),
      }),
    )
    .max(40),
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

  await db.transaction(async (tx) => {
    await tx.delete(vipRoster).where(eq(vipRoster.weddingId, wedding.id));
    if (parsed.data.vips.length > 0) {
      await tx.insert(vipRoster).values(
        parsed.data.vips.map((v, index) => ({
          weddingId: wedding.id,
          orderIndex: index,
          role: v.role,
          fullName: v.fullName,
          phoneticSpelling: v.phoneticSpelling,
          entranceSongOverride: v.entranceSongOverride || null,
        })),
      );
    }
  });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
