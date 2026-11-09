import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBooksWorkspace, sameOrigin } from "@/lib/auth";
import { CATEGORY_KINDS } from "@/lib/books/categories";
import { createCategory } from "@/lib/books/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const schema = z.object({ name: z.string().min(1).max(80), kind: z.enum(CATEGORY_KINDS) });

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give it a name and a type." }, { status: 400, headers: NO_STORE });
  const r = await createCategory(ws.tenant.id, parsed.data);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409, headers: NO_STORE });
  return NextResponse.json({ ok: true, category: { id: r.category.id, name: r.category.name, kind: r.category.kind } }, { headers: NO_STORE });
}
