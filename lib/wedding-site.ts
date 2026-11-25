import { randomBytes } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { timelineItems, weddings, type Wedding } from "@/lib/db/schema";
import { nameSlug } from "@/lib/hub-constants";
import { listSitePhotos, type SitePhotoMeta } from "@/lib/site-photos";
import { normalizeFaq, normalizeLinks, safeUrl, type SiteFaq, type SiteLink } from "@/lib/wedding-site-constants";

// Public wedding website. Read side: one published wedding by its slug, and
// nothing else: a slug that exists but is switched off reads exactly like one
// that never existed. Write side: only through the couple's hub token.

export type WeddingSite = {
  wedding: Wedding;
  schedule: { title: string; startTime: string }[];
  links: SiteLink[];
  faq: SiteFaq[];
  photos: SitePhotoMeta[];
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function getPublishedSite(slug: string): Promise<WeddingSite | null> {
  if (!SLUG_RE.test(slug) || slug.length > 90) return null;
  const [w] = await db
    .select()
    .from(weddings)
    .where(and(eq(weddings.siteSlug, slug), eq(weddings.siteEnabled, true)))
    .limit(1);
  if (!w || w.status === "cancelled") return null;
  const rows = await db
    .select({ title: timelineItems.title, start: timelineItems.scheduledStartTime })
    .from(timelineItems)
    .where(eq(timelineItems.weddingId, w.id))
    .orderBy(asc(timelineItems.orderIndex));
  return {
    wedding: w,
    // Guests get times and titles only, never the MC notes on the same rows.
    schedule: rows.filter((r) => r.title.trim()).map((r) => ({ title: r.title.trim(), startTime: r.start.slice(0, 5) })),
    links: withOwnSite(normalizeLinks(w.siteLinks), w.weddingSiteUrl),
    faq: normalizeFaq(w.siteFaq),
    photos: await listSitePhotos(w.id),
  };
}

/** The couple's own site from Details (Zola, The Knot...), listed once, last. */
function withOwnSite(links: SiteLink[], own: string | null): SiteLink[] {
  const url = own ? safeUrl(own) : null;
  if (!url || links.some((l) => l.url === url)) return links;
  return [...links, { label: "Our wedding site", url }];
}

/** A readable slug the first time the site is switched on; kept for good after. */
export function newSiteSlug(w: Pick<Wedding, "partnerOneFirst" | "partnerTwoFirst" | "coupleNames">): string {
  const base =
    w.partnerOneFirst && w.partnerTwoFirst
      ? nameSlug(w.partnerOneFirst, "and", w.partnerTwoFirst)
      : nameSlug(w.coupleNames.replace(/&/g, " and "));
  return `${base.slice(0, 80)}-${randomBytes(3).toString("hex")}`;
}

export async function saveSite(
  weddingId: string,
  input: { enabled: boolean; story: string; links: SiteLink[]; faq: SiteFaq[] },
): Promise<{ slug: string | null }> {
  const [w] = await db.select().from(weddings).where(eq(weddings.id, weddingId)).limit(1);
  if (!w) return { slug: null };
  let slug = w.siteSlug;
  if (!slug && input.enabled) slug = newSiteSlug(w);
  await db
    .update(weddings)
    .set({
      siteEnabled: input.enabled,
      siteSlug: slug,
      siteStory: input.story || null,
      siteLinks: normalizeLinks(input.links),
      siteFaq: normalizeFaq(input.faq),
      updatedAt: new Date(),
    })
    .where(eq(weddings.id, weddingId));
  return { slug };
}
