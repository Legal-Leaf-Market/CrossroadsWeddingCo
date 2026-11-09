import { NextResponse, type NextRequest } from "next/server";
import { getCustomerWorkspace, sameOrigin } from "@/lib/auth";
import { createBookingSchema } from "@/lib/booking-schema";
import { createBooking } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getCustomerWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  const parsed = createBookingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400, headers: NO_STORE });
  }
  try {
    const id = await createBooking(ws.tenant.id, parsed.data);
    return NextResponse.json({ id }, { headers: NO_STORE });
  } catch (err) {
    console.error("[app/bookings] create failed:", err);
    return NextResponse.json({ error: "Couldn't save that booking. Try again in a minute." }, { status: 503, headers: NO_STORE });
  }
}
