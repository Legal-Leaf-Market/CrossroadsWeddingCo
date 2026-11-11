import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sitePhotos, weddings } from "@/lib/db/schema";

// Engagement photos for a couple's wedding website.

export const MAX_SITE_PHOTOS = 12;
/** The hub resizes before upload, so a real photo lands far under this. */
export const MAX_SITE_PHOTO_BYTES = 3 * 1024 * 1024;

export type SitePhotoMeta = { id: string; caption: string; width: number | null; height: number | null };

/** Trust the bytes, not the label: JPEG, PNG or WebP by their magic numbers. */
export function sniffImage(b: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export async function listSitePhotos(weddingId: string): Promise<SitePhotoMeta[]> {
  return db
    .select({ id: sitePhotos.id, caption: sitePhotos.caption, width: sitePhotos.width, height: sitePhotos.height })
    .from(sitePhotos)
    .where(eq(sitePhotos.weddingId, weddingId))
    .orderBy(asc(sitePhotos.orderIndex), asc(sitePhotos.createdAt));
}

export async function addSitePhoto(input: {
  weddingId: string;
  data: Buffer;
  mimeType: string;
  width: number | null;
  height: number | null;
  caption: string;
}): Promise<string | "full"> {
  return db.transaction(async (tx) => {
    // Lock the wedding row so two uploads at once cannot both slip under the cap.
    await tx.execute(sql`select id from weddings where id = ${input.weddingId} for update`);
    const [{ n }] = (await tx.execute(sql`select count(*)::int as n from site_photos where wedding_id = ${input.weddingId}`)).rows as { n: number }[];
    if (n >= MAX_SITE_PHOTOS) return "full";
    const [row] = await tx
      .insert(sitePhotos)
      .values({
        weddingId: input.weddingId,
        data: input.data,
        mimeType: input.mimeType,
        byteSize: input.data.byteLength,
        width: input.width,
        height: input.height,
        caption: input.caption,
        orderIndex: n,
      })
      .returning({ id: sitePhotos.id });
    return row.id;
  });
}

export async function removeSitePhoto(weddingId: string, id: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return false;
  const gone = await db.delete(sitePhotos).where(and(eq(sitePhotos.id, id), eq(sitePhotos.weddingId, weddingId))).returning({ id: sitePhotos.id });
  return gone.length > 0;
}

/** Bytes for one photo, only if it belongs to this wedding. */
export async function sitePhotoBytes(weddingId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [p] = await db
    .select({ data: sitePhotos.data, mimeType: sitePhotos.mimeType })
    .from(sitePhotos)
    .where(and(eq(sitePhotos.id, id), eq(sitePhotos.weddingId, weddingId)))
    .limit(1);
  return p ?? null;
}

/** Bytes for the public site: only while that couple's site is switched on. */
export async function publicSitePhoto(slug: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[a-z0-9-]{1,90}$/.test(slug)) return null;
  const [p] = await db
    .select({ data: sitePhotos.data, mimeType: sitePhotos.mimeType })
    .from(sitePhotos)
    .innerJoin(weddings, eq(sitePhotos.weddingId, weddings.id))
    .where(and(eq(sitePhotos.id, id), eq(weddings.siteSlug, slug), eq(weddings.siteEnabled, true)))
    .limit(1);
  return p ?? null;
}

export const IMAGE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
};
