import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBooksWorkspace, sameOrigin } from "@/lib/auth";
import { setOpeningBalance } from "@/lib/books/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

const schema = z.object({
  bankAccountId: z.string().max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Dollars as typed, "1,234.56" or "-20". Converted to cents here, never through floats twice.
  balance: z.string().max(20).regex(/^-?[\d,]*(\.\d{0,2})?$/),
});

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a date and an amount like 1250.00." }, { status: 400, headers: NO_STORE });
  const { bankAccountId, date, balance } = parsed.data;
  const clean = balance.replace(/,/g, "");
  if (!/\d/.test(clean)) return NextResponse.json({ error: "Enter an amount." }, { status: 400, headers: NO_STORE });
  const neg = clean.startsWith("-");
  const [whole, frac = ""] = clean.replace("-", "").split(".");
  const cents = (Number(whole || "0") * 100 + Number((frac + "00").slice(0, 2))) * (neg ? -1 : 1);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > 100_000_000_00) {
    return NextResponse.json({ error: "That amount is too large." }, { status: 400, headers: NO_STORE });
  }
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) {
    return NextResponse.json({ error: "That date isn't real." }, { status: 400, headers: NO_STORE });
  }
  try {
    const r = await setOpeningBalance(ws.tenant.id, ws.user.id, bankAccountId, date, cents);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    console.error("[ledger] opening balance failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't save that. Try again in a minute." }, { status: 500, headers: NO_STORE });
  }
}
