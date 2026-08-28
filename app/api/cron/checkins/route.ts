import { NextResponse } from "next/server";
import { and, isNotNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { weddings } from "@/lib/db/schema";
import { daysOut } from "@/lib/hub-constants";
import { isSmsConfigured, sendSms, toE164US } from "@/lib/sms";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Daily milestone check-in texts (owner request 2026-08-27, CLAUDE.md §9.4):
// 90, 30, and 14 days out the couple gets a short "checking in" text with
// their hub link. Runs from vercel.json's cron at 15:00 UTC (10/11am at the
// venue); Vercel authenticates cron requests with `Authorization: Bearer
// $CRON_SECRET` automatically once that env var exists. Fails closed at
// every layer: no secret, wrong secret, or no Twilio keys means no texts and
// no errors for the cron to retry-loop on.
export const dynamic = "force-dynamic";

const MILESTONES = [90, 30, 14] as const;

// Same voice as the owner's example ("Hey, checking in. Getting close. Let
// us know if you need anything."), one message per milestone.
function messageFor(milestone: number, hubUrl: string): string {
  switch (milestone) {
    case 90:
      return `${SITE_NAME}: Hey, checking in! 90 days out. Getting close. Let us know if you need anything. Your hub: ${hubUrl}`;
    case 30:
      return `${SITE_NAME}: One month out! If the timeline or the music needs a look, your hub is ready: ${hubUrl}. Text back any time.`;
    default:
      return `${SITE_NAME}: Two weeks! We're locking in details on our end. Give your hub a once-over when you can: ${hubUrl}. Anything at all, text us.`;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ skipped: "CRON_SECRET not configured" }, { status: 501 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isSmsConfigured()) {
    // 200, not an error: the cron should idle quietly until Twilio keys land.
    return NextResponse.json({ skipped: "sms not configured" });
  }

  // Candidates: future weddings with a phone number that still have an
  // unsent milestone. The tightest milestone window is 14 days, and texting
  // starts only once a wedding is at least 2 days old so a fresh booking
  // never gets a check-in on the heels of its confirmation text.
  const rows = await db
    .select({
      id: weddings.id,
      coupleNames: weddings.coupleNames,
      contactPhone: weddings.contactPhone,
      eventDate: weddings.eventDate,
      accessToken: weddings.accessToken,
      checkinsSent: weddings.checkinsSent,
    })
    .from(weddings)
    .where(
      and(
        isNotNull(weddings.contactPhone),
        notInArray(weddings.status, ["cancelled", "completed"]),
        sql`${weddings.eventDate} > current_date`,
        sql`${weddings.createdAt} < now() - interval '2 days'`,
      ),
    );

  let sent = 0;
  let failed = 0;
  const details: string[] = [];

  for (const w of rows) {
    const d = daysOut(w.eventDate);
    if (d <= 0) continue;
    const already = Array.isArray(w.checkinsSent)
      ? (w.checkinsSent as unknown[]).filter((m): m is number => typeof m === "number")
      : [];
    // Milestones this wedding has reached (e.g. 25 days out reaches 90 and
    // 30). Text only the tightest one; mark every reached milestone sent so
    // a late booking never gets a stack of catch-up texts.
    const reached = MILESTONES.filter((m) => d <= m);
    const unsent = reached.filter((m) => !already.includes(m));
    if (unsent.length === 0) continue;

    const to = w.contactPhone ? toE164US(w.contactPhone) : null;
    if (!to) continue;

    const milestone = Math.min(...unsent);
    try {
      await sendSms(to, messageFor(milestone, `${SITE_URL}/hub/${w.accessToken}`));
      await db
        .update(weddings)
        .set({ checkinsSent: [...already, ...unsent].sort((a, b) => b - a) })
        .where(sql`${weddings.id} = ${w.id}`);
      sent += 1;
      details.push(`${w.coupleNames}: ${milestone}-day check-in`);
    } catch (err) {
      // Leave the milestone unmarked; tomorrow's run retries it.
      failed += 1;
      console.error(`[checkins] ${w.id} failed:`, err);
    }
  }

  return NextResponse.json({ checked: rows.length, sent, failed, details });
}
