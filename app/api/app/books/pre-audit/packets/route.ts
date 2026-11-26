import { NextResponse, type NextRequest } from "next/server";
import { getBooksWorkspace, sameOrigin } from "@/lib/auth";
import { PacketTooLarge, savePreAuditPacket } from "@/lib/books/pre-audit-packets";
import { preAuditRange } from "@/lib/books/pre-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  if (!sameOrigin(req) || req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  }
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers });
  const form = await req.formData().catch(() => null);
  const raw = form?.get("year");
  const range = preAuditRange(raw);
  if (raw !== String(range.year)) {
    return NextResponse.json({ error: "Choose a valid review year." }, { status: 400, headers });
  }
  try {
    const id = await savePreAuditPacket(ws.tenant.id, ws.user.id, ws.user.email, range, form?.get("includeReceipts") === "on");
    const destination = new URL(`/app/books/pre-audit?year=${range.year}&saved=${id}#saved-packets`, req.url);
    return NextResponse.redirect(destination, { status: 303, headers });
  } catch (error) {
    if (error instanceof PacketTooLarge) {
      const destination = new URL(`/app/books/pre-audit?year=${range.year}&packet=too-large#saved-packets`, req.url);
      return NextResponse.redirect(destination, { status: 303, headers });
    }
    throw error;
  }
}
