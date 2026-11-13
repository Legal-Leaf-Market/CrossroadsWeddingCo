import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBooksWorkspace, sameOrigin } from "@/lib/auth";
import { attachCardReceipt, receiptFromForm } from "@/lib/expenses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Attach a receipt to a money-out bank line from the transactions page.
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "That upload didn't come through." }, { status: 400, headers: NO_STORE });
  }
  const line = z.string().uuid().safeParse(String(form.get("bankTransactionId") ?? ""));
  if (!line.success) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const rec = await receiptFromForm(form, true);
  if ("error" in rec) return NextResponse.json({ error: rec.error }, { status: rec.status, headers: NO_STORE });
  try {
    const res = await attachCardReceipt(ws.tenant.id, { email: ws.user.email, fullName: ws.user.fullName }, line.data, rec.receipt!);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status, headers: NO_STORE });
    return NextResponse.json({ ok: true, claimId: res.claimId }, { status: 201, headers: NO_STORE });
  } catch (err) {
    console.error("[expenses] receipt attach failed", err);
    return NextResponse.json({ error: "That didn't save." }, { status: 500, headers: NO_STORE });
  }
}
