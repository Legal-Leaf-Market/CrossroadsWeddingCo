import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { guestbookEntries } from "@/lib/db/schema";

// Server-only guestbook queries. Client components import the constants from
// lib/guestbook-constants.ts instead, so pg never reaches the browser bundle.

export type GuestbookEntry = {
  id: string;
  name: string;
  relation: string | null;
  message: string;
  status: string;
  featured: boolean;
  createdAt: string;
};

function toEntry(r: typeof guestbookEntries.$inferSelect): GuestbookEntry {
  return {
    id: r.id,
    name: r.name,
    relation: r.relation,
    message: r.message,
    status: r.status,
    featured: r.featured,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Approved entries, featured first, newest next. Empty on any database error. */
export async function listApprovedEntries(): Promise<GuestbookEntry[]> {
  try {
    const rows = await db
      .select()
      .from(guestbookEntries)
      .where(eq(guestbookEntries.status, "approved"))
      .orderBy(desc(guestbookEntries.featured), desc(guestbookEntries.createdAt))
      .limit(200);
    return rows.map(toEntry);
  } catch (err) {
    console.error("[guestbook] list failed:", (err as Error).message);
    return [];
  }
}

/** Everything except removed entries, pending first, for the moderation page. */
export async function listEntriesForAdmin(): Promise<GuestbookEntry[]> {
  const rows = await db
    .select()
    .from(guestbookEntries)
    .where(sql`${guestbookEntries.status} <> 'removed'`)
    .orderBy(sql`case when ${guestbookEntries.status} = 'pending' then 0 else 1 end`, desc(guestbookEntries.createdAt))
    .limit(500);
  return rows.map(toEntry);
}

export async function createEntry(input: { name: string; relation: string | null; message: string }) {
  const [row] = await db
    .insert(guestbookEntries)
    .values({ name: input.name, relation: input.relation, message: input.message })
    .returning({ id: guestbookEntries.id });
  return row.id;
}

/** Approve, remove, or (un)feature one entry. Featuring clears any other featured entry. */
export async function moderateEntry(
  id: string,
  change: { status?: "approved" | "removed" | "pending"; featured?: boolean },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (change.featured) {
      await tx.update(guestbookEntries).set({ featured: false }).where(eq(guestbookEntries.featured, true));
    }
    const set: Partial<typeof guestbookEntries.$inferInsert> = { moderatedAt: new Date() };
    if (change.status) set.status = change.status;
    if (change.featured !== undefined) set.featured = change.featured;
    // A featured entry is always visible, and a removed one never featured.
    if (change.featured) set.status = "approved";
    if (change.status === "removed") set.featured = false;
    const res = await tx
      .update(guestbookEntries)
      .set(set)
      .where(eq(guestbookEntries.id, id))
      .returning({ id: guestbookEntries.id });
    return res.length > 0;
  });
}
