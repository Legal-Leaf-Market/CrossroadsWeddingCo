import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCustomerWorkspace, sameOrigin } from "@/lib/auth";
import { connectItem } from "@/lib/integrations/bank-feed";
import { PlaidError } from "@/lib/integrations/plaid-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

const schema = z.object({
  publicToken: z.string().min(10).max(300),
  institution: z.object({ id: z.string().max(100).nullish(), name: z.string().max(200).nullish() }).optional().default({}),
});

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const ws = await getCustomerWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400, headers: NO_STORE });
  try {
    const id = await connectItem(ws.tenant.id, ws.user.id, parsed.data.publicToken, parsed.data.institution);
    return NextResponse.json({ id }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof PlaidError && err.status === 409) {
      return NextResponse.json({ error: err.message }, { status: 409, headers: NO_STORE });
    }
    console.error("[plaid] exchange failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "The bank connected, but we couldn't save it. Try again." }, { status: 502, headers: NO_STORE });
  }
}
