import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminKeyMatches, setBooksExcluded } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const schema = z.object({ exclude: z.boolean(), reason: z.string().max(500).default("") });

/**
 * Leave a booking that was never a real job (a test) out of the books, or put
 * it back. Reason required, audited, refused while real money is tied to it
 * (setBooksExcluded in lib/admin.ts). A wrong key 404s like every admin route.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string; weddingId: string }> }) {
  const { key, weddingId } = await ctx.params;
  if (!adminKeyMatches(key)) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  const r = await setBooksExcluded(weddingId, parsed.data.exclude, parsed.data.reason);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "Not found" ? 404 : 400, headers: NO_STORE });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
