import { NextResponse, type NextRequest } from "next/server";
import { getWeddingByToken } from "@/lib/hub";
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENTS_PER_WEDDING,
  MAX_DOCUMENT_BYTES,
  addDocument,
  countDocuments,
  listDocuments,
} from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The couple's own documents, gated on their hub token. Not rev-guarded like
// the list sections: uploads and deletes are whole rows, so two devices adding
// files at once both succeed rather than one clobbering the other.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(
    { documents: await listDocuments(wedding.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if ((await countDocuments(wedding.id)) >= MAX_DOCUMENTS_PER_WEDDING) {
    return NextResponse.json(
      { error: `That's the ${MAX_DOCUMENTS_PER_WEDDING} document limit. Remove one first.` },
      { status: 409 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "That upload didn't come through." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Pick a file to upload." }, { status: 400 });
  }
  if (!ALLOWED_DOCUMENT_TYPES[file.type]) {
    return NextResponse.json(
      { error: "We can show images (PNG, JPG, WEBP, GIF, HEIC) and PDFs." },
      { status: 415 },
    );
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json(
      { error: `That file is over ${Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)} MB.` },
      { status: 413 },
    );
  }

  const label = String(form.get("label") ?? "").trim().slice(0, 120);
  const data = Buffer.from(await file.arrayBuffer());
  // Re-check the real byte length: file.size is a claim from the client.
  if (data.byteLength > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "That file is too large." }, { status: 413 });
  }

  try {
    const document = await addDocument({
      weddingId: wedding.id,
      label,
      fileName: file.name.slice(0, 255),
      mimeType: file.type,
      data,
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    console.error("[documents] upload failed:", (err as Error).message);
    return NextResponse.json({ error: "We couldn't save that file. Try again." }, { status: 500 });
  }
}
