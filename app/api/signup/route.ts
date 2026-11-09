import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createAccount, signupOpen } from "@/lib/auth";
import { loginMailConfigured, mailLoginLink, rateLimited } from "@/lib/auth-mail";
import { BUSINESS_TYPES } from "@/lib/tenant-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const TYPE_KEYS = BUSINESS_TYPES.map((t) => t.key) as [string, ...string[]];

const schema = z.object({
  businessName: z.string().trim().min(2, "Add your business name").max(120),
  businessType: z.enum(TYPE_KEYS, { message: "Pick what kind of business you run" }),
  fullName: z.string().trim().min(2, "Add your name").max(120),
  email: z.string().trim().email("That email doesn't look right").max(255),
  phone: z.string().trim().max(40).optional().default(""),
  website: z.string().optional().default(""), // honeypot
});

// Same answer whether the email was new or already had an account, so the
// form can't be used to check who is a customer.
const SENT = { ok: true, message: "Check your email for a link to sign in." };

export async function POST(req: NextRequest) {
  if (!signupOpen()) {
    return NextResponse.json({ error: "Signups aren't open yet." }, { status: 403, headers: NO_STORE });
  }
  if (!loginMailConfigured()) {
    return NextResponse.json(
      { error: "Sign-in email isn't set up yet, so we can't create accounts right now." },
      { status: 503, headers: NO_STORE },
    );
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(`signup:${ip}`, 5)) {
    return NextResponse.json({ error: "Too many tries. Give it an hour." }, { status: 429, headers: NO_STORE });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Something in that form isn't right." },
      { status: 400, headers: NO_STORE },
    );
  }
  const data = parsed.data;
  if (data.website) return NextResponse.json(SENT, { headers: NO_STORE });

  try {
    const result = await createAccount(data);
    if (result.userId) {
      const [user] = await db
        .select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role })
        .from(users)
        .where(eq(users.id, result.userId))
        .limit(1);
      // An existing email that belongs to a couple or the house team gets no
      // link: only account owners sign in here.
      if (user && (result.kind === "created" || user.role === "franchise_owner")) {
        const sent = await mailLoginLink(user, result.kind === "created");
        if (!sent) {
          return NextResponse.json(
            {
              error:
                result.kind === "created"
                  ? "Your account was created, but the sign-in email didn't send. Try signing in from the login page in a minute."
                  : "We couldn't send the email right now. Try again in a minute.",
            },
            { status: 502, headers: NO_STORE },
          );
        }
      }
    }
    return NextResponse.json(SENT, { headers: NO_STORE });
  } catch (err) {
    console.error("[signup] failed:", err);
    return NextResponse.json(
      { error: "We couldn't create the account right now. Please try again in a minute." },
      { status: 503, headers: NO_STORE },
    );
  }
}
