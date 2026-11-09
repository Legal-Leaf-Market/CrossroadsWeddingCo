import { createHash, createPublicKey, verify as verifySignature, type JsonWebKey } from "node:crypto";

// Thin Plaid REST client: plain fetch, no SDK, so the project gains no
// dependency. Only the calls the bank feed needs. Docs: plaid.com/docs/api.
//
// Configuration (all server-side; nothing here reaches a browser except the
// short-lived link_token):
//   PLAID_CLIENT_ID, PLAID_SECRET   from the Plaid dashboard
//   PLAID_ENV                        "sandbox" (default) or "production"
//   PLAID_WEBHOOK_URL                optional; defaults to <SITE_URL>/api/webhooks/plaid
// Without the id and secret every entry point reports "not configured".

export type PlaidEnv = "sandbox" | "production";

export function plaidEnv(): PlaidEnv {
  return process.env.PLAID_ENV === "production" ? "production" : "sandbox";
}

export function plaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

function baseUrl(): string {
  // Local testing only: point at a stand-in server. Ignored in production so a
  // stray variable can never send real credentials somewhere else.
  if (process.env.NODE_ENV !== "production" && process.env.PLAID_BASE_URL) return process.env.PLAID_BASE_URL;
  return plaidEnv() === "production" ? "https://production.plaid.com" : "https://sandbox.plaid.com";
}

export class PlaidError extends Error {
  constructor(
    public readonly errorCode: string,
    public readonly errorType: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** POST to Plaid with credentials in the body, as their API expects. */
export async function plaidPost<T>(path: string, body: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<T> {
  if (!plaidConfigured()) throw new PlaidError("NOT_CONFIGURED", "CONFIG", "Plaid is not configured.", 501);
  const res = await fetchImpl(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: process.env.PLAID_CLIENT_ID, secret: process.env.PLAID_SECRET, ...body }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new PlaidError(
      String(json.error_code ?? "UNKNOWN"),
      String(json.error_type ?? "UNKNOWN"),
      String(json.display_message ?? json.error_message ?? `Plaid ${path} failed (${res.status})`),
      res.status,
    );
  }
  return json as T;
}

// ---- Wire types (only the fields we read) ----

export type PlaidAccount = {
  account_id: string;
  name: string;
  official_name: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  balances: { current: number | null; available: number | null; iso_currency_code: string | null };
};

export type PlaidTransaction = {
  transaction_id: string;
  account_id: string;
  amount: number; // Plaid: positive = money OUT of the account
  iso_currency_code: string | null;
  date: string;
  authorized_date: string | null;
  name: string;
  merchant_name: string | null;
  pending: boolean;
  personal_finance_category?: { primary?: string; detailed?: string } | null;
};

export type SyncPage = {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: { transaction_id: string; account_id?: string }[];
  accounts: PlaidAccount[];
  next_cursor: string;
  has_more: boolean;
};

/**
 * Dollars (Plaid's float) to integer cents, with the sign flipped so that
 * positive means money IN. Rounded, not truncated: 19.99 * 100 is 1998.9999...
 */
export function plaidAmountToCents(amount: number): number {
  return -Math.round(amount * 100);
}

export function dollarsToCents(amount: number | null | undefined): number | null {
  return amount === null || amount === undefined ? null : Math.round(amount * 100);
}

// ---- Webhook verification ----
// Plaid signs each webhook with an ES256 JWT in the Plaid-Verification header.
// The JWT's kid names a key fetched from /webhook_verification_key/get; its
// payload carries iat and the SHA-256 of the exact request body. A webhook is
// trusted only if the signature verifies, iat is within 5 minutes, and the
// body hash matches. Keys are cached per kid.

const keyCache = new Map<string, JsonWebKey>();

function b64urlJson(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

export async function verifyPlaidWebhook(
  rawBody: string,
  jwt: string | null,
  opts: { fetchKey?: (kid: string) => Promise<JsonWebKey>; now?: number } = {},
): Promise<boolean> {
  if (!jwt) return false;
  const parts = jwt.split(".");
  if (parts.length !== 3) return false;
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = b64urlJson(parts[0]);
    payload = b64urlJson(parts[1]);
  } catch {
    return false;
  }
  if (header.alg !== "ES256" || typeof header.kid !== "string") return false;

  let jwk = keyCache.get(header.kid);
  if (!jwk) {
    try {
      jwk = opts.fetchKey
        ? await opts.fetchKey(header.kid)
        : (await plaidPost<{ key: JsonWebKey }>("/webhook_verification_key/get", { key_id: header.kid })).key;
    } catch {
      return false;
    }
    keyCache.set(header.kid, jwk);
  }

  let ok = false;
  try {
    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    ok = verifySignature("sha256", Buffer.from(`${parts[0]}.${parts[1]}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(parts[2], "base64url"));
  } catch {
    return false;
  }
  if (!ok) return false;

  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (typeof payload.iat !== "number" || Math.abs(now - payload.iat) > 5 * 60) return false;
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  return payload.request_body_sha256 === bodyHash;
}
