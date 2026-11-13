import { NextResponse } from "next/server";
import { cronAuthorized, cronConfigured } from "@/lib/cron-auth";
import { plaidConfigured } from "@/lib/integrations/plaid-client";
import { syncAllConnections } from "@/lib/integrations/bank-feed";

// Daily backup sync for the bank feeds (2026-11-13). New transactions arrive
// when Plaid calls /api/webhooks/plaid; this catches any webhook that never
// came. Called once a day by netlify/functions/bank-sync-daily.mjs with the
// job token from lib/cron-auth.ts (or CRON_SECRET). Fails closed: no secret,
// wrong secret or no Plaid keys means nothing runs.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 26;

export async function GET(request: Request) {
  if (!cronConfigured()) return NextResponse.json({ skipped: "cron not configured" }, { status: 501 });
  if (!cronAuthorized(request.headers.get("authorization"), "bank-sync")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!plaidConfigured()) return NextResponse.json({ skipped: "plaid not configured" });
  const result = await syncAllConnections(20_000);
  console.log("[cron] bank sync", JSON.stringify(result));
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
