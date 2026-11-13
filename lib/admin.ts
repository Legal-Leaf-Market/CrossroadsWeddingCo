import { randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, leads, serviceAgreements, weddingMessages, weddings } from "@/lib/db/schema";
import { nameSlug } from "@/lib/hub-constants";
import { CORPORATE_PACKAGE } from "@/lib/invoice";
import { HOUSE_TENANT_ID } from "@/lib/tenant-constants";
import { auditQuietly } from "@/lib/audit";
import { postBankLedgerQuietly } from "@/lib/books/ledger";

// This dashboard is Crossroads' own (the house account). Every query below is
// scoped to HOUSE_TENANT_ID, so a business that signs up for the platform can
// never have its bookings, leads or calls show up here, and a wedding id from
// another account reads as not found.
const isHouse = eq(weddings.tenantId, HOUSE_TENANT_ID);

/**
 * Gate for everything under /admin/[key]: true only when ADMIN_DASH_KEY is
 * configured (16+ chars, so "test" can never guard real bookings) and the
 * candidate matches it in constant time.
 */
export function adminKeyMatches(candidate: string): boolean {
  const expected = process.env.ADMIN_DASH_KEY;
  if (!expected || expected.length < 16) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Server-side data access for the owner dashboard (/admin/[key]). Read-only:
// the dashboard is a window, not a control panel; every mutation still goes
// through the couple's hub or direct conversation.

export type AdminWedding = {
  id: string;
  coupleNames: string;
  eventDate: string;
  venueName: string;
  status: string;
  /** "corporate" for events entered from the dashboard; wedding packages otherwise. */
  packageType: string | null;
  addons: { type: string; fee: number | null; minFee?: number }[];
  totalAmount: string;
  depositAmount: string;
  isDepositPaid: boolean;
  isBalancePaid: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
  accessToken: string;
  shareToken: string | null;
  checkinsSent: number[];
  notes: string | null;
  createdAt: string;
  /** Couple messages the team hasn't opened yet. */
  unreadMessages: number;
  /** ISO timestamp the couple accepted the service agreement, null if not yet. */
  contractAcceptedAt: string | null;
  /** ISO timestamp we countersigned the agreement, null if not yet. */
  contractCountersignedAt: string | null;
  /** Bespoke arrangement that replaces the agreement's cost section. */
  customTerms: string | null;
  /** Folder slug under public/wedding-art/, or null for the plain look. */
  artTheme: string | null;
  /** ISO timestamp this was hidden from the dashboard, null while visible. */
  archivedAt: string | null;
  /** Where they found us (lib/lead-sources.ts), what they said, and the link tag. */
  leadSource: string | null;
  leadSourceDetail: string | null;
  leadSrcTag: string | null;
  /** The separate Compass Events officiant agreement, when one is set up. */
  officiant?: { acceptedAt: string | null; countersignedAt: string | null; depositPaidAt: string | null } | null;
};

export type AdminLead = {
  id: number;
  name: string;
  email: string;
  eventDate: string | null;
  venue: string | null;
  source: string | null;
  createdAt: string;
};

/** A booked intro call (corporate inquiries and venue referrals arrive this way). */
export type AdminCall = {
  id: string;
  personSlug: string;
  startsAt: string;
  name: string;
  email: string;
  phone: string | null;
  eventDate: string | null;
  notes: string;
  /** First-touch ?src= tag the caller arrived with, e.g. "venue". */
  srcTag: string | null;
};

export type AdminData = {
  upcoming: AdminWedding[];
  past: AdminWedding[];
  leads: AdminLead[];
  /** Calls not cancelled, from yesterday on, soonest first. */
  calls: AdminCall[];
};

type OfficiantRow = { acceptedAt: Date | null; countersignedAt: Date | null; depositPaidAt: Date | null };

function toAdminWedding(
  w: typeof weddings.$inferSelect,
  unreadMessages = 0,
  officiant: OfficiantRow | null = null,
): AdminWedding {
  const addons = Array.isArray(w.addons)
    ? (w.addons as { type: string; fee: number | null; minFee?: number }[])
    : [];
  const checkins = Array.isArray(w.checkinsSent)
    ? (w.checkinsSent as unknown[]).filter((m): m is number => typeof m === "number")
    : [];
  return {
    officiant: officiant
      ? {
          acceptedAt: officiant.acceptedAt?.toISOString() ?? null,
          countersignedAt: officiant.countersignedAt?.toISOString() ?? null,
          depositPaidAt: officiant.depositPaidAt?.toISOString() ?? null,
        }
      : null,
    id: w.id,
    archivedAt: w.archivedAt ? w.archivedAt.toISOString() : null,
    coupleNames: w.coupleNames,
    eventDate: w.eventDate,
    venueName: w.venueName,
    status: w.status,
    packageType: w.packageType,
    addons,
    totalAmount: w.totalAmount,
    depositAmount: w.depositAmount,
    isDepositPaid: w.isDepositPaid ?? false,
    isBalancePaid: w.isBalancePaid ?? false,
    contactEmail: w.contactEmail,
    contactPhone: w.contactPhone,
    accessToken: w.accessToken,
    shareToken: w.shareToken,
    checkinsSent: checkins,
    notes: w.notes,
    createdAt: w.createdAt.toISOString(),
    unreadMessages,
    contractAcceptedAt: w.contractAcceptedAt ? w.contractAcceptedAt.toISOString() : null,
    contractCountersignedAt: w.contractCountersignedAt
      ? w.contractCountersignedAt.toISOString()
      : null,
    customTerms: w.customTerms,
    artTheme: w.artTheme,
    leadSource: w.leadSource,
    leadSourceDetail: w.leadSourceDetail,
    leadSrcTag: w.leadSrcTag,
  };
}

/** One wedding for the admin inbox page; null when the id is unknown. */
export async function getAdminWedding(weddingId: string): Promise<AdminWedding | null> {
  if (!/^[0-9a-f-]{36}$/.test(weddingId)) return null;
  const [w] = await db.select().from(weddings).where(and(eq(weddings.id, weddingId), isHouse)).limit(1);
  return w ? toAdminWedding(w) : null;
}

/** The full wedding row, for pages that render the agreement itself. */
export async function getAdminWeddingRow(
  weddingId: string,
): Promise<typeof weddings.$inferSelect | null> {
  if (!/^[0-9a-f-]{36}$/.test(weddingId)) return null;
  const [w] = await db.select().from(weddings).where(and(eq(weddings.id, weddingId), isHouse)).limit(1);
  return w ?? null;
}

/**
 * Sign the agreement for the company, before or after the couple accepts
 * (2026-11-12, Jake: "the company should be able to sign first, always"), and
 * only once: the WHERE carries that condition, so two taps from two devices
 * cannot both write, and the second one learns it lost. Signing first does not
 * freeze the terms; the couple's acceptance snapshot does, as it always has.
 */
export async function countersignContract(
  weddingId: string,
  name: string,
  title: string,
): Promise<"ok" | "already_signed" | "not_found"> {
  const at = new Date();
  const updated = await db
    .update(weddings)
    .set({
      contractCountersignedAt: at,
      contractCountersignedName: name,
      contractCountersignedTitle: title,
      updatedAt: at,
    })
    .where(
      and(
        eq(weddings.id, weddingId),
        isHouse,
        isNull(weddings.contractCountersignedAt),
      ),
    )
    .returning({ id: weddings.id });
  if (updated.length > 0) return "ok";
  const w = await getAdminWeddingRow(weddingId);
  if (!w) return "not_found";
  return "already_signed";
}

export async function getAdminData(): Promise<AdminData> {
  const [allWeddings, recentLeads, unreadRows, callRows] = await Promise.all([
    db.select().from(weddings).where(and(isHouse, isNull(weddings.archivedAt))).orderBy(weddings.eventDate),
    db.select().from(leads).where(eq(leads.tenantId, HOUSE_TENANT_ID)).orderBy(desc(leads.createdAt)).limit(10),
    db
      .select({
        weddingId: weddingMessages.weddingId,
        count: sql<number>`count(*)::int`,
      })
      .from(weddingMessages)
      .where(sql`${weddingMessages.sender} = 'couple' and ${weddingMessages.readByTeam} = false`)
      .groupBy(weddingMessages.weddingId),
    db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, HOUSE_TENANT_ID),
          isNull(appointments.cancelledAt),
          sql`${appointments.startsAt} >= now() - interval '1 day'`,
        ),
      )
      .orderBy(appointments.startsAt)
      .limit(50),
  ]);
  const unreadByWedding = new Map(unreadRows.map((r) => [r.weddingId, r.count]));
  const officiantRows = await db
    .select({
      weddingId: serviceAgreements.weddingId,
      acceptedAt: serviceAgreements.acceptedAt,
      countersignedAt: serviceAgreements.countersignedAt,
      depositPaidAt: serviceAgreements.depositPaidAt,
    })
    .from(serviceAgreements)
    .where(and(eq(serviceAgreements.kind, "officiant"), isNull(serviceAgreements.cancelledAt)));
  const officiantByWedding = new Map(officiantRows.map((r) => [r.weddingId, r]));

  const todayRow = await db.execute(sql`select current_date::text as today`);
  const today = String(todayRow.rows[0]?.today ?? new Date().toISOString().slice(0, 10));

  const upcoming: AdminWedding[] = [];
  const past: AdminWedding[] = [];
  for (const w of allWeddings) {
    const target = w.eventDate >= today && w.status !== "cancelled" ? upcoming : past;
    target.push(toAdminWedding(w, unreadByWedding.get(w.id) ?? 0, officiantByWedding.get(w.id) ?? null));
  }
  // Past reads newest-first; upcoming keeps soonest-first from the query.
  past.reverse();

  return {
    upcoming,
    past,
    leads: recentLeads.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      eventDate: l.eventDate,
      venue: l.venue,
      source: l.source,
      createdAt: l.createdAt.toISOString(),
    })),
    calls: callRows.map((c) => ({
      id: c.id,
      personSlug: c.personSlug,
      startsAt: c.startsAt.toISOString(),
      name: c.name,
      email: c.email,
      phone: c.phone,
      eventDate: c.eventDate,
      notes: c.notes,
      srcTag: c.srcTag,
    })),
  };
}

/** Everything hidden from the dashboard, newest archived first. */
export async function getArchivedWeddings(): Promise<AdminWedding[]> {
  const rows = await db
    .select()
    .from(weddings)
    .where(and(isHouse, isNotNull(weddings.archivedAt)))
    .orderBy(desc(weddings.archivedAt));
  return rows.map((w) => toAdminWedding(w));
}

/**
 * Hide or restore a wedding. Nothing is deleted and nothing cascades: the
 * couple's hub link, their messages, and their run sheet all keep working
 * while it is archived, because archiving is about our dashboard being
 * readable, not about ending a booking. Cancelling a real wedding is what
 * `status` is for.
 */
export async function setWeddingArchived(weddingId: string, archived: boolean): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/.test(weddingId)) return false;
  await db
    .update(weddings)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(weddings.id, weddingId), isHouse));
  return true;
}

/**
 * The one write the owner dashboard allows: the money and status fields no
 * couple-facing surface can set. Everything else about a wedding still comes
 * from the couple's own hub. Undefined fields are left alone.
 */
export async function updateAdminWedding(
  weddingId: string,
  patch: {
    totalAmount?: string;
    depositAmount?: string;
    isDepositPaid?: boolean;
    isBalancePaid?: boolean;
    customTerms?: string | null;
    artTheme?: string | null;
    addons?: { type: string; fee?: number | null; minFee?: number }[];
    status?: (typeof weddings.$inferSelect)["status"];
  },
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/.test(weddingId)) return false;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.totalAmount !== undefined) set.totalAmount = patch.totalAmount;
  if (patch.depositAmount !== undefined) set.depositAmount = patch.depositAmount;
  if (patch.isDepositPaid !== undefined) set.isDepositPaid = patch.isDepositPaid;
  if (patch.isBalancePaid !== undefined) set.isBalancePaid = patch.isBalancePaid;
  if (patch.customTerms !== undefined) set.customTerms = patch.customTerms;
  if (patch.artTheme !== undefined) set.artTheme = patch.artTheme;
  if (patch.addons !== undefined) set.addons = patch.addons;
  if (patch.status !== undefined) set.status = patch.status;
  const [before] = await db.select().from(weddings).where(and(eq(weddings.id, weddingId), isHouse)).limit(1);
  if (!before) return false;
  // The day it was cancelled is when a kept deposit is earned (accrual, ASC 606).
  if (patch.status === "cancelled" && before.status !== "cancelled") set.cancelledAt = new Date();
  if (patch.status !== undefined && patch.status !== "cancelled" && before.status === "cancelled") set.cancelledAt = null;
  await db.update(weddings).set(set).where(and(eq(weddings.id, weddingId), isHouse));
  const pick = (w: typeof before) => ({
    status: w.status,
    totalAmount: w.totalAmount,
    depositAmount: w.depositAmount,
    isDepositPaid: w.isDepositPaid,
    isBalancePaid: w.isBalancePaid,
    addons: w.addons,
    customTerms: w.customTerms,
    cancelledAt: w.cancelledAt,
  });
  const [after] = await db.select().from(weddings).where(and(eq(weddings.id, weddingId), isHouse)).limit(1);
  await auditQuietly({ tenantId: HOUSE_TENANT_ID, actor: "owner dashboard", action: "booking.money", entityType: "job", entityId: weddingId, before: pick(before), after: after ? pick(after) : null });
  await postBankLedgerQuietly(HOUSE_TENANT_ID, { actor: "owner dashboard", cause: "booking money or status edited" });
  return true;
}

/**
 * A corporate event, entered from the dashboard. Corporate inquiries come in by
 * phone or as an intro call, never through the wedding booking form, so without
 * this they have no booking record and nothing to invoice. Stored in the same
 * table with package_type "corporate" so the dashboard, money editing and the
 * invoice all work unchanged. Mints the same two credentials a wedding gets.
 */
export async function createCorporateBooking(input: {
  company: string;
  contactName?: string;
  email?: string;
  phone?: string;
  eventDate: string;
  venueName: string;
  venueAddress?: string;
  totalUsd: number;
  depositUsd: number;
  depositReceived: boolean;
  notes?: string;
}): Promise<string> {
  const accessToken = `${nameSlug(input.company)}-${randomBytes(8).toString("hex")}`;
  const shareToken = randomBytes(24).toString("hex");
  const notes = [input.contactName && `Contact: ${input.contactName}`, input.notes].filter(Boolean).join("\n") || null;
  const [row] = await db
    .insert(weddings)
    .values({
      tenantId: HOUSE_TENANT_ID,
      accessToken,
      shareToken,
      coupleNames: input.company,
      contactEmail: input.email || null,
      contactPhone: input.phone || null,
      eventDate: input.eventDate,
      venueName: input.venueName,
      venueAddress: input.venueAddress || null,
      packageType: CORPORATE_PACKAGE,
      addons: [],
      totalAmount: input.totalUsd.toFixed(2),
      depositAmount: Math.min(input.depositUsd, input.totalUsd).toFixed(2),
      isDepositPaid: input.depositReceived,
      status: input.depositReceived ? "deposit_paid" : "inquiry",
      notes,
    })
    .returning({ id: weddings.id });
  return row.id;
}
