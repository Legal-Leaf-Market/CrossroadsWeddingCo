import { NextResponse, type NextRequest } from "next/server";
import { getBooksWorkspace } from "@/lib/auth";
import { receiptFor, receiptResponse } from "@/lib/expenses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A receipt for whoever keeps this account's books, scoped to their tenant.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ws = await getBooksWorkspace();
  if (!ws) return new NextResponse("Not found", { status: 404 });
  const { id } = await ctx.params;
  const r = await receiptFor(ws.tenant.id, id);
  return r ? receiptResponse(r) : new NextResponse("Not found", { status: 404 });
}
