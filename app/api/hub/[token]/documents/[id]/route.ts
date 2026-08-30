import { NextResponse, type NextRequest } from "next/server";
import { getWeddingByToken } from "@/lib/hub";
import { removeDocument, renameDocument } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding || !UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { label?: unknown } | null;
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 120) : null;
  if (label === null) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // Scoped to this wedding, so a hub token can only rename its own files.
  const ok = await renameDocument(wedding.id, id, label);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding || !UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ok = await removeDocument(wedding.id, id);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}
