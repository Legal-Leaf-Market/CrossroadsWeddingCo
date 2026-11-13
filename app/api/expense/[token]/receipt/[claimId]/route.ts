import { NextResponse, type NextRequest } from "next/server";
import { crewForToken, receiptFor, receiptResponse } from "@/lib/expenses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The claimant's own receipt, through their capture link: only claims that
// crew member made, in their own account.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string; claimId: string }> }) {
  const { token, claimId } = await ctx.params;
  const crew = await crewForToken(token);
  if (!crew) return new NextResponse("Not found", { status: 404 });
  const r = await receiptFor(crew.tenantId, claimId, crew.id);
  return r ? receiptResponse(r) : new NextResponse("Not found", { status: 404 });
}
