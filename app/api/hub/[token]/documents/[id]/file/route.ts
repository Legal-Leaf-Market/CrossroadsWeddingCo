import { NextResponse, type NextRequest } from "next/server";
import { getWeddingByToken } from "@/lib/hub";
import { ALLOWED_DOCUMENT_TYPES, getDocumentFile } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Serves one document's bytes, scoped to the wedding the token opens, so a
// hub token can never read another couple's file. The response is locked
// down: only the inert types the upload route accepts, nosniff so a mislabeled
// file can never be re-interpreted as HTML, and a CSP sandbox so even a PDF
// viewer gets no origin privileges here.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding || !UUID_RE.test(id)) return new NextResponse("Not found", { status: 404 });

  const doc = await getDocumentFile(wedding.id, id);
  if (!doc || !ALLOWED_DOCUMENT_TYPES[doc.mimeType]) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Quote-and-strip the filename: a raw one could inject header directives.
  const safeName = doc.fileName.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "document";
  return new NextResponse(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(doc.data.byteLength),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
