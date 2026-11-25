import { NextResponse, type NextRequest } from "next/server";
import { getBooksWorkspace, sameOrigin } from "@/lib/auth";
import { createVendor } from "@/lib/vendors";
import { vendorCreateSchema } from "@/lib/vendor-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  const parsed = vendorCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400, headers: NO_STORE });
  try {
    return NextResponse.json({ id: await createVendor(ws.tenant.id, parsed.data) }, { headers: NO_STORE });
  } catch (err) {
    console.error("[vendors] create failed:", err);
    return NextResponse.json({ error: "Couldn't save that vendor. Try again." }, { status: 503, headers: NO_STORE });
  }
}
