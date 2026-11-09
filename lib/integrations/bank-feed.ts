import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankAccounts, bankTransactions, integrationConnections } from "@/lib/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { SITE_URL } from "@/lib/site";
import { afterSync } from "@/lib/books/review";
import { PLATFORM_NAME } from "@/lib/tenant-constants";
import {
  PlaidError,
  dollarsToCents,
  plaidAmountToCents,
  plaidPost,
  type PlaidAccount,
  type PlaidTransaction,
  type SyncPage,
} from "@/lib/integrations/plaid-client";

// Bank and card feed for a business account, via Plaid. The flow:
//   1. createLinkToken  -> the browser opens Plaid Link with it
//   2. connectItem      -> swap Link's public_token for an access token, store it encrypted
//   3. syncConnection   -> /transactions/sync with a saved cursor; webhooks call it again
// Every function is scoped by tenant id from the session (or, for webhooks, by
// the item id Plaid signed). Nothing here posts to a ledger: bank lines land
// as "unreviewed" and wait for categorization, which is the next layer.

const WEBHOOK_URL = () => process.env.PLAID_WEBHOOK_URL ?? `${SITE_URL}/api/webhooks/plaid`;

/** Short-lived token for Plaid Link. Pass a connection id to repair a login (update mode). */
export async function createLinkToken(tenantId: string, userId: string, repairConnectionId?: string): Promise<string> {
  const body: Record<string, unknown> = {
    user: { client_user_id: userId },
    client_name: PLATFORM_NAME.slice(0, 30),
    country_codes: ["US"],
    language: "en",
    webhook: WEBHOOK_URL(),
  };
  if (repairConnectionId) {
    const conn = await getConnection(tenantId, repairConnectionId);
    if (!conn?.secretCiphertext) throw new PlaidError("NOT_FOUND", "APP", "That connection isn't yours.", 404);
    body.access_token = decryptSecret(conn.secretCiphertext);
  } else {
    body.products = ["transactions"];
    body.transactions = { days_requested: 730 };
  }
  const res = await plaidPost<{ link_token: string }>("/link/token/create", body);
  return res.link_token;
}

export async function getConnection(tenantId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [c] = await db
    .select()
    .from(integrationConnections)
    .where(and(eq(integrationConnections.id, id), eq(integrationConnections.tenantId, tenantId)))
    .limit(1);
  return c ?? null;
}

/**
 * Finish Plaid Link: exchange the public token, store the access token
 * encrypted, record the accounts, and run a first sync. An item already
 * connected to a different account is refused rather than moved.
 */
export async function connectItem(
  tenantId: string,
  userId: string,
  publicToken: string,
  institution: { id?: string | null; name?: string | null },
): Promise<string> {
  const ex = await plaidPost<{ access_token: string; item_id: string }>("/item/public_token/exchange", {
    public_token: publicToken,
  });
  const ciphertext = encryptSecret(ex.access_token);

  const [existing] = await db
    .select({ id: integrationConnections.id, tenantId: integrationConnections.tenantId })
    .from(integrationConnections)
    .where(and(eq(integrationConnections.provider, "plaid"), eq(integrationConnections.externalId, ex.item_id)))
    .limit(1);
  if (existing && existing.tenantId !== tenantId) {
    throw new PlaidError("ITEM_TAKEN", "APP", "That bank login is already connected to another account.", 409);
  }

  let connectionId: string;
  if (existing) {
    await db
      .update(integrationConnections)
      .set({ secretCiphertext: ciphertext, status: "active", lastError: null, updatedAt: new Date() })
      .where(eq(integrationConnections.id, existing.id));
    connectionId = existing.id;
  } else {
    const [row] = await db
      .insert(integrationConnections)
      .values({
        tenantId,
        provider: "plaid",
        externalId: ex.item_id,
        institutionId: institution.id ?? null,
        institutionName: institution.name ?? null,
        status: "active",
        secretCiphertext: ciphertext,
        createdBy: userId,
      })
      .returning({ id: integrationConnections.id });
    connectionId = row.id;
  }

  const accts = await plaidPost<{ accounts: PlaidAccount[] }>("/accounts/get", { access_token: ex.access_token });
  await upsertAccounts(tenantId, connectionId, accts.accounts);
  // The first sync often returns nothing until Plaid finishes pulling history;
  // the SYNC_UPDATES_AVAILABLE webhook brings the rest. A failure here is
  // recorded on the connection, never thrown at the person who just connected.
  await syncConnection(connectionId).catch(() => undefined);
  return connectionId;
}

async function upsertAccounts(
  tenantId: string,
  connectionId: string,
  accounts: PlaidAccount[],
  tx: Pick<typeof db, "insert"> = db,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const a of accounts) {
    const [row] = await tx
      .insert(bankAccounts)
      .values({
        tenantId,
        connectionId,
        externalId: a.account_id,
        name: a.name.slice(0, 200),
        officialName: a.official_name?.slice(0, 200) ?? null,
        mask: a.mask,
        type: a.type,
        subtype: a.subtype,
        currency: (a.balances.iso_currency_code ?? "USD").slice(0, 3),
        currentBalanceCents: dollarsToCents(a.balances.current),
        availableBalanceCents: dollarsToCents(a.balances.available),
      })
      .onConflictDoUpdate({
        target: [bankAccounts.connectionId, bankAccounts.externalId],
        set: {
          name: a.name.slice(0, 200),
          mask: a.mask,
          currentBalanceCents: dollarsToCents(a.balances.current),
          availableBalanceCents: dollarsToCents(a.balances.available),
          updatedAt: new Date(),
        },
      })
      .returning({ id: bankAccounts.id });
    map.set(a.account_id, row.id);
  }
  return map;
}

function txValues(tenantId: string, bankAccountId: string, t: PlaidTransaction) {
  return {
    tenantId,
    bankAccountId,
    externalId: t.transaction_id,
    postedDate: t.date,
    authorizedDate: t.authorized_date,
    amountCents: plaidAmountToCents(t.amount),
    currency: (t.iso_currency_code ?? "USD").slice(0, 3),
    merchant: t.merchant_name?.slice(0, 255) ?? null,
    description: t.name ?? "",
    rawCategory: t.personal_finance_category?.detailed?.slice(0, 120) ?? t.personal_finance_category?.primary?.slice(0, 120) ?? null,
    pending: t.pending,
    pendingExternalId: t.pending_transaction_id?.slice(0, 200) ?? null,
  };
}

export type SyncResult = { added: number; modified: number; removed: number } | { error: string };

/**
 * Pull everything new since the saved cursor. Plaid's rule: page until
 * has_more is false, and if the data changes mid-pagination, restart from the
 * cursor you began with. All pages are applied in ONE database transaction
 * together with the new cursor, so a crash halfway can never save a cursor
 * past rows that were not written.
 */
export async function syncConnection(connectionId: string, fetchImpl?: typeof fetch): Promise<SyncResult> {
  const [conn] = await db.select().from(integrationConnections).where(eq(integrationConnections.id, connectionId)).limit(1);
  if (!conn || !conn.secretCiphertext || conn.status === "disconnected") return { error: "not_connected" };
  const accessToken = decryptSecret(conn.secretCiphertext);

  const pages: SyncPage[] = [];
  let cursor = conn.syncCursor ?? undefined;
  try {
    for (let restarts = 0; ; ) {
      try {
        pages.length = 0;
        let c = conn.syncCursor ?? undefined;
        for (let guard = 0; guard < 200; guard++) {
          const page = await plaidPost<SyncPage>(
            "/transactions/sync",
            { access_token: accessToken, ...(c ? { cursor: c } : {}), count: 500 },
            fetchImpl,
          );
          pages.push(page);
          c = page.next_cursor;
          if (!page.has_more) break;
        }
        cursor = c;
        break;
      } catch (err) {
        if (err instanceof PlaidError && err.errorCode === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" && restarts++ < 3) continue;
        throw err;
      }
    }
  } catch (err) {
    const needsLogin = err instanceof PlaidError && err.errorCode === "ITEM_LOGIN_REQUIRED";
    await db
      .update(integrationConnections)
      .set({
        status: needsLogin ? "needs_reauth" : "error",
        lastError: err instanceof Error ? err.message.slice(0, 500) : "Sync failed",
        updatedAt: new Date(),
      })
      .where(eq(integrationConnections.id, connectionId));
    return { error: needsLogin ? "needs_reauth" : "sync_failed" };
  }

  let added = 0;
  let modified = 0;
  let removed = 0;
  await db.transaction(async (tx) => {
    const accountMap = new Map<string, string>();
    const existingAccounts = await tx
      .select({ id: bankAccounts.id, externalId: bankAccounts.externalId })
      .from(bankAccounts)
      .where(eq(bankAccounts.connectionId, connectionId));
    for (const a of existingAccounts) accountMap.set(a.externalId, a.id);
    for (const page of pages) {
      if (page.accounts?.length) {
        for (const [k, v] of await upsertAccounts(conn.tenantId, connectionId, page.accounts, tx)) accountMap.set(k, v);
      }
      for (const t of [...page.added, ...page.modified]) {
        const acct = accountMap.get(t.account_id);
        if (!acct) continue; // an account the person chose not to share
        const v = txValues(conn.tenantId, acct, t);
        await tx
          .insert(bankTransactions)
          .values(v)
          .onConflictDoUpdate({
            target: [bankTransactions.bankAccountId, bankTransactions.externalId],
            set: { ...v, removedAt: null, updatedAt: new Date() },
          });
      }
      added += page.added.length;
      modified += page.modified.length;
      const removedIds = page.removed.map((r) => r.transaction_id);
      if (removedIds.length) {
        const ids = [...accountMap.values()];
        if (ids.length) {
          await tx
            .update(bankTransactions)
            .set({ removedAt: new Date(), updatedAt: new Date() })
            .where(and(inArray(bankTransactions.bankAccountId, ids), inArray(bankTransactions.externalId, removedIds)));
        }
        removed += removedIds.length;
      }
    }
    await tx
      .update(integrationConnections)
      .set({ syncCursor: cursor ?? null, lastSyncedAt: new Date(), status: "active", lastError: null, updatedAt: new Date() })
      .where(eq(integrationConnections.id, connectionId));
  });
  // Sorting runs after the feed is safely written, outside its transaction:
  // a failure here must never cost a sync. Unsorted rows simply wait.
  try {
    await afterSync(conn.tenantId);
  } catch (err) {
    console.error("[books] post-sync sorting failed:", err instanceof Error ? err.message : err);
  }
  return { added, modified, removed };
}

/** Webhook entry: find the connection by the item id Plaid signed. */
export async function connectionIdForItem(itemId: string): Promise<string | null> {
  const [c] = await db
    .select({ id: integrationConnections.id })
    .from(integrationConnections)
    .where(and(eq(integrationConnections.provider, "plaid"), eq(integrationConnections.externalId, itemId)))
    .limit(1);
  return c?.id ?? null;
}

export async function markConnection(connectionId: string, status: "needs_reauth" | "error" | "active", note?: string) {
  await db
    .update(integrationConnections)
    .set({ status, lastError: note?.slice(0, 500) ?? null, updatedAt: new Date() })
    .where(eq(integrationConnections.id, connectionId));
}

/** Disconnect: tell Plaid to drop the login, then forget the token. Rows already pulled stay. */
export async function disconnect(tenantId: string, connectionId: string): Promise<boolean> {
  const conn = await getConnection(tenantId, connectionId);
  if (!conn) return false;
  if (conn.secretCiphertext) {
    await plaidPost("/item/remove", { access_token: decryptSecret(conn.secretCiphertext) }).catch((err) => {
      console.error("[plaid] item/remove failed, forgetting the token anyway:", err instanceof Error ? err.message : err);
    });
  }
  await db
    .update(integrationConnections)
    .set({ status: "disconnected", secretCiphertext: null, syncCursor: null, updatedAt: new Date() })
    .where(eq(integrationConnections.id, connectionId));
  await db.update(bankAccounts).set({ isActive: false, updatedAt: new Date() }).where(eq(bankAccounts.connectionId, connectionId));
  return true;
}

export type ConnectionView = {
  id: string;
  institutionName: string | null;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  accounts: { id: string; name: string; mask: string | null; subtype: string | null; currentBalanceCents: number | null; isActive: boolean }[];
};

export async function listConnections(tenantId: string): Promise<ConnectionView[]> {
  const conns = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.tenantId, tenantId))
    .orderBy(desc(integrationConnections.createdAt));
  if (!conns.length) return [];
  const accts = await db.select().from(bankAccounts).where(eq(bankAccounts.tenantId, tenantId));
  return conns.map((c) => ({
    id: c.id,
    institutionName: c.institutionName,
    status: c.status,
    lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
    lastError: c.lastError,
    accounts: accts
      .filter((a) => a.connectionId === c.id)
      .map((a) => ({ id: a.id, name: a.name, mask: a.mask, subtype: a.subtype, currentBalanceCents: a.currentBalanceCents, isActive: a.isActive })),
  }));
}

export async function recentTransactions(tenantId: string, limit = 25) {
  return db
    .select({
      id: bankTransactions.id,
      postedDate: bankTransactions.postedDate,
      amountCents: bankTransactions.amountCents,
      merchant: bankTransactions.merchant,
      description: bankTransactions.description,
      pending: bankTransactions.pending,
      reviewStatus: bankTransactions.reviewStatus,
      accountName: bankAccounts.name,
      mask: bankAccounts.mask,
    })
    .from(bankTransactions)
    .innerJoin(bankAccounts, eq(bankTransactions.bankAccountId, bankAccounts.id))
    .where(and(eq(bankTransactions.tenantId, tenantId), isNull(bankTransactions.removedAt)))
    .orderBy(desc(bankTransactions.postedDate), desc(bankTransactions.createdAt))
    .limit(limit);
}

export async function unreviewedCount(tenantId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bankTransactions)
    .where(and(eq(bankTransactions.tenantId, tenantId), isNull(bankTransactions.removedAt), eq(bankTransactions.reviewStatus, "unreviewed")));
  return r?.n ?? 0;
}
