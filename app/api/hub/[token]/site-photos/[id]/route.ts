import { NextResponse, type NextRequest } from "next/server";
import { getWeddingByToken } from "@/lib/hub";
import { IMAGE_HEADERS, removeSitePhoto, sitePhotoBytes } from "@/lib/site-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string; id: string }> };

/** The couple's own view of a photo in the hub, whether or not the site is on. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { token, id } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  const p = wedding ? await sitePhotoBytes(wedding.id, id) : null;
  if (!p) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(p.data), {
    headers: { "Content-Type": p.mimeType, "Cache-Control": "private, no-store", ...IMAGE_HEADERS },
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { token, id } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ok = await removeSitePhoto(wedding.id, id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
