import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { weddings } from "@/lib/db/schema";

// Workspace data for a signed-in account. Every function takes the tenant id
// from getWorkspace() (the session), never from a request parameter, so one
// account can never ask for another account's rows.

export type WorkspaceSummary = {
  upcoming: number;
  total: number;
  next: { id: string; coupleNames: string; eventDate: string; venueName: string }[];
};

export async function getWorkspaceSummary(tenantId: string): Promise<WorkspaceSummary> {
  const live = and(eq(weddings.tenantId, tenantId), isNull(weddings.archivedAt));
  const [counts, next] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        upcoming: sql<number>`count(*) filter (where ${weddings.eventDate} >= current_date and ${weddings.status} <> 'cancelled')::int`,
      })
      .from(weddings)
      .where(live),
    db
      .select({
        id: weddings.id,
        coupleNames: weddings.coupleNames,
        eventDate: weddings.eventDate,
        venueName: weddings.venueName,
      })
      .from(weddings)
      .where(and(live, gte(weddings.eventDate, sql`current_date`)))
      .orderBy(weddings.eventDate)
      .limit(5),
  ]);
  return { total: counts[0]?.total ?? 0, upcoming: counts[0]?.upcoming ?? 0, next };
}
