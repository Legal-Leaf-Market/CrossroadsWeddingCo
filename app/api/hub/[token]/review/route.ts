import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { getWeddingByToken } from "@/lib/hub";
import { createEntry, hubNotesToday } from "@/lib/reviews";
import { EMAIL_FROM_ADDRESS, OWNER_EMAIL, SITE_NAME, SITE_URL } from "@/lib/site";
import { isHouseTenant } from "@/lib/tenant-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

const schema = z.object({
  name: z.string().trim().min(1, "Add your names so people know who wrote it").max(80),
  message: z.string().trim().min(2, "Write a few words first").max(2000, "Keep it under 2,000 characters"),
});

// The couple tells us how their day went, from inside their own hub. The hub
// link is the proof it is them. It waits for approval like any other note and
// shows on the event page for their date once approved. Crossroads weddings
// only, and only once the day has come.
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding || !isHouseTenant(wedding.tenantId)) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Indiana/Indianapolis" });
  if (wedding.eventDate > today) {
    return NextResponse.json({ error: "This opens after your wedding day." }, { status: 409, headers: NO_STORE });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400, headers: NO_STORE });
  }
  try {
    if ((await hubNotesToday(wedding.id)) >= 3) {
      return NextResponse.json({ error: "We've got your notes. Thank you! You can add another tomorrow." }, { status: 429, headers: NO_STORE });
    }
    await createEntry({ name: parsed.data.name, relation: "Our wedding", message: parsed.data.message, weddingId: wedding.id });
  } catch (err) {
    console.error("[hub/review] insert failed:", err);
    return NextResponse.json({ error: "We couldn't save that right now. Try again in a minute." }, { status: 503, headers: NO_STORE });
  }
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const adminKey = process.env.ADMIN_DASH_KEY;
      const link = adminKey && adminKey.length >= 16 ? `${SITE_URL}/admin/${adminKey}/reviews` : "the reviews screen in the bookings dashboard";
      const { error } = await new Resend(key).emails.send({
        from: process.env.RESEND_FROM ?? `${SITE_NAME} <${EMAIL_FROM_ADDRESS}>`,
        to: process.env.RESEND_NOTIFY_TO ?? OWNER_EMAIL,
        subject: `${wedding.coupleNames} wrote about their wedding`,
        text: [`${parsed.data.name} wrote from their planning hub:`, "", parsed.data.message, "", `Approve it here: ${link}`].join("\n"),
      });
      if (error) console.error("[hub/review] email failed:", error);
    } catch (err) {
      console.error("[hub/review] email failed:", err);
    }
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
