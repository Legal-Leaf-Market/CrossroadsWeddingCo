import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auditQuietly } from "@/lib/audit";
import { db } from "@/lib/db";
import { integrationConnections } from "@/lib/db/schema";
import { connectionIdForItem, markConnection, revokeConnection, setNewAccounts, syncConnection } from "@/lib/integrations/bank-feed";
import { plaidConfigured, verifyPlaidWebhook } from "@/lib/integrations/plaid-client";
import { plaidWebhookAction, type PlaidWebhook } from "@/lib/integrations/plaid-webhook-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Plaid calls this when an item has new transactions or needs attention.
// Nothing is trusted until the Plaid-Verification JWT checks out against the
// exact body (lib/integrations/plaid-client.ts). What each message means is
// plaidWebhookAction (lib/integrations/plaid-webhook-logic.ts, checked by
// scripts/verify-plaid.mjs). Unknown items and webhook types get a 200 so
// Plaid stops retrying; we only act on what we know. Every status change is
// written to the audit log.
export async function POST(req: NextRequest) {
  if (!plaidConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 501 });
  const raw = await req.text();
  if (!(await verifyPlaidWebhook(raw, req.headers.get("plaid-verification")))) {
    return NextResponse.json({ error: "Unverified" }, { status: 401 });
  }
  let event: PlaidWebhook & { item_id?: string };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  const connectionId = event.item_id ? await connectionIdForItem(event.item_id) : null;
  if (!connectionId) return NextResponse.json({ ok: true, ignored: "unknown item" });

  const type = `${event.webhook_type}:${event.webhook_code}`;
  const action = plaidWebhookAction(event);
  if (action.kind === "ignore") return NextResponse.json({ ok: true, ignored: type });
  try {
    // Awaited: a serverless function can freeze once the response is sent.
    if (action.kind === "sync") {
      await syncConnection(connectionId);
      return NextResponse.json({ ok: true });
    }
    const [before] = await db
      .select({ tenantId: integrationConnections.tenantId, status: integrationConnections.status })
      .from(integrationConnections)
      .where(eq(integrationConnections.id, connectionId))
      .limit(1);
    if (action.kind === "status") await markConnection(connectionId, action.status, action.note ?? undefined);
    else if (action.kind === "revoked") await revokeConnection(connectionId, action.note);
    else if (action.kind === "new_accounts") await setNewAccounts(connectionId, true);
    if (before) {
      await auditQuietly({
        tenantId: before.tenantId,
        actor: "plaid webhook",
        action: `bank_connection.${action.kind}`,
        entityType: "integration_connection",
        entityId: connectionId,
        before: { status: before.status },
        after: action.kind === "status" ? { status: action.status } : action.kind === "revoked" ? { status: "disconnected" } : { newAccounts: true },
        cause: type,
      });
    }
  } catch (err) {
    console.error("[plaid webhook] handling failed:", type, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Retry" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
