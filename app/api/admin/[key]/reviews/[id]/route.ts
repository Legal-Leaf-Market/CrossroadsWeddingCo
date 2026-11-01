import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminKeyMatches } from "@/lib/admin";
import { moderateEntry } from "@/lib/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const bodySchema = z.object({ action: z.enum(["approve", "hide", "feature", "unfeature"]) });

/**
 * Approve, hide, feature or unfeature a note on /reviews. Nothing deletes and
 * nothing edits the words: a note is shown as written or not shown. A wrong
 * key 404s, like every admin route.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string; id: string }> }) {
  const { key, id } = await ctx.params;
  if (!adminKeyMatches(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  }
  const ok = await moderateEntry(id, parsed.data.action);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
