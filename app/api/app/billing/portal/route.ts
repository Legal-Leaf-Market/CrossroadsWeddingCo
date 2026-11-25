import { NextResponse, type NextRequest } from "next/server";
import { getCustomerWorkspace, sameOrigin } from "@/lib/auth";
import { billingConfigured, portalUrl } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe's customer portal: update the card, download invoices, cancel.
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const ws = await getCustomerWorkspace();
  if (!ws) return NextResponse.redirect(new URL("/login", req.url), 303);
  if (!billingConfigured()) return NextResponse.redirect(new URL("/app/billing", req.url), 303);
  try {
    const url = await portalUrl(ws.tenant, new URL(req.url).origin);
    return NextResponse.redirect(url ?? new URL("/app/billing", req.url), 303);
  } catch (err) {
    console.error("[billing] portal failed:", (err as Error).message);
    return NextResponse.redirect(new URL("/app/billing?error=1", req.url), 303);
  }
}
