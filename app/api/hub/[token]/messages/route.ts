import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sendTeamInboxAlert } from "@/lib/email";
import { hasSpeaker } from "@/lib/hub-access";
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
  // Who is writing. Optional so an older cached hub page keeps posting, and
  // validated against this wedding's own roster below rather than trusted.
  senderName: z.string().max(40).optional(),
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

  // Declared identity, checked against the wedding's roster. An unknown name
  // falls back to the couple's display name rather than being rejected: the
  // worst case is a message attributed to the household instead of a person,
  // which is exactly where this started, and losing a couple's message over a
  // stale picker would be far worse.
  const speakers = wedding.hubSpeakers ?? [];
  const claimed = (parsed.data.senderName ?? "").trim();
  const senderName =
    claimed && hasSpeaker(speakers, claimed) ? claimed : wedding.coupleNames;

  const message = await addMessage(wedding.id, "couple", senderName, parsed.data.body);

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
