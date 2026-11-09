import { NextResponse, type NextRequest } from "next/server";
import { getCustomerWorkspace, sameOrigin } from "@/lib/auth";
import { patchBookingSchema } from "@/lib/booking-schema";
import { updateBooking } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getCustomerWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  const { id } = await ctx.params;
  const parsed = patchBookingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400, headers: NO_STORE });
  }
  try {
    const ok = await updateBooking(ws.tenant.id, id, parsed.data);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    console.error("[app/bookings] update failed:", err);
    return NextResponse.json({ error: "Couldn't save that change. Try again in a minute." }, { status: 503, headers: NO_STORE });
  }
}
