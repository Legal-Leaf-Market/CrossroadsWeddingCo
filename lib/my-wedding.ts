import { and, eq, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { weddings } from "@/lib/db/schema";
import { isHubToken } from "@/lib/hub-constants";
import { HOUSE_TENANT_ID } from "@/lib/tenant-constants";

// "Find my wedding": which Crossroads bookings an email belongs to. The address
// must already be on the booking: the contact email, or one the couple invited
// to their hub. Only the house account's weddings, because this page is
// Crossroads-branded; a customer account's couples get their own later.
// Cancelled bookings are left out. Archived ones stay: a couple still has a hub
// after the wedding.
export async function hubsForEmail(email: string): Promise<{ coupleNames: string; eventDate: string; hubPath: string }[]> {
  const e = email.trim().toLowerCase();
  if (!e.includes("@")) return [];
  const rows = await db
    .select({ coupleNames: weddings.coupleNames, eventDate: weddings.eventDate, accessToken: weddings.accessToken })
    .from(weddings)
    .where(
      and(
        eq(weddings.tenantId, HOUSE_TENANT_ID),
        ne(weddings.status, "cancelled"),
        or(
          sql`lower(${weddings.contactEmail}) = ${e}`,
          sql`${e} = ANY (SELECT lower(x) FROM unnest(coalesce(${weddings.hubInviteEmails}, '{}'::text[])) AS x)`,
        ),
      ),
    )
    .orderBy(weddings.eventDate)
    .limit(5);
  return rows
    .filter((r) => isHubToken(r.accessToken))
    .map((r) => ({ coupleNames: r.coupleNames, eventDate: r.eventDate, hubPath: `/hub/${r.accessToken}` }));
}
