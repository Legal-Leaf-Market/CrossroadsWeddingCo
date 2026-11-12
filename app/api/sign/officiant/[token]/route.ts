import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { countersignAndNotify, loadForSigning } from "@/lib/officiant-sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The officiant's signing link posts here. The token in the path is the whole
// credential and it opens exactly one action on one agreement: sign it, once,
// before or after the couple accepts. Any mismatch is a 404.
const schema = z.object({
  name: z.string("Type your full name to sign").trim().min(2, "Type your full name to sign").max(255),
  title: z.string().trim().max(255).default(""),
  agreed: z.literal(true, "Tick the box to confirm you are signing"),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const headers = { "Cache-Control": "no-store" };
  const found = await loadForSigning(token);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404, headers });

  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403, headers });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400, headers });

  const r = await countersignAndNotify(found.wedding, parsed.data.name, parsed.data.title);
  if (r === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  if (r === "already_signed") {
    return NextResponse.json({ error: "This agreement is already signed. Refresh to see it." }, { status: 409, headers });
  }
  return NextResponse.json({ ok: true }, { headers });
}
