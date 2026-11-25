import { NextResponse, type NextRequest } from "next/server";
import { getBooksWorkspace, sameOrigin } from "@/lib/auth";
import { updateVendor } from "@/lib/vendors";
import { vendorPatchSchema } from "@/lib/vendor-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  const parsed = vendorPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400, headers: NO_STORE });
  try {
    const ok = await updateVendor(ws.tenant.id, (await ctx.params).id, parsed.data);
    return ok ? NextResponse.json({ ok: true }, { headers: NO_STORE }) : NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  } catch (err) {
    console.error("[vendors] update failed:", err);
    return NextResponse.json({ error: "Couldn't save that. Try again." }, { status: 503, headers: NO_STORE });
  }
}
