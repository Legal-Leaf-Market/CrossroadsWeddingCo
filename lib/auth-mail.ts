import { createLoginToken } from "@/lib/auth";
import { sendLoginLink } from "@/lib/email";
import { SITE_URL } from "@/lib/site";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

/** Email can carry a sign-in link. In development the link is logged instead. */
export function loginMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY) || process.env.NODE_ENV !== "production";
}

/**
 * Mint a link and send it. Without RESEND_API_KEY outside production the link
 * goes to the server log so the flow can be tested locally; in production
 * that path is unreachable because loginMailConfigured() is checked first.
 */
export async function mailLoginLink(user: { id: string; email: string; fullName: string }, isNewAccount: boolean): Promise<boolean> {
  const token = await createLoginToken(user.id);
  const link = `${SITE_URL}/login/verify?t=${token}`;
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "production") return false;
    console.log(`[auth] dev sign-in link for ${user.email}: ${link}`);
    return true;
  }
  return sendLoginLink({ to: user.email, fullName: user.fullName, link, isNewAccount, platformName: PLATFORM_NAME });
}

// Per-instance limiter, the same shape as /api/reviews: it slows a script,
// it is not a security boundary. Sign-in links only ever go to the address
// typed, so the cost of a flood is email volume, not access.
const WINDOW_MS = 60 * 60 * 1000;
const buckets = new Map<string, { count: number; start: number }>();
export function rateLimited(key: string, max: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.start > WINDOW_MS) {
    buckets.set(key, { count: 1, start: now });
    return false;
  }
  b.count += 1;
  return b.count > max;
}
