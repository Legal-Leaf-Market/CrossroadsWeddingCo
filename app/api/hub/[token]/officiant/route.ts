import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getWeddingByToken } from "@/lib/hub";
import { acceptOfficiantAgreement, getOfficiantAgreement } from "@/lib/service-agreements";
import { isHouseTenant } from "@/lib/tenant-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  acceptedName: z.string("Type your name to accept").trim().min(2, "Type your full name to accept").max(255),
});

// The couple accepts the officiating agreement. Once only: a second accept is
// refused (409), never an overwrite of the terms already agreed.
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const headers = { "Cache-Control": "no-store" };
  const wedding = await getWeddingByToken(token);
  if (!wedding || !isHouseTenant(wedding.tenantId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  }
  const a = await getOfficiantAgreement(wedding.id);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  if (a.acceptedAt) {
    return NextResponse.json({ error: "This agreement is already accepted." }, { status: 409, headers });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400, headers });
  }

  const done = await acceptOfficiantAgreement(a, wedding, parsed.data.acceptedName);
  if (!done) return NextResponse.json({ error: "This agreement is already accepted." }, { status: 409, headers });
  return NextResponse.json(
    { ok: true, acceptedAt: done.at.toISOString(), acceptedName: parsed.data.acceptedName },
    { headers },
  );
}
