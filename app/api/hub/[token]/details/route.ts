import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { weddings } from "@/lib/db/schema";
import { getWeddingByToken } from "@/lib/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  venueAddress: z.string().trim().max(2000).optional(),
  // Deliberately not z.email(): format is enforced client-side for UX, and a
  // strict server check whose regex differs from the client's would 400 the
  // whole PATCH and block every other field from saving. A malformed value
  // here degrades gracefully (a contact we follow up on the call).
  venueContactEmail: z.string().trim().max(255).optional(),
  contactPhone: z.string().trim().max(50).optional(),
  // spotifyPlaylistUrl is deliberately NOT accepted here anymore: playlist
  // links are managed by the rev-guarded playlists route, which also clears
  // the legacy single column. A writable side door here would bypass that.
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

  await db
    .update(weddings)
    .set({
      ...(d.venueAddress !== undefined ? { venueAddress: d.venueAddress || null } : {}),
      ...(d.venueContactEmail !== undefined
        ? { venueContactEmail: d.venueContactEmail || null }
        : {}),
      ...(d.contactPhone !== undefined ? { contactPhone: d.contactPhone || null } : {}),
      ...(d.vibeNotes !== undefined ? { notes: d.vibeNotes || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(weddings.id, wedding.id));

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
