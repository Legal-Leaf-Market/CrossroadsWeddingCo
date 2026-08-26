import { NextResponse, type NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { vipRoster } from "@/lib/db/schema";
import { getWeddingByToken, withSectionRev, type Tx } from "@/lib/hub";
import { CONFLICT_MESSAGE } from "@/lib/hub-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  rev: z.number().int().min(0).optional().default(0),
  saveId: z.string().max(64).optional().default(""),
  vips: z
    .array(
      z.object({
        // All fields may be empty: a visible row must round-trip exactly,
        // never be silently dropped from a replace-all save.
        role: z.string().trim().max(100),
        fullName: z.string().trim().max(255),
        phoneticSpelling: z.string().trim().max(255).optional().default(""),
        entranceSongOverride: z.string().trim().max(255).optional().default(""),
      }),
    )
    .max(40),
});

async function currentVips(ex: Tx | typeof db, weddingId: string) {
  const rows = await ex
    .select()
    .from(vipRoster)
    .where(eq(vipRoster.weddingId, weddingId))
    .orderBy(asc(vipRoster.orderIndex));
  return rows.map((v) => ({
    role: v.role,
    fullName: v.fullName,
    phoneticSpelling: v.phoneticSpelling,
    entranceSongOverride: v.entranceSongOverride ?? "",
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

  const result = await withSectionRev(
    wedding.id,
    "vips",
    parsed.data.rev,
    parsed.data.saveId,
    async (tx) => {
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
    },
    (tx) => currentVips(tx, wedding.id),
  );

  if (result.conflict) {
    return NextResponse.json(
      { error: CONFLICT_MESSAGE, rev: result.rev, lastSaveId: result.lastSaveId, vips: result.current },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { ok: true, rev: result.rev },
    { headers: { "Cache-Control": "no-store" } },
  );
}
