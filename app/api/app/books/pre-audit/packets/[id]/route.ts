import { NextResponse } from "next/server";
import { getBooksWorkspace } from "@/lib/auth";
import { checksum, loadPreAuditPacket } from "@/lib/books/pre-audit-packets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ws = await getBooksWorkspace();
  const { id } = await params;
  if (!ws || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)) {
    return new NextResponse("Not found", { status: 404, headers: noStore });
  }
  const packet = await loadPreAuditPacket(ws.tenant.id, id);
  if (!packet) return new NextResponse("Not found", { status: 404, headers: noStore });
  if (checksum(packet.archive) !== packet.sha256) {
    return new NextResponse("Packet checksum could not be verified.", { status: 500, headers: noStore });
  }

  return new NextResponse(new Uint8Array(packet.archive), {
    headers: {
      ...noStore,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="pre-audit-${packet.year}-${id}.zip"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
