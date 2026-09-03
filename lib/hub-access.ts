import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { weddings } from "@/lib/db/schema";

/**
 * Who can get into a couple's hub, and who can speak in it.
 *
 * Neither list is an access control. The hub URL is the only credential this
 * product has: whoever holds it is in, and the emails here are a record of who
 * the couple meant to share it with, not a gate. The speaker list is the same
 * shape of thing as TEAM_NAMES on our side, a set of names to pick from so a
 * thread reads sensibly, not proof of who anybody is.
 *
 * Saying that plainly matters, because "add an email to the hub" sounds like
 * it grants something and "remove an email" sounds like it revokes something.
 * Neither is true today. Removing an address does not lock anyone out; only
 * reissuing the wedding's access token does that.
 */

export const MAX_INVITE_EMAILS = 10;
export const MAX_SPEAKERS = 12;
export const MAX_SPEAKER_NAME = 40;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanEmails(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const value = String(raw ?? "").trim().toLowerCase();
    if (!value || !EMAIL_RE.test(value) || value.length > 255) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= MAX_INVITE_EMAILS) break;
  }
  return out;
}

/**
 * Names are compared case-insensitively so "Jane" and "jane" do not both end
 * up in the picker, but the first spelling someone chose is what everyone
 * sees: it is their name.
 */
export function cleanSpeakerName(input: unknown): string {
  return String(input ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SPEAKER_NAME);
}

export function hasSpeaker(speakers: string[], name: string): boolean {
  const needle = name.toLowerCase();
  return speakers.some((s) => s.toLowerCase() === needle);
}

export async function setInviteEmails(weddingId: string, emails: string[]): Promise<string[]> {
  const cleaned = cleanEmails(emails);
  await db.update(weddings).set({ hubInviteEmails: cleaned }).where(eq(weddings.id, weddingId));
  return cleaned;
}

/**
 * Appends a name if it is new. Returns the whole list either way so the client
 * can render from one answer, and so two people naming themselves at the same
 * moment converge instead of one overwriting the other.
 */
export async function addSpeaker(
  weddingId: string,
  current: string[],
  rawName: string,
): Promise<{ speakers: string[]; error?: string }> {
  const name = cleanSpeakerName(rawName);
  if (name.length < 2) return { speakers: current, error: "Please give us a first name." };
  if (hasSpeaker(current, name)) return { speakers: current };
  if (current.length >= MAX_SPEAKERS) {
    return { speakers: current, error: "That's as many people as this hub can hold." };
  }
  const next = [...current, name];
  await db.update(weddings).set({ hubSpeakers: next }).where(eq(weddings.id, weddingId));
  return { speakers: next };
}
