import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { crewForToken, receiptFromForm, submitClaim, todayLocal } from "@/lib/expenses";
import { parseAmount, spentOnBlock } from "@/lib/expense-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const UUID = z.union([z.string().uuid(), z.literal("")]);

const fields = z.object({
  amount: z.string().trim().max(20),
  spentOn: z.string().trim().max(10),
  merchant: z.string().trim().min(1, "Say where you paid.").max(160),
  description: z.string().trim().min(2, "Say what it was for.").max(1000),
  weddingId: UUID,
  categoryId: UUID,
});

// A crew member sends one claim from their capture link: multipart, with an
// optional receipt. The link is the credential (lib/expense-token.ts).
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const crew = await crewForToken(token);
  if (!crew) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "That didn't come through. Try again." }, { status: 400, headers: NO_STORE });
  }
  const parsed = fields.safeParse({
    amount: String(form.get("amount") ?? ""),
    spentOn: String(form.get("spentOn") ?? ""),
    merchant: String(form.get("merchant") ?? ""),
    description: String(form.get("description") ?? ""),
    weddingId: String(form.get("weddingId") ?? ""),
    categoryId: String(form.get("categoryId") ?? ""),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400, headers: NO_STORE });
  }
  const amountCents = parseAmount(parsed.data.amount);
  if (amountCents === null) return NextResponse.json({ error: "Put the amount in dollars, like 12.50 (up to $5,000)." }, { status: 400, headers: NO_STORE });
  const dateBlock = spentOnBlock(parsed.data.spentOn, todayLocal());
  if (dateBlock) return NextResponse.json({ error: dateBlock }, { status: 400, headers: NO_STORE });
  const rec = await receiptFromForm(form, false);
  if ("error" in rec) return NextResponse.json({ error: rec.error }, { status: rec.status, headers: NO_STORE });

  try {
    const res = await submitClaim(crew, {
      amountCents,
      spentOn: parsed.data.spentOn,
      merchant: parsed.data.merchant,
      description: parsed.data.description,
      weddingId: parsed.data.weddingId || null,
      categoryId: parsed.data.categoryId || null,
      receipt: rec.receipt,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status, headers: NO_STORE });
    return NextResponse.json({ ok: true, id: res.id }, { status: 201, headers: NO_STORE });
  } catch (err) {
    console.error("[expenses] submit failed", err);
    return NextResponse.json({ error: "That didn't save. Try again in a minute." }, { status: 500, headers: NO_STORE });
  }
}
