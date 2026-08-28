import { timingSafeEqual } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, weddingMessages, weddings } from "@/lib/db/schema";

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
  addons: { type: string; fee: number | null; minFee?: number }[];
  totalAmount: string;
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

export type AdminData = {
  upcoming: AdminWedding[];
  past: AdminWedding[];
  leads: AdminLead[];
};

function toAdminWedding(w: typeof weddings.$inferSelect, unreadMessages = 0): AdminWedding {
  const addons = Array.isArray(w.addons)
    ? (w.addons as { type: string; fee: number | null; minFee?: number }[])
    : [];
  const checkins = Array.isArray(w.checkinsSent)
    ? (w.checkinsSent as unknown[]).filter((m): m is number => typeof m === "number")
    : [];
  return {
    id: w.id,
    coupleNames: w.coupleNames,
    eventDate: w.eventDate,
    venueName: w.venueName,
    status: w.status,
    addons,
    totalAmount: w.totalAmount,
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
  };
}

/** One wedding for the admin inbox page; null when the id is unknown. */
export async function getAdminWedding(weddingId: string): Promise<AdminWedding | null> {
  if (!/^[0-9a-f-]{36}$/.test(weddingId)) return null;
  const [w] = await db.select().from(weddings).where(eq(weddings.id, weddingId)).limit(1);
  return w ? toAdminWedding(w) : null;
}

export async function getAdminData(): Promise<AdminData> {
  const [allWeddings, recentLeads, unreadRows] = await Promise.all([
    db.select().from(weddings).orderBy(weddings.eventDate),
    db.select().from(leads).orderBy(desc(leads.createdAt)).limit(10),
    db
      .select({
        weddingId: weddingMessages.weddingId,
        count: sql<number>`count(*)::int`,
      })
      .from(weddingMessages)
      .where(sql`${weddingMessages.sender} = 'couple' and ${weddingMessages.readByTeam} = false`)
      .groupBy(weddingMessages.weddingId),
  ]);
  const unreadByWedding = new Map(unreadRows.map((r) => [r.weddingId, r.count]));

  const todayRow = await db.execute(sql`select current_date::text as today`);
  const today = String(todayRow.rows[0]?.today ?? new Date().toISOString().slice(0, 10));

  const upcoming: AdminWedding[] = [];
  const past: AdminWedding[] = [];
  for (const w of allWeddings) {
    const target = w.eventDate >= today && w.status !== "cancelled" ? upcoming : past;
    target.push(toAdminWedding(w, unreadByWedding.get(w.id) ?? 0));
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
  };
}
