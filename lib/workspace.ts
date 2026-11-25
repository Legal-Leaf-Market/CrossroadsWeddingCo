import { randomBytes } from "node:crypto";
import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { weddings, type Wedding } from "@/lib/db/schema";
import { ledgerToday } from "@/lib/books/ledger";
import { nameSlug } from "@/lib/hub-constants";
import type { BookingStatusKey } from "@/lib/tenant-constants";

// Workspace data for a signed-in account. Every function takes the tenant id
// from getWorkspace() (the session), never from a request parameter, and every
// query carries it, so one account can never read or change another's rows.
// A wrong id and another account's id look the same: not found.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type WorkspaceSummary = {
  upcoming: number;
  total: number;
};

export async function getWorkspaceSummary(tenantId: string): Promise<WorkspaceSummary> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      upcoming: sql<number>`count(*) filter (where ${weddings.eventDate} >= current_date and ${weddings.status} <> 'cancelled')::int`,
    })
    .from(weddings)
    .where(and(eq(weddings.tenantId, tenantId), isNull(weddings.archivedAt)));
  return { total: row?.total ?? 0, upcoming: row?.upcoming ?? 0 };
}

export type BookingListItem = {
  id: string;
  clientNames: string;
  eventDate: string;
  venueName: string;
  eventType: string | null;
  status: string;
  totalAmount: string;
  isDepositPaid: boolean;
  isBalancePaid: boolean;
};

/** Upcoming soonest first, then past newest first. Archived rows only when asked. */
export async function listBookings(
  tenantId: string,
  opts: { archived?: boolean } = {},
): Promise<{ upcoming: BookingListItem[]; past: BookingListItem[] }> {
  const rows = await db
    .select()
    .from(weddings)
    .where(
      and(
        eq(weddings.tenantId, tenantId),
        opts.archived ? isNotNull(weddings.archivedAt) : isNull(weddings.archivedAt),
      ),
    )
    .orderBy(weddings.eventDate);
  const [{ today }] = (await db.execute(sql`select current_date::text as today`)).rows as { today: string }[];
  const upcoming: BookingListItem[] = [];
  const past: BookingListItem[] = [];
  for (const w of rows) {
    const item: BookingListItem = {
      id: w.id,
      clientNames: w.coupleNames,
      eventDate: w.eventDate,
      venueName: w.venueName,
      eventType: w.packageType,
      status: w.status,
      totalAmount: w.totalAmount,
      isDepositPaid: w.isDepositPaid ?? false,
      isBalancePaid: w.isBalancePaid ?? false,
    };
    (w.eventDate >= today && w.status !== "cancelled" ? upcoming : past).push(item);
  }
  past.reverse();
  return { upcoming, past };
}

export async function getBooking(tenantId: string, id: string): Promise<Wedding | null> {
  if (!UUID_RE.test(id)) return null;
  const [w] = await db
    .select()
    .from(weddings)
    .where(and(eq(weddings.id, id), eq(weddings.tenantId, tenantId)))
    .limit(1);
  return w ?? null;
}

export type BookingInput = {
  clientNames: string;
  eventType: string;
  eventDate: string;
  venueName: string;
  venueAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  totalUsd: number;
  depositUsd: number;
  depositReceived: boolean;
  notes?: string;
};

/**
 * A booking entered by the account owner. Mints the same two credentials a
 * Crossroads booking gets: the couple's hub link (writes) and the share link
 * (read-only, for vendors and guests). Emails nobody: the owner decides when
 * to send the hub link to their client.
 */
export async function createBooking(tenantId: string, input: BookingInput): Promise<string> {
  const accessToken = `${nameSlug(input.clientNames)}-${randomBytes(8).toString("hex")}`;
  const shareToken = randomBytes(24).toString("hex");
  const total = Math.max(0, input.totalUsd);
  const [row] = await db
    .insert(weddings)
    .values({
      tenantId,
      accessToken,
      shareToken,
      coupleNames: input.clientNames,
      packageType: input.eventType,
      eventDate: input.eventDate,
      venueName: input.venueName,
      venueAddress: input.venueAddress || null,
      contactEmail: input.contactEmail || null,
      contactPhone: input.contactPhone || null,
      addons: [],
      totalAmount: total.toFixed(2),
      depositAmount: Math.min(Math.max(0, input.depositUsd), total).toFixed(2),
      isDepositPaid: input.depositReceived,
      depositPaidOn: input.depositReceived ? ledgerToday() : null,
      status: input.depositReceived ? "deposit_paid" : "inquiry",
      notes: input.notes || null,
    })
    .returning({ id: weddings.id });
  return row.id;
}

export type BookingPatch = Partial<{
  clientNames: string;
  eventType: string;
  eventDate: string;
  venueName: string;
  venueAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  totalUsd: number;
  depositUsd: number;
  isDepositPaid: boolean;
  isBalancePaid: boolean;
  status: BookingStatusKey;
  archived: boolean;
}>;

/** Change a booking. Returns false when the id isn't this account's. */
export async function updateBooking(tenantId: string, id: string, patch: BookingPatch): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.clientNames !== undefined) set.coupleNames = patch.clientNames;
  if (patch.eventType !== undefined) set.packageType = patch.eventType;
  if (patch.eventDate !== undefined) set.eventDate = patch.eventDate;
  if (patch.venueName !== undefined) set.venueName = patch.venueName;
  if (patch.venueAddress !== undefined) set.venueAddress = patch.venueAddress || null;
  if (patch.contactEmail !== undefined) set.contactEmail = patch.contactEmail || null;
  if (patch.contactPhone !== undefined) set.contactPhone = patch.contactPhone || null;
  if (patch.totalUsd !== undefined) set.totalAmount = Math.max(0, patch.totalUsd).toFixed(2);
  if (patch.depositUsd !== undefined) set.depositAmount = Math.max(0, patch.depositUsd).toFixed(2);
  if (patch.isDepositPaid !== undefined) set.isDepositPaid = patch.isDepositPaid;
  // The day the box was ticked is the day the cash or check came in (the books post it then).
  // Already ticked: keep the date it had; unticked: no date.
  if (patch.isDepositPaid !== undefined)
    set.depositPaidOn = patch.isDepositPaid ? sql`case when coalesce(${weddings.isDepositPaid}, false) then ${weddings.depositPaidOn} else ${ledgerToday()}::date end` : null;
  if (patch.isBalancePaid !== undefined) set.isBalancePaid = patch.isBalancePaid;
  if (patch.isBalancePaid !== undefined)
    set.balancePaidOn = patch.isBalancePaid ? sql`case when coalesce(${weddings.isBalancePaid}, false) then ${weddings.balancePaidOn} else ${ledgerToday()}::date end` : null;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.archived !== undefined) set.archivedAt = patch.archived ? new Date() : null;
  const done = await db
    .update(weddings)
    .set(set)
    .where(and(eq(weddings.id, id), eq(weddings.tenantId, tenantId)))
    .returning({ id: weddings.id });
  return done.length > 0;
}

/** For the "next up" strip on the workspace home. */
export async function nextBookings(tenantId: string, limit = 5) {
  return db
    .select({ id: weddings.id, coupleNames: weddings.coupleNames, eventDate: weddings.eventDate, venueName: weddings.venueName })
    .from(weddings)
    .where(and(eq(weddings.tenantId, tenantId), isNull(weddings.archivedAt), gte(weddings.eventDate, sql`current_date`)))
    .orderBy(weddings.eventDate)
    .limit(limit);
}

