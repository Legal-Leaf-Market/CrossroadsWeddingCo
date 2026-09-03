import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  MAX_INVITE_EMAILS,
  addSpeaker,
  cleanEmails,
  setInviteEmails,
} from "@/lib/hub-access";
import { getWeddingByToken } from "@/lib/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

const patchSchema = z.object({
  emails: z.array(z.string()).max(MAX_INVITE_EMAILS * 2),
});
const postSchema = z.object({ name: z.string() });

/** Replace the invite list. Whole list, not a diff: last write wins, same as
 *  every other hub section, and the client always sends what it is showing. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  }

  // Anything unusable is dropped rather than rejected: a half-typed address in
  // a row the couple has not finished should not block saving the rest.
  const kept = cleanEmails(parsed.data.emails);
  const emails = await setInviteEmails(wedding.id, kept);
  return NextResponse.json({ emails }, { headers: NO_STORE });
}

/** Add a first name to the picker. Idempotent by name, case-insensitively. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  }

  const { speakers, error } = await addSpeaker(
    wedding.id,
    wedding.hubSpeakers ?? [],
    parsed.data.name,
  );
  if (error) return NextResponse.json({ error }, { status: 400, headers: NO_STORE });
  return NextResponse.json({ speakers }, { headers: NO_STORE });
}
