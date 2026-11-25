import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminKeyMatches } from "@/lib/admin";
import { createAccount, setAccountManager } from "@/lib/sales";
import { CRM_KINDS } from "@/lib/sales-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner-only CRM writes: add an account, or change who manages one. Changing
// the manager affects sales made from now on; earlier deals keep their terms.
const NO_STORE = { "Cache-Control": "no-store" };
const uuidOrNull = z.union([z.string().uuid(), z.literal(""), z.null()]).optional().transform((v) => v || null);
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().trim().min(2, "Enter the account's name").max(160),
    kind: z.enum(CRM_KINDS),
    managerCrewId: uuidOrNull,
    contactName: z.string().trim().max(160).optional().default(""),
    contactEmail: z.union([z.literal(""), z.string().trim().email("Check the email address").max(255)]).optional().default(""),
    contactPhone: z.string().trim().max(50).optional().default(""),
    notes: z.string().trim().max(2000).optional().default(""),
    playbookLeadId: z.union([z.string().regex(/^[a-z0-9-]{1,100}$/), z.literal(""), z.null()]).optional().transform((v) => v || null),
  }),
  z.object({ action: z.literal("manager"), accountId: z.string().uuid(), managerCrewId: uuidOrNull }),
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!adminKeyMatches(key)) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form" }, { status: 400, headers: NO_STORE });
  const d = parsed.data;
  if (d.action === "manager") {
    const ok = await setAccountManager(d.accountId, d.managerCrewId);
    return ok ? NextResponse.json({ ok: true }, { headers: NO_STORE }) : NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  const { action: _a, ...input } = d;
  void _a;
  const r = await createAccount(input);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400, headers: NO_STORE });
  return NextResponse.json({ ok: true, id: r.id }, { headers: NO_STORE });
}
