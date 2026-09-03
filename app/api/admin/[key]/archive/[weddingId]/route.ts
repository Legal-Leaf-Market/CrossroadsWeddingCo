import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminKeyMatches, getAdminWedding, setWeddingArchived } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

const postSchema = z.object({ archived: z.boolean() });

/**
 * Hide a wedding from the dashboard, or bring it back. Nothing is deleted, so
 * a misclick costs one more click to undo, which is the whole reason this is
 * an archive and not a delete.
 *
 * A wrong key 404s rather than 403s, matching every other admin route: the
 * endpoint does not confirm it exists.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ key: string; weddingId: string }> },
) {
  const { key, weddingId } = await ctx.params;
  if (!adminKeyMatches(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  }

  const wedding = await getAdminWedding(weddingId);
  if (!wedding) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const ok = await setWeddingArchived(weddingId, parsed.data.archived);
  if (!ok) {
    return NextResponse.json({ error: "Could not update that booking." }, { status: 400, headers: NO_STORE });
  }
  return NextResponse.json({ archived: parsed.data.archived }, { headers: NO_STORE });
}
