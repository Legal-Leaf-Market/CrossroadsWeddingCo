import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sendTeamInboxAlert } from "@/lib/email";
import { getWeddingByToken } from "@/lib/hub";
import { addMessage, getThread, markThreadRead } from "@/lib/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await getThread(wedding.id);
  // Opening the thread is reading it; last-write-wins, same as the live view.
  await markThreadRead(wedding.id, "couple");
  return NextResponse.json({ messages }, { headers: NO_STORE });
}

const postSchema = z.object({
  body: z.string().trim().min(1, "Say something first.").max(4000),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const message = await addMessage(wedding.id, "couple", wedding.coupleNames, parsed.data.body);

  // Awaited before responding (serverless freeze); failure never loses the
  // message itself, only the heads-up email.
  await Promise.allSettled([
    sendTeamInboxAlert({
      coupleNames: wedding.coupleNames,
      preview: parsed.data.body.slice(0, 500),
      weddingId: wedding.id,
    }),
  ]);

  return NextResponse.json({ message }, { headers: NO_STORE });
}
