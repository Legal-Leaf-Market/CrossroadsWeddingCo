import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { findOwnerByEmail, normalizeEmail } from "@/lib/auth";
import { loginMailConfigured, mailLoginLink, rateLimited } from "@/lib/auth-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const schema = z.object({ email: z.string().trim().email("That email doesn't look right").max(255) });
const SENT = { ok: true, message: "If that email has an account, a sign-in link is on its way." };

export async function POST(req: NextRequest) {
  if (!loginMailConfigured()) {
    return NextResponse.json({ error: "Sign-in email isn't set up yet." }, { status: 503, headers: NO_STORE });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the email." }, { status: 400, headers: NO_STORE });
  }
  const email = normalizeEmail(parsed.data.email);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(`login:${ip}`, 10) || rateLimited(`login:${email}`, 5)) {
    return NextResponse.json({ error: "Too many tries. Give it an hour." }, { status: 429, headers: NO_STORE });
  }
  try {
    const owner = await findOwnerByEmail(email);
    if (owner) {
      const [user] = await db
        .select({ id: users.id, email: users.email, fullName: users.fullName })
        .from(users)
        .where(eq(users.id, owner.id))
        .limit(1);
      if (user && !(await mailLoginLink(user, false))) {
        return NextResponse.json({ error: "We couldn't send the email right now. Try again in a minute." }, { status: 502, headers: NO_STORE });
      }
    }
    return NextResponse.json(SENT, { headers: NO_STORE });
  } catch (err) {
    console.error("[login] failed:", err);
    return NextResponse.json({ error: "Sign-in isn't working right now. Try again in a minute." }, { status: 503, headers: NO_STORE });
  }
}
