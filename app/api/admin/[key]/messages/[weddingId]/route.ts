import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminKeyMatches, getAdminWedding } from "@/lib/admin";
import { sendHubMessagePointer } from "@/lib/email";
import { addMessage, getThread, markThreadRead } from "@/lib/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

type Ctx = { params: Promise<{ key: string; weddingId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { key, weddingId } = await ctx.params;
  if (!adminKeyMatches(key)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const wedding = await getAdminWedding(weddingId);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await getThread(wedding.id);
  await markThreadRead(wedding.id, "team");
  return NextResponse.json({ messages }, { headers: NO_STORE });
}

const postSchema = z.object({
  body: z.string().trim().min(1, "Say something first.").max(4000),
  senderName: z.enum(["Jake", "Nic"]).default("Jake"),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  const { key, weddingId } = await ctx.params;
  if (!adminKeyMatches(key)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const wedding = await getAdminWedding(weddingId);
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

  const message = await addMessage(wedding.id, "team", parsed.data.senderName, parsed.data.body);

  // Pointer email only ("you have a new message"): the content stays in the
  // hub thread. Awaited before responding (serverless freeze).
  if (wedding.contactEmail) {
    await Promise.allSettled([
      sendHubMessagePointer({ to: wedding.contactEmail, hubPath: `/hub/${wedding.accessToken}` }),
    ]);
  }

  return NextResponse.json({ message }, { headers: NO_STORE });
}
