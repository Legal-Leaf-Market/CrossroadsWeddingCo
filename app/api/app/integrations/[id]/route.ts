import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBooksWorkspace, sameOrigin } from "@/lib/auth";
import { disconnect, getConnection, syncConnection } from "@/lib/integrations/bank-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

const schema = z.object({ action: z.enum(["sync", "disconnect"]) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400, headers: NO_STORE });
  const conn = await getConnection(ws.tenant.id, id);
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  try {
    if (parsed.data.action === "disconnect") {
      await disconnect(ws.tenant.id, id);
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    }
    const result = await syncConnection(id);
    if ("error" in result) {
      const msg = result.error === "needs_reauth" ? "Your bank needs you to log in again." : "Couldn't refresh right now.";
      return NextResponse.json({ error: msg, code: result.error }, { status: 502, headers: NO_STORE });
    }
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (err) {
    console.error("[integrations] action failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Something went wrong. Try again in a minute." }, { status: 502, headers: NO_STORE });
  }
}
