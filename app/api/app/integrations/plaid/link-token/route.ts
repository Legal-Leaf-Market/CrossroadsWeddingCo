import { NextResponse, type NextRequest } from "next/server";
import { getBooksWorkspace, sameOrigin } from "@/lib/auth";
import { createLinkToken } from "@/lib/integrations/bank-feed";
import { PlaidError, plaidConfigured } from "@/lib/integrations/plaid-client";
import { secretsConfigured } from "@/lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/** Body: { repair?: connectionId } to fix a bank login that expired; add selectAccounts: true to pick new accounts. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  if (!plaidConfigured() || !secretsConfigured()) {
    return NextResponse.json({ error: "Bank connections aren't set up yet." }, { status: 501, headers: NO_STORE });
  }
  const body = (await req.json().catch(() => ({}))) as { repair?: string; selectAccounts?: boolean };
  try {
    const repair = typeof body.repair === "string" ? body.repair : undefined;
    const linkToken = await createLinkToken(ws.tenant.id, ws.user.id, repair, { selectAccounts: !!repair && body.selectAccounts === true });
    return NextResponse.json({ linkToken }, { headers: NO_STORE });
  } catch (err) {
    const status = err instanceof PlaidError && err.status === 404 ? 404 : 502;
    console.error("[plaid] link token failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't start the bank connection. Try again in a minute." }, { status, headers: NO_STORE });
  }
}
