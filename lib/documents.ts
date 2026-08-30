import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { weddingDocuments } from "@/lib/db/schema";

/**
 * The couple's own documents. Their order-of-events graphic, wedding-party
 * card and printed timeline are the official communication their guests and
 * family already hold; our run sheet shadows those. Keeping them in the hub
 * lets the couple audit our schedule against theirs without leaving the page.
 */

/** Vercel caps a serverless request body at 4.5 MB, so stay comfortably under. */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const MAX_DOCUMENTS_PER_WEDDING = 12;

/**
 * Only inert, renderable types. No SVG and no HTML: both execute script when
 * served from our own origin, and these files are displayed inside the hub.
 */
export const ALLOWED_DOCUMENT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export type WeddingDocument = {
  id: string;
  label: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
};

/** Metadata only: the bytes are fetched one at a time by the file route. */
export async function listDocuments(weddingId: string): Promise<WeddingDocument[]> {
  const rows = await db
    .select({
      id: weddingDocuments.id,
      label: weddingDocuments.label,
      fileName: weddingDocuments.fileName,
      mimeType: weddingDocuments.mimeType,
      byteSize: weddingDocuments.byteSize,
      createdAt: weddingDocuments.createdAt,
    })
    .from(weddingDocuments)
    .where(eq(weddingDocuments.weddingId, weddingId))
    .orderBy(asc(weddingDocuments.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function countDocuments(weddingId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(weddingDocuments)
    .where(eq(weddingDocuments.weddingId, weddingId));
  return row?.count ?? 0;
}

export async function addDocument(input: {
  weddingId: string;
  label: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
}): Promise<WeddingDocument> {
  const [row] = await db
    .insert(weddingDocuments)
    .values({
      weddingId: input.weddingId,
      label: input.label,
      fileName: input.fileName,
      mimeType: input.mimeType,
      byteSize: input.data.byteLength,
      data: input.data,
    })
    .returning({
      id: weddingDocuments.id,
      label: weddingDocuments.label,
      fileName: weddingDocuments.fileName,
      mimeType: weddingDocuments.mimeType,
      byteSize: weddingDocuments.byteSize,
      createdAt: weddingDocuments.createdAt,
    });
  return { ...row, createdAt: row.createdAt.toISOString() };
}

/** Scoped to the wedding so one hub token can never read another's file. */
export async function getDocumentFile(weddingId: string, documentId: string) {
  const [row] = await db
    .select({
      mimeType: weddingDocuments.mimeType,
      fileName: weddingDocuments.fileName,
      data: weddingDocuments.data,
    })
    .from(weddingDocuments)
    .where(and(eq(weddingDocuments.weddingId, weddingId), eq(weddingDocuments.id, documentId)))
    .limit(1);
  return row ?? null;
}

export async function removeDocument(weddingId: string, documentId: string): Promise<boolean> {
  const rows = await db
    .delete(weddingDocuments)
    .where(and(eq(weddingDocuments.weddingId, weddingId), eq(weddingDocuments.id, documentId)))
    .returning({ id: weddingDocuments.id });
  return rows.length > 0;
}

export async function renameDocument(
  weddingId: string,
  documentId: string,
  label: string,
): Promise<boolean> {
  const rows = await db
    .update(weddingDocuments)
    .set({ label })
    .where(and(eq(weddingDocuments.weddingId, weddingId), eq(weddingDocuments.id, documentId)))
    .returning({ id: weddingDocuments.id });
  return rows.length > 0;
}
