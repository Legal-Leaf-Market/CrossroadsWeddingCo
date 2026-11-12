import { NextResponse, type NextRequest } from "next/server";
import { getCustomerWorkspace, sameOrigin } from "@/lib/auth";
import { billingConfigured, hasLiveSubscription, portalUrl, startCheckout } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A plain form POST from /app/billing. Answers with a 303 to Stripe Checkout,
// or to the customer portal when the account already has a live plan (never
// a second subscription).
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const ws = await getCustomerWorkspace();
  if (!ws) return NextResponse.redirect(new URL("/login", req.url), 303);
  if (!billingConfigured()) return NextResponse.redirect(new URL("/app/billing", req.url), 303);
  const origin = new URL(req.url).origin;
  try {
    if (hasLiveSubscription(ws.tenant)) {
      const url = await portalUrl(ws.tenant, origin);
      return NextResponse.redirect(url ?? new URL("/app/billing", req.url), 303);
    }
    const url = await startCheckout(ws.tenant, ws.user.email, origin);
    return NextResponse.redirect(url, 303);
  } catch (err) {
    console.error("[billing] checkout failed:", (err as Error).message);
    return NextResponse.redirect(new URL("/app/billing?error=1", req.url), 303);
  }
}
