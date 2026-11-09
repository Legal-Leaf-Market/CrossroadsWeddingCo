import { NextResponse, type NextRequest } from "next/server";
import { connectionIdForItem, markConnection, syncConnection } from "@/lib/integrations/bank-feed";
import { plaidConfigured, verifyPlaidWebhook } from "@/lib/integrations/plaid-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Plaid calls this when an item has new transactions or needs attention.
// Nothing is trusted until the Plaid-Verification JWT checks out against the
// exact body (lib/integrations/plaid-client.ts). Unknown items and webhook
// types get a 200 so Plaid stops retrying; we only act on what we know.
export async function POST(req: NextRequest) {
  if (!plaidConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 501 });
  const raw = await req.text();
  if (!(await verifyPlaidWebhook(raw, req.headers.get("plaid-verification")))) {
    return NextResponse.json({ error: "Unverified" }, { status: 401 });
  }
  let event: { webhook_type?: string; webhook_code?: string; item_id?: string; error?: { error_code?: string } | null };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  const connectionId = event.item_id ? await connectionIdForItem(event.item_id) : null;
  if (!connectionId) return NextResponse.json({ ok: true, ignored: "unknown item" });

  const type = `${event.webhook_type}:${event.webhook_code}`;
  try {
    if (type === "TRANSACTIONS:SYNC_UPDATES_AVAILABLE") {
      // Awaited: a serverless function can freeze once the response is sent.
      await syncConnection(connectionId);
    } else if (type === "ITEM:ERROR" && event.error?.error_code === "ITEM_LOGIN_REQUIRED") {
      await markConnection(connectionId, "needs_reauth", "Your bank needs you to log in again.");
    } else if (type === "ITEM:PENDING_EXPIRATION" || type === "ITEM:PENDING_DISCONNECT") {
      await markConnection(connectionId, "needs_reauth", "Your bank connection expires soon. Log in again to keep it.");
    } else if (type === "ITEM:LOGIN_REPAIRED") {
      await markConnection(connectionId, "active");
    }
  } catch (err) {
    console.error("[plaid webhook] handling failed:", type, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Retry" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
