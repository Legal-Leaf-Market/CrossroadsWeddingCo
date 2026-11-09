import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginTokens, tenants, userSessions, users, type Tenant, type User } from "@/lib/db/schema";
import { HOUSE_TENANT_ID, TRIAL_DAYS } from "@/lib/tenant-constants";

// Account sign-in for businesses using the platform (multi-tenant signup,
// 2026-11-09). Passwordless: the owner types an email, gets a link, taps a
// button, and holds a session cookie. Couples are untouched by any of this:
// their hub link stays their only credential.
//
// Every token, login or session, is 32 random bytes handed to the person and
// stored only as its SHA-256. A copy of the database never yields a working
// link or a working session.

export const SESSION_COOKIE = "cw_session";
const LOGIN_TOKEN_MINUTES = 30;
const SESSION_DAYS = 30;

/**
 * Signups are closed until the owner opens them by setting SIGNUP_OPEN=1.
 * Fail closed: an unset variable means the signup form explains it is not
 * open yet rather than creating accounts on the live wedding site.
 */
export function signupOpen(): boolean {
  return process.env.SIGNUP_OPEN === "1";
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** "Lakeside Sound & Light" -> "lakeside-sound-light". Never empty. */
export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "business";
}

export type SignupResult =
  | { kind: "created"; userId: string }
  | { kind: "exists"; userId: string | null };

/**
 * Create an account (tenant) and its owner in one transaction. An email that
 * already has an account creates nothing: the caller sends that person a
 * sign-in link instead, and the response is identical either way, so the
 * form cannot be used to find out who is a customer.
 */
export async function createAccount(input: {
  businessName: string;
  businessType: string;
  fullName: string;
  email: string;
  phone?: string;
}): Promise<SignupResult> {
  const email = normalizeEmail(input.email);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { kind: "exists", userId: existing.id };

  const base = slugify(input.businessName);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  try {
    return await db.transaction(async (tx) => {
      // Slug collisions get a short random suffix rather than a counter, so
      // two signups racing for "elite-djs" cannot both pick "elite-djs-2".
      const [taken] = await tx.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, base)).limit(1);
      const slug = taken ? `${base}-${randomBytes(3).toString("hex")}` : base;
      const [tenant] = await tx
        .insert(tenants)
        .values({
          name: input.businessName,
          slug,
          kind: "customer",
          businessType: input.businessType,
          plan: "trial",
          trialEndsAt,
        })
        .returning({ id: tenants.id });
      const [user] = await tx
        .insert(users)
        .values({
          tenantId: tenant.id,
          email,
          phone: input.phone || null,
          fullName: input.fullName,
          role: "franchise_owner",
        })
        .returning({ id: users.id });
      return { kind: "created" as const, userId: user.id };
    });
  } catch (err) {
    // Two submissions of the same email at once: the unique index on
    // users.email lets exactly one through. The other is an existing account.
    if (isUniqueViolation(err)) {
      const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      return { kind: "exists", userId: row?.id ?? null };
    }
    throw err;
  }
}

/** Drizzle wraps driver errors; the SQLSTATE lives on a cause somewhere down the chain. */
function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 5 && e; i++) {
    if (typeof e === "object" && e && (e as { code?: string }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/** The account owner behind an email, or null. Only owners can sign in today. */
export async function findOwnerByEmail(email: string): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(tenants, eq(users.tenantId, tenants.id))
    .where(and(eq(users.email, normalizeEmail(email)), eq(users.role, "franchise_owner"), eq(tenants.kind, "customer")))
    .limit(1);
  return row ?? null;
}

/** Mint a single-use sign-in token for a user. Returns the raw token for the email link. */
export async function createLoginToken(userId: string): Promise<string> {
  const token = newToken();
  await db.insert(loginTokens).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + LOGIN_TOKEN_MINUTES * 60 * 1000),
  });
  return token;
}

/**
 * Spend a sign-in token and open a session. The UPDATE carries every
 * condition (unused, unexpired), so two taps on one link cannot both win.
 * Returns the raw session token for the cookie, or null.
 */
export async function redeemLoginToken(token: string): Promise<string | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const [spent] = await db
    .update(loginTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(loginTokens.tokenHash, hashToken(token)),
        isNull(loginTokens.usedAt),
        gt(loginTokens.expiresAt, sql`now()`),
      ),
    )
    .returning({ userId: loginTokens.userId });
  if (!spent) return null;
  const session = newToken();
  await db.insert(userSessions).values({
    tokenHash: hashToken(session),
    userId: spent.userId,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
  });
  return session;
}

export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;

export type Workspace = { user: User; tenant: Tenant };

/**
 * The signed-in owner and their account, from the session cookie, or null.
 * Every workspace query is scoped by the tenant.id this returns, and by
 * nothing the browser sends.
 */
export async function getWorkspace(): Promise<Workspace | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw || !/^[0-9a-f]{64}$/.test(raw)) return null;
  const [row] = await db
    .select({ user: users, tenant: tenants })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .innerJoin(tenants, eq(users.tenantId, tenants.id))
    .where(and(eq(userSessions.tokenHash, hashToken(raw)), gt(userSessions.expiresAt, sql`now()`)))
    .limit(1);
  if (!row || row.tenant.isActive === false) return null;
  return row;
}

/** End the current session server-side, so the cookie is dead even if it was copied. */
export async function endSession(raw: string | undefined): Promise<void> {
  if (!raw || !/^[0-9a-f]{64}$/.test(raw)) return;
  await db.delete(userSessions).where(eq(userSessions.tokenHash, hashToken(raw)));
}

/**
 * For workspace API routes: the signed-in customer account, or null. The
 * house account never uses /app; it has /admin/[key].
 */
export async function getCustomerWorkspace(): Promise<Workspace | null> {
  const ws = await getWorkspace();
  return ws && ws.tenant.kind === "customer" ? ws : null;
}

/**
 * Who may keep the house account's books (Crossroads itself): the emails in
 * HOUSE_BOOKS_EMAILS, comma separated. Read on every request, so removing an
 * email from the setting locks that person out at once, session or not.
 * Unset means nobody: the house books fail closed like every other gated feature.
 */
export function houseBooksEmails(): Set<string> {
  return new Set(
    (process.env.HOUSE_BOOKS_EMAILS ?? "")
      .split(",")
      .map(normalizeEmail)
      .filter((e) => e.includes("@")),
  );
}

/**
 * For the money pages (transactions, books, integrations): a customer account,
 * or a house user whose email is still on the list. The house account's
 * bookings stay in /admin; only its books live under /app.
 */
export async function getBooksWorkspace(): Promise<Workspace | null> {
  const ws = await getWorkspace();
  if (!ws) return null;
  if (ws.tenant.kind === "customer") return ws;
  if (ws.tenant.kind === "house" && houseBooksEmails().has(normalizeEmail(ws.user.email))) return ws;
  return null;
}

/**
 * A sign-in for the house books. Creates the house user the first time a
 * listed email asks for a link. An email that already belongs to a customer
 * account is never moved into the house account.
 */
export async function findOrCreateHouseUser(email: string): Promise<{ id: string } | null> {
  const e = normalizeEmail(email);
  if (!houseBooksEmails().has(e)) return null;
  const local = e.split("@")[0].replace(/[^a-z0-9]+/g, " ").trim();
  await db
    .insert(users)
    .values({ tenantId: HOUSE_TENANT_ID, email: e, fullName: local ? local[0].toUpperCase() + local.slice(1) : "Owner", role: "franchise_owner" })
    .onConflictDoNothing();
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, e), eq(users.tenantId, HOUSE_TENANT_ID)))
    .limit(1);
  return row ?? null;
}

/**
 * Same-origin check for cookie-authenticated writes. SameSite=Lax already
 * keeps the cookie off cross-site POSTs; this is the second lock.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers, and form posts from our own pages
  try {
    return new URL(origin).host === new URL(req.url).host || new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}
