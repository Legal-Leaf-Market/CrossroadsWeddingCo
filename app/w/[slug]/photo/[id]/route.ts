import { NextResponse, type NextRequest } from "next/server";
import { IMAGE_HEADERS, publicSitePhoto } from "@/lib/site-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A photo on a published wedding website. Turning the site off makes every
// photo URL a 404 at once; cached copies expire within the hour.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await ctx.params;
  const p = await publicSitePhoto(slug, id);
  if (!p) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(p.data), {
    headers: { "Content-Type": p.mimeType, "Cache-Control": "public, max-age=3600", ...IMAGE_HEADERS },
  });
}
