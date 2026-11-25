import { NextResponse, type NextRequest } from "next/server";
import { getWeddingByToken } from "@/lib/hub";
import { MAX_SITE_PHOTOS, MAX_SITE_PHOTO_BYTES, addSitePhoto, listSitePhotos, sniffImage } from "@/lib/site-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const wedding = await getWeddingByToken((await ctx.params).token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ photos: await listSitePhotos(wedding.id) }, { headers: NO_STORE });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const wedding = await getWeddingByToken((await ctx.params).token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "That upload didn't come through." }, { status: 400, headers: NO_STORE });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Pick a photo." }, { status: 400, headers: NO_STORE });
  if (file.size > MAX_SITE_PHOTO_BYTES) return NextResponse.json({ error: "That photo is too large." }, { status: 413, headers: NO_STORE });
  const data = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(data);
  if (!mime) return NextResponse.json({ error: "Photos need to be JPG, PNG or WebP." }, { status: 415, headers: NO_STORE });
  const num = (k: string) => {
    const n = Number(form.get(k));
    return Number.isInteger(n) && n > 0 && n < 20000 ? n : null;
  };
  try {
    const id = await addSitePhoto({
      weddingId: wedding.id,
      data,
      mimeType: mime,
      width: num("width"),
      height: num("height"),
      caption: String(form.get("caption") ?? "").trim().slice(0, 200),
    });
    if (id === "full") {
      return NextResponse.json({ error: `That's the ${MAX_SITE_PHOTOS} photo limit. Remove one first.` }, { status: 409, headers: NO_STORE });
    }
    return NextResponse.json({ id }, { headers: NO_STORE });
  } catch (err) {
    console.error("[site-photos] upload failed:", err);
    return NextResponse.json({ error: "Couldn't save that photo. Try again." }, { status: 503, headers: NO_STORE });
  }
}
