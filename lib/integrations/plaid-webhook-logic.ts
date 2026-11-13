// What a verified Plaid webhook asks us to do (2026-11-13). Pure: no imports,
// so `node --experimental-strip-types scripts/verify-plaid.mjs` checks it.
// The route (app/api/webhooks/plaid/route.ts) verifies the signature first,
// then does what this says. Anything not listed is acknowledged and ignored,
// so Plaid stops retrying.

export type PlaidWebhook = {
  webhook_type?: string;
  webhook_code?: string;
  error?: { error_code?: string; error_message?: string; display_message?: string | null } | null;
};

export type WebhookAction =
  | { kind: "sync" }
  | { kind: "status"; status: "needs_reauth" | "error" | "active"; note: string | null }
  /** The login was withdrawn: the token is dead. Forget it and show the connection as disconnected. */
  | { kind: "revoked"; note: string }
  /** The bank has accounts the person hasn't shared yet: ask them to pick. */
  | { kind: "new_accounts" }
  | { kind: "ignore" };

export const NOTES = {
  login: "Your bank needs you to log in again.",
  expiring: "Your bank connection expires soon. Log in again to keep it.",
  revoked: "Access to this bank was withdrawn, at the bank or through Plaid. Connect it again to keep the feed going.",
  accountRevoked: "Access to one of the accounts was withdrawn at the bank. Log in again and pick it to keep it in the feed.",
  bankError: "The bank reported a problem with this connection.",
} as const;

export function plaidWebhookAction(e: PlaidWebhook): WebhookAction {
  const type = `${e.webhook_type ?? ""}:${e.webhook_code ?? ""}`;
  switch (type) {
    case "TRANSACTIONS:SYNC_UPDATES_AVAILABLE":
      return { kind: "sync" };
    case "ITEM:ERROR": {
      if (e.error?.error_code === "ITEM_LOGIN_REQUIRED") return { kind: "status", status: "needs_reauth", note: NOTES.login };
      const said = e.error?.display_message || e.error?.error_message || e.error?.error_code;
      return { kind: "status", status: "error", note: (said ? `${NOTES.bankError} ${said}` : NOTES.bankError).slice(0, 500) };
    }
    case "ITEM:PENDING_EXPIRATION":
    case "ITEM:PENDING_DISCONNECT":
      return { kind: "status", status: "needs_reauth", note: NOTES.expiring };
    case "ITEM:LOGIN_REPAIRED":
      return { kind: "status", status: "active", note: null };
    case "ITEM:USER_PERMISSION_REVOKED":
      return { kind: "revoked", note: NOTES.revoked };
    case "ITEM:USER_ACCOUNT_REVOKED":
      return { kind: "status", status: "needs_reauth", note: NOTES.accountRevoked };
    case "ITEM:NEW_ACCOUNTS_AVAILABLE":
      return { kind: "new_accounts" };
    default:
      return { kind: "ignore" };
  }
}

/** Which connections the daily backup sync refreshes: live ones, including one whose last refresh failed. */
export function dailySyncEligible(c: { status: string; hasToken: boolean }): boolean {
  return c.hasToken && (c.status === "active" || c.status === "error");
}
