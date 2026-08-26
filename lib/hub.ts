import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  musicCues,
  playlistCurations,
  timelineItems,
  vipRoster,
  weddings,
  type Wedding,
} from "@/lib/db/schema";
import { TOKEN_RE } from "@/lib/hub-constants";

// Server-side hub data access. Client-safe constants (CUE_TYPES, categories,
// TOKEN_RE, daysOut) live in lib/hub-constants.ts so client components never
// pull in lib/db; they are re-exported here for server callers.
export { CUE_TYPES, TIMELINE_CATEGORIES, TOKEN_RE, daysOut, type CueType } from "@/lib/hub-constants";

/** The hub sections protected by per-section revision counters. */
export type SectionKey = "timeline" | "cues" | "vips" | "playlists";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Optimistic-concurrency gate for the replace-all hub saves. Locks the
 * wedding row, compares the client's revision for `section` with the stored
 * one, and either reports a conflict (caller answers 409 with the current
 * rows) or runs `write` and bumps the revision, all in one transaction. This
 * is what stops a stale tab from silently wiping rows another device saved.
 */
export async function withSectionRev(
  weddingId: string,
  section: SectionKey,
  clientRev: number,
  write: (tx: Tx) => Promise<void>,
): Promise<{ conflict: boolean; rev: number }> {
  return db.transaction(async (tx) => {
    const locked = await tx.execute(
      sql`select coalesce(hub_section_revs, '{}'::jsonb) as revs from weddings where id = ${weddingId} for update`,
    );
    const revs = (locked.rows[0]?.revs ?? {}) as Record<string, unknown>;
    const current = typeof revs[section] === "number" ? (revs[section] as number) : 0;
    if (clientRev !== current) return { conflict: true, rev: current };
    await write(tx);
    const next = current + 1;
    await tx.execute(
      sql`update weddings
          set hub_section_revs = jsonb_set(coalesce(hub_section_revs, '{}'::jsonb), array[${section}::text], to_jsonb(${next}::int)),
              updated_at = now()
          where id = ${weddingId}`,
    );
    return { conflict: false, rev: next };
  });
}

export async function getWeddingByToken(token: string): Promise<Wedding | null> {
  if (!TOKEN_RE.test(token)) return null;
  const [wedding] = await db
    .select()
    .from(weddings)
    .where(eq(weddings.accessToken, token))
    .limit(1);
  return wedding ?? null;
}

export async function getPortalData(token: string) {
  const wedding = await getWeddingByToken(token);
  if (!wedding) return null;

  const [timeline, cues, vips, playlists] = await Promise.all([
    db
      .select()
      .from(timelineItems)
      .where(eq(timelineItems.weddingId, wedding.id))
      .orderBy(asc(timelineItems.orderIndex)),
    db.select().from(musicCues).where(eq(musicCues.weddingId, wedding.id)),
    db
      .select()
      .from(vipRoster)
      .where(eq(vipRoster.weddingId, wedding.id))
      .orderBy(asc(vipRoster.orderIndex)),
    db
      .select()
      .from(playlistCurations)
      .where(
        and(
          eq(playlistCurations.weddingId, wedding.id),
          inArray(playlistCurations.category, ["must_play", "do_not_play"]),
        ),
      ),
  ]);

  return { wedding, timeline, cues, vips, playlists };
}
