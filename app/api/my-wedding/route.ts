import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimited } from "@/lib/auth-mail";
import { sendHubLinks } from "@/lib/email";
import { hubsForEmail } from "@/lib/my-wedding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const schema = z.object({ email: z.string().trim().email("That email doesn't look right").max(255) });
// The same answer whether or not the email is on a booking, so this page can't
// be used to check who our clients are.
const SENT = {
  ok: true,
  message: "If that email is on a Crossroads booking, your planning hub link is on its way. Check your inbox (and spam) in a minute.",
};

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the email." }, { status: 400, headers: NO_STORE });
  }
  const email = parsed.data.email.toLowerCase();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(`my-wedding:${ip}`, 10) || rateLimited(`my-wedding:${email}`, 3)) {
    return NextResponse.json({ error: "Too many tries. Give it an hour, or message us." }, { status: 429, headers: NO_STORE });
  }
  try {
    const hubs = await hubsForEmail(email);
    if (hubs.length) {
      if (!process.env.RESEND_API_KEY) {
        if (process.env.NODE_ENV === "production") {
          console.error("[my-wedding] RESEND_API_KEY missing; could not send hub links");
        } else {
          console.log(`[my-wedding] dev hub links for ${email}: ${hubs.map((h) => h.hubPath).join(", ")}`);
        }
      } else {
        await sendHubLinks({ to: email, weddings: hubs });
      }
    }
    return NextResponse.json(SENT, { headers: NO_STORE });
  } catch (err) {
    console.error("[my-wedding] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "That didn't work just now. Try again in a minute." }, { status: 503, headers: NO_STORE });
  }
}
