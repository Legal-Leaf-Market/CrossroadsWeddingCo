import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, endSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await endSession(req.cookies.get(SESSION_COOKIE)?.value);
  } catch (err) {
    console.error("[auth] logout failed:", err);
  }
  const res = NextResponse.redirect(new URL("/login?signedout=1", req.url), 303);
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
