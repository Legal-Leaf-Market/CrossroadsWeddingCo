// Checks what each Plaid webhook makes us do, which connections the daily
// backup sync refreshes, and the scheduled-job tokens (2026-11-13).
// Run: `node --experimental-strip-types scripts/verify-plaid.mjs`.
import { dailySyncEligible, NOTES, plaidWebhookAction } from "../lib/integrations/plaid-webhook-logic.ts";
import { cronAuthorized, cronConfigured, cronToken } from "../lib/cron-auth.ts";
import { jobToken } from "../netlify/lib/run-job.mjs";

let failures = 0;
function check(label, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) console.log(`ok   ${label}`);
  else {
    failures++;
    console.log(`FAIL ${label}\n     got  ${g}\n     want ${w}`);
  }
}
const act = (type, code, error) => plaidWebhookAction({ webhook_type: type, webhook_code: code, error });

// ── Webhooks ────────────────────────────────────────────────────────────────
check("new transactions: sync", act("TRANSACTIONS", "SYNC_UPDATES_AVAILABLE"), { kind: "sync" });
check("login required: needs you to log in", act("ITEM", "ERROR", { error_code: "ITEM_LOGIN_REQUIRED" }), { kind: "status", status: "needs_reauth", note: NOTES.login });
check("any other bank error is recorded, not dropped", act("ITEM", "ERROR", { error_code: "INSTITUTION_DOWN", error_message: "the institution is down", display_message: "Your bank is down for maintenance." }), {
  kind: "status",
  status: "error",
  note: `${NOTES.bankError} Your bank is down for maintenance.`,
});
check("a bank error with no message still says something", act("ITEM", "ERROR", null), { kind: "status", status: "error", note: NOTES.bankError });
check("a very long bank message is cut to the column", act("ITEM", "ERROR", { error_message: "x".repeat(900) }).note.length, 500);
check("expiring soon: log in again", [act("ITEM", "PENDING_EXPIRATION").status, act("ITEM", "PENDING_DISCONNECT").status], ["needs_reauth", "needs_reauth"]);
check("login repaired: back to active", act("ITEM", "LOGIN_REPAIRED"), { kind: "status", status: "active", note: null });
check("permission revoked: disconnect and forget the token", act("ITEM", "USER_PERMISSION_REVOKED"), { kind: "revoked", note: NOTES.revoked });
check("one account revoked: log in again and pick it", act("ITEM", "USER_ACCOUNT_REVOKED"), { kind: "status", status: "needs_reauth", note: NOTES.accountRevoked });
check("new accounts: ask the person to choose", act("ITEM", "NEW_ACCOUNTS_AVAILABLE"), { kind: "new_accounts" });
check("anything else is acknowledged and ignored", [act("ITEM", "WEBHOOK_UPDATE_ACKNOWLEDGED").kind, act("TRANSACTIONS", "DEFAULT_UPDATE").kind, act(undefined, undefined).kind], ["ignore", "ignore", "ignore"]);

// ── The daily backup sync ───────────────────────────────────────────────────
check("daily sync: active and failed-last-time connections with a token", [
  dailySyncEligible({ status: "active", hasToken: true }),
  dailySyncEligible({ status: "error", hasToken: true }),
  dailySyncEligible({ status: "needs_reauth", hasToken: true }),
  dailySyncEligible({ status: "disconnected", hasToken: false }),
  dailySyncEligible({ status: "active", hasToken: false }),
], [true, true, false, false, false]);

// ── Scheduled-job tokens ────────────────────────────────────────────────────
delete process.env.CRON_SECRET;
delete process.env.ADMIN_DASH_KEY;
check("no secret at all: nothing is configured and nothing is authorized", [cronConfigured(), cronAuthorized("Bearer anything", "bank-sync"), jobToken("bank-sync")], [false, false, null]);
process.env.ADMIN_DASH_KEY = "short";
check("a key under 16 characters counts as unset", [cronConfigured(), jobToken("bank-sync")], [false, null]);
process.env.ADMIN_DASH_KEY = "0123456789abcdef0123456789abcdef";
const t = jobToken("bank-sync");
check("the scheduled function and the route derive the same token", t, cronToken("bank-sync"));
check("the token opens its own job", cronAuthorized(`Bearer ${t}`, "bank-sync"), true);
check("and no other job", cronAuthorized(`Bearer ${t}`, "checkins"), false);
check("a wrong token, a missing header, or no Bearer prefix is refused", [cronAuthorized("Bearer nope", "bank-sync"), cronAuthorized(null, "bank-sync"), cronAuthorized(t, "bank-sync")], [false, false, false]);
process.env.ADMIN_DASH_KEY = "fedcba9876543210fedcba9876543210";
check("rotating the key retires the old token", cronAuthorized(`Bearer ${t}`, "bank-sync"), false);
process.env.CRON_SECRET = "a-cron-secret-for-vercel";
check("CRON_SECRET works for every job, and the function prefers it", [cronAuthorized("Bearer a-cron-secret-for-vercel", "bank-sync"), cronAuthorized("Bearer a-cron-secret-for-vercel", "checkins"), jobToken("checkins")], [true, true, "a-cron-secret-for-vercel"]);

if (failures) {
  console.log(`\n${failures} failing`);
  process.exit(1);
}
console.log("\nall passing");
