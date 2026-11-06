import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminKeyMatches } from "@/lib/admin";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The shared call log behind /admin/[key]/playbook (2026-11-06). The page polls
// GET and writes one lead (or one booking) at a time. Same gate as the rest of
// /admin: a wrong key 404s. The claude.ai copy of the playbook keeps its own
// log; this one is the site's.
const NO_STORE = { "Cache-Control": "no-store" };
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
const bad = (m: string) => NextResponse.json({ error: m }, { status: 400, headers: NO_STORE });

const s = (n: number) => z.string().max(n).optional().default("");
const callSchema = z.object({
  kind: z.literal("call"),
  id: z.string().regex(/^[a-z0-9-]{1,100}$/),
  data: z.object({
    status: s(20),
    note: s(4000),
    followUp: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().default(""),
    stars: z.union([z.literal(""), z.number().int().min(1).max(5), z.string().regex(/^[1-5]$/)]).optional().default(""),
    starWhy: s(300),
    starBy: s(40),
    at: z.number().int().nonnegative(),
    by: s(40),
  }),
});
const bookedSchema = z.object({
  kind: z.literal("booked"),
  data: z.object({
    type: z.enum(["wedding", "corporate"]),
    name: z.string().trim().min(1).max(120),
    date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().default(""),
    by: s(40),
    at: z.number().int().nonnegative(),
  }),
});
const bodySchema = z.discriminatedUnion("kind", [callSchema, bookedSchema]);

export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!adminKeyMatches(key)) return notFound();
  try {
    const [calls, booked] = await Promise.all([
      pool.query<{ lead_id: string; data: Record<string, unknown> }>("SELECT lead_id, data FROM playbook_calls"),
      pool.query<{ id: string; data: Record<string, unknown> }>(
        "SELECT id, data FROM playbook_bookings ORDER BY created_at",
      ),
    ]);
    return NextResponse.json(
      {
        calls: calls.rows.map((r) => ({ id: r.lead_id, data: r.data })),
        booked: booked.rows.map((r) => ({ id: r.id, data: r.data })),
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("[playbook] read failed", err);
    return NextResponse.json({ error: "The call log is unavailable" }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!adminKeyMatches(key)) return notFound();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid request");
  try {
    if (parsed.data.kind === "call") {
      await pool.query(
        `INSERT INTO playbook_calls (lead_id, data, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (lead_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [parsed.data.id, JSON.stringify(parsed.data.data)],
      );
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    }
    const r = await pool.query<{ id: string }>("INSERT INTO playbook_bookings (data) VALUES ($1) RETURNING id", [
      JSON.stringify(parsed.data.data),
    ]);
    return NextResponse.json({ ok: true, id: r.rows[0]?.id }, { headers: NO_STORE });
  } catch (err) {
    console.error("[playbook] write failed", err);
    return NextResponse.json({ error: "Didn't save. Try again" }, { status: 503, headers: NO_STORE });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!adminKeyMatches(key)) return notFound();
  const id = req.nextUrl.searchParams.get("booked") ?? "";
  if (!z.string().uuid().safeParse(id).success) return bad("Unknown booking");
  try {
    await pool.query("DELETE FROM playbook_bookings WHERE id = $1", [id]);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    console.error("[playbook] delete failed", err);
    return NextResponse.json({ error: "Couldn't remove that booking" }, { status: 503, headers: NO_STORE });
  }
}
