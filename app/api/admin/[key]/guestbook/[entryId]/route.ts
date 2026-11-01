import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminKeyMatches } from "@/lib/admin";
import { moderateEntry } from "@/lib/guestbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner moderation for the /reviews guestbook. Admin-key gated, 404 on mismatch.
const schema = z.object({
  status: z.enum(["approved", "removed", "pending"]).optional(),
  featured: z.boolean().optional(),
});
const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string; entryId: string }> },
) {
  const { key, entryId } = await params;
  if (!adminKeyMatches(key) || !UUID_RE.test(entryId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid change" }, { status: 400 });
  const ok = await moderateEntry(entryId, parsed.data);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
