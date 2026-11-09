import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, redeemLoginToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A plain HTML form posts here from /login/verify, so sign-in works with no
// script at all. GET is deliberately not handled: mail scanners fetch links.
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("t") ?? "");
  let session: string | null = null;
  try {
    session = await redeemLoginToken(token);
  } catch (err) {
    console.error("[auth] verify failed:", err);
  }
  if (!session) {
    return NextResponse.redirect(new URL("/login?expired=1", req.url), 303);
  }
  const res = NextResponse.redirect(new URL("/app", req.url), 303);
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
