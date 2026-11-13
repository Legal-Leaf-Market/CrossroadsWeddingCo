import { and, desc, eq, inArray, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { guestbookEntries, weddings } from "@/lib/db/schema";
import { TRIBUTE_SLUGS, findReviewEvent, isTributeSlug } from "@/lib/review-constants";
import { HOUSE_TENANT_ID } from "@/lib/tenant-constants";
export { RELATIONS } from "@/lib/review-constants";

// The public notes board at /reviews (2026-11-01, Jacob). Couples, venue
// staff and guests sign it with a name and a note, no login, and nothing is
// public until Jake or Nic approves it from /admin/[key]/reviews.
//
// Rules that keep this honest:
// - Every word on the board was written by the person whose name is on it.
//   We never write, edit or seed an entry. Moderation is approve or hide.
// - No stars, no ratings, and no Review or AggregateRating JSON-LD (see
//   CLAUDE.md §9.1): rating markup is a Google manual-action risk.

export type PublicEntry = {
  id: string;
  name: string;
  relation: string;
  message: string;
  featured: boolean;
  createdAt: string;
};

export type ModerationEntry = PublicEntry & {
  state: "waiting" | "approved" | "hidden";
  /** Where it was written: an event page's title, or the couple's own hub. */
  source: string | null;
};

/** Approved and not hidden, featured first, then newest. Tribute notes stay on their own page. */
export async function getPublicEntries(): Promise<PublicEntry[]> {
  const rows = await db
    .select()
    .from(guestbookEntries)
    .where(
      and(
        isNotNull(guestbookEntries.approvedAt),
        isNull(guestbookEntries.hiddenAt),
        or(isNull(guestbookEntries.eventSlug), notInArray(guestbookEntries.eventSlug, [...TRIBUTE_SLUGS])),
      ),
    )
    .orderBy(desc(guestbookEntries.featured), desc(guestbookEntries.createdAt))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    relation: r.relation,
    message: r.message,
    featured: r.featured,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getModerationEntries(): Promise<ModerationEntry[]> {
  const rows = await db
    .select()
    .from(guestbookEntries)
    .orderBy(desc(guestbookEntries.createdAt))
    .limit(500);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    relation: r.relation,
    message: r.message,
    featured: r.featured,
    createdAt: r.createdAt.toISOString(),
    state: r.hiddenAt ? "hidden" : r.approvedAt ? "approved" : "waiting",
    source: r.weddingId
      ? "Written by the couple from their planning hub"
      : isTributeSlug(r.eventSlug)
        ? "Signed on the Back YOUR Blue tribute page (shows there only)"
        : r.eventSlug
          ? `Signed on the ${findReviewEvent(r.eventSlug)?.title ?? r.eventSlug} page`
        : null,
  }));
}

export async function createEntry(input: {
  name: string;
  relation: string;
  message: string;
  eventSlug?: string | null;
  weddingId?: string | null;
}): Promise<string> {
  const [row] = await db
    .insert(guestbookEntries)
    .values({
      name: input.name,
      relation: input.relation,
      message: input.message,
      eventSlug: input.eventSlug ?? null,
      weddingId: input.weddingId ?? null,
    })
    .returning({ id: guestbookEntries.id });
  return row.id;
}

export type ModerationAction = "approve" | "hide" | "feature" | "unfeature";

/** Returns false when no such entry exists. */
export async function moderateEntry(id: string, action: ModerationAction): Promise<boolean> {
  const now = new Date();
  const patch =
    action === "approve"
      ? { approvedAt: now, hiddenAt: null }
      : action === "hide"
        ? { hiddenAt: now, featured: false }
        : action === "feature"
          ? { featured: true, approvedAt: now, hiddenAt: null }
          : { featured: false };
  const rows = await db
    .update(guestbookEntries)
    .set(patch)
    .where(eq(guestbookEntries.id, id))
    .returning({ id: guestbookEntries.id });
  return rows.length > 0;
}

/**
 * Approved notes for one event page: signed on that page, or written by the
 * couple from the hub of a Crossroads wedding held on that date.
 */
export async function getEventEntries(slug: string, eventDate: string): Promise<PublicEntry[]> {
  const rows = await db
    .select()
    .from(guestbookEntries)
    .where(
      and(
        isNotNull(guestbookEntries.approvedAt),
        isNull(guestbookEntries.hiddenAt),
        or(
          eq(guestbookEntries.eventSlug, slug),
          inArray(
            guestbookEntries.weddingId,
            db
              .select({ id: weddings.id })
              .from(weddings)
              .where(and(eq(weddings.eventDate, eventDate), eq(weddings.tenantId, HOUSE_TENANT_ID))),
          ),
        ),
      ),
    )
    .orderBy(desc(guestbookEntries.featured), desc(guestbookEntries.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    relation: r.relation,
    message: r.message,
    featured: r.featured,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Notes this wedding's hub has sent in the last day, for a gentle limit. */
export async function hubNotesToday(weddingId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(guestbookEntries)
    .where(and(eq(guestbookEntries.weddingId, weddingId), sql`${guestbookEntries.createdAt} > now() - interval '1 day'`));
  return r?.n ?? 0;
}

/** Approved notes for one tribute page, oldest first so the board reads in order. */
export async function getTributeEntries(slug: string): Promise<PublicEntry[]> {
  if (!isTributeSlug(slug)) return [];
  const rows = await db
    .select()
    .from(guestbookEntries)
    .where(and(isNotNull(guestbookEntries.approvedAt), isNull(guestbookEntries.hiddenAt), eq(guestbookEntries.eventSlug, slug)))
    .orderBy(desc(guestbookEntries.featured), guestbookEntries.createdAt);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    relation: r.relation,
    message: r.message,
    featured: r.featured,
    createdAt: r.createdAt.toISOString(),
  }));
}
