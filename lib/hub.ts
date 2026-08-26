import { and, asc, eq, inArray } from "drizzle-orm";
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
