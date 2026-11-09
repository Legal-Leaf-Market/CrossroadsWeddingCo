import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBooksWorkspace, sameOrigin } from "@/lib/auth";
import { setCategoryArchived } from "@/lib/books/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const schema = z.object({ archived: z.boolean() });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400, headers: NO_STORE });
  const { id } = await ctx.params;
  const ok = await setCategoryArchived(ws.tenant.id, id, parsed.data.archived);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
