import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { weddingMessages } from "@/lib/db/schema";

// Server-side access to the one-master-thread messages (AppFolio model).
// Wire shape shared by the hub page, the admin inbox, and both APIs.

export type MessageWire = {
  id: string;
  sender: "couple" | "team";
  senderName: string;
  body: string;
  createdAt: string; // ISO
};

const toWire = (m: typeof weddingMessages.$inferSelect): MessageWire => ({
  id: m.id,
  sender: m.sender === "team" ? "team" : "couple",
  senderName: m.senderName,
  body: m.body,
  createdAt: m.createdAt.toISOString(),
});

export async function getThread(weddingId: string): Promise<MessageWire[]> {
  const rows = await db
    .select()
    .from(weddingMessages)
    .where(eq(weddingMessages.weddingId, weddingId))
    .orderBy(asc(weddingMessages.createdAt));
  return rows.map(toWire);
}

/** Mark the other side's messages as read by `viewer`. */
export async function markThreadRead(weddingId: string, viewer: "couple" | "team"): Promise<void> {
  if (viewer === "team") {
    await db
      .update(weddingMessages)
      .set({ readByTeam: true })
      .where(and(eq(weddingMessages.weddingId, weddingId), eq(weddingMessages.sender, "couple")));
  } else {
    await db
      .update(weddingMessages)
      .set({ readByCouple: true })
      .where(and(eq(weddingMessages.weddingId, weddingId), eq(weddingMessages.sender, "team")));
  }
}

/** Messages from the other side that `viewer` hasn't opened yet. */
export async function countUnread(weddingId: string, viewer: "couple" | "team"): Promise<number> {
  const rows = await db
    .select({ id: weddingMessages.id })
    .from(weddingMessages)
    .where(
      viewer === "couple"
        ? and(
            eq(weddingMessages.weddingId, weddingId),
            eq(weddingMessages.sender, "team"),
            eq(weddingMessages.readByCouple, false),
          )
        : and(
            eq(weddingMessages.weddingId, weddingId),
            eq(weddingMessages.sender, "couple"),
            eq(weddingMessages.readByTeam, false),
          ),
    );
  return rows.length;
}

export async function addMessage(
  weddingId: string,
  sender: "couple" | "team",
  senderName: string,
  body: string,
): Promise<MessageWire> {
  const [row] = await db
    .insert(weddingMessages)
    .values({
      weddingId,
      sender,
      senderName,
      body,
      // The writer has obviously read their own message.
      readByTeam: sender === "team",
      readByCouple: sender === "couple",
    })
    .returning();
  return toWire(row);
}
