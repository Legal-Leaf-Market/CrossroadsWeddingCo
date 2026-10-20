import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminKeyMatches, countersignContract } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The company's signature on a couple's agreement. Admin-key gated, 404 on any
// mismatch. Written once and never overwritten, the same rule the couple's
// acceptance follows: a signature that can be quietly re-done is not one.
const schema = z.object({
  name: z.string("Type your full name to sign").trim().min(2, "Type your full name to sign").max(255),
  title: z.string().trim().max(255).default(""),
  agreed: z.literal(true, "Tick the box to confirm you are signing"),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ key: string; weddingId: string }> },
) {
  const { key, weddingId } = await ctx.params;
  if (!adminKeyMatches(key)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const result = await countersignContract(weddingId, parsed.data.name, parsed.data.title);
  const headers = { "Cache-Control": "no-store" };
  if (result === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  if (result === "not_accepted") {
    return NextResponse.json(
      { error: "The couple hasn't accepted this agreement yet, so there is nothing to countersign." },
      { status: 409, headers },
    );
  }
  if (result === "already_signed") {
    return NextResponse.json(
      { error: "This agreement is already signed for Crossroads. Refresh to see it." },
      { status: 409, headers },
    );
  }
  return NextResponse.json({ ok: true }, { headers });
}
