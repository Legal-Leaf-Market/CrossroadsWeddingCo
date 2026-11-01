import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { guestbookEntries } from "@/lib/db/schema";
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
};

/** Approved and not hidden, featured first, then newest. */
export async function getPublicEntries(): Promise<PublicEntry[]> {
  const rows = await db
    .select()
    .from(guestbookEntries)
    .where(and(isNotNull(guestbookEntries.approvedAt), isNull(guestbookEntries.hiddenAt)))
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
  }));
}

export async function createEntry(input: {
  name: string;
  relation: string;
  message: string;
}): Promise<string> {
  const [row] = await db
    .insert(guestbookEntries)
    .values({ name: input.name, relation: input.relation, message: input.message })
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
