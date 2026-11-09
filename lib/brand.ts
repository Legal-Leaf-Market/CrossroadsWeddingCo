import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenants, users } from "@/lib/db/schema";
import { EMAIL_FROM_ADDRESS, SITE_NAME } from "@/lib/site";
import { isHouseTenant } from "@/lib/tenant-constants";

/**
 * Whose name goes on a couple-facing page. A booking made by a business on the
 * platform shows that business, never Crossroads: their couple hired them.
 */
export type Brand = { name: string; contactEmail: string | null; isHouse: boolean };

export const HOUSE_BRAND: Brand = { name: SITE_NAME, contactEmail: EMAIL_FROM_ADDRESS, isHouse: true };

export async function brandForTenant(tenantId: string | null | undefined): Promise<Brand> {
  if (isHouseTenant(tenantId)) return HOUSE_BRAND;
  const [row] = await db
    .select({ name: tenants.name, email: users.email })
    .from(tenants)
    .leftJoin(users, eq(users.tenantId, tenants.id))
    .where(eq(tenants.id, tenantId!))
    .limit(1);
  // An account that vanished still must not fall back to the Crossroads name.
  return { name: row?.name ?? "Your event team", contactEmail: row?.email ?? null, isHouse: false };
}

/**
 * Page metadata for a page a client, vendor or guest sees. The root layout's
 * defaults name Crossroads in the tab title and in the link preview a text
 * message shows, so a booking from another account overrides all of them.
 * House bookings keep the layout's defaults untouched.
 */
export function brandedMetadata(brand: Brand, title: string, extra: Metadata = {}): Metadata {
  const base: Metadata = { robots: { index: false, follow: false }, ...extra };
  if (brand.isHouse) return { title, ...base };
  const full = `${title} | ${brand.name}`;
  return {
    ...base,
    title: { absolute: full },
    description: `${title} from ${brand.name}.`,
    applicationName: brand.name,
    keywords: null,
    alternates: { canonical: null },
    openGraph: { title: full, siteName: brand.name, description: `${title} from ${brand.name}.`, url: undefined, images: [] },
    twitter: { card: "summary", title: full, description: `${title} from ${brand.name}.`, images: [] },
  };
}

/** Brand for a hub (write) token or a share (read-only) token; house when unknown. */
export async function brandForToken(token: string, kind: "hub" | "share"): Promise<Brand> {
  const { getWeddingByShareToken, getWeddingByToken } = await import("@/lib/hub");
  const w = await (kind === "hub" ? getWeddingByToken(token) : getWeddingByShareToken(token)).catch(() => null);
  return w ? brandForTenant(w.tenantId) : HOUSE_BRAND;
}
