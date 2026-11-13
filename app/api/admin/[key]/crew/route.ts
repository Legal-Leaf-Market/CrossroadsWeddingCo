import { NextResponse, type NextRequest } from "next/server";
import { adminKeyMatches } from "@/lib/admin";
import { saveCrew } from "@/lib/costing";
import { crewBody } from "@/lib/costing-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Replace-all save from the crew page (/admin/[key]/crew). Rows are updated or
// added, never deleted: taking one off retires it (lib/costing.ts).
export async function PUT(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!adminKeyMatches(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  const parsed = crewBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400, headers: NO_STORE });
  }
  try {
    await saveCrew(parsed.data.crew);
  } catch (err) {
    console.error("[costing] saveCrew failed", err);
    return NextResponse.json({ error: "That didn't save." }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
