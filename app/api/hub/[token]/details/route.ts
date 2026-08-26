import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { weddings } from "@/lib/db/schema";
import { getWeddingByToken } from "@/lib/hub";
import { parsePlaylistId } from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  venueAddress: z.string().trim().max(2000).optional(),
  venueContactEmail: z.union([z.literal(""), z.email().max(255)]).optional(),
  contactPhone: z.string().trim().max(50).optional(),
  spotifyPlaylistUrl: z.string().trim().max(500).optional(),
  vibeNotes: z.string().trim().max(5000).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
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
  const d = parsed.data;

  if (d.spotifyPlaylistUrl && !parsePlaylistId(d.spotifyPlaylistUrl)) {
    return NextResponse.json(
      { error: "That Spotify link doesn't look like a playlist. Use Share, then Copy link." },
      { status: 400 },
    );
  }

  await db
    .update(weddings)
    .set({
      ...(d.venueAddress !== undefined ? { venueAddress: d.venueAddress || null } : {}),
      ...(d.venueContactEmail !== undefined
        ? { venueContactEmail: d.venueContactEmail || null }
        : {}),
      ...(d.contactPhone !== undefined ? { contactPhone: d.contactPhone || null } : {}),
      ...(d.spotifyPlaylistUrl !== undefined
        ? { spotifyPlaylistUrl: d.spotifyPlaylistUrl || null }
        : {}),
      ...(d.vibeNotes !== undefined ? { notes: d.vibeNotes || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(weddings.id, wedding.id));

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
