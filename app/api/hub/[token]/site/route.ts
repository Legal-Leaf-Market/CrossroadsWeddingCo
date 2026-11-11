import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getWeddingByToken } from "@/lib/hub";
import { MAX_SITE_FAQ, MAX_SITE_LINKS, MAX_STORY, safeUrl } from "@/lib/wedding-site-constants";
import { saveSite } from "@/lib/wedding-site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

const schema = z.object({
  enabled: z.boolean(),
  story: z.string().max(MAX_STORY, "Keep your story under 3,000 characters").default(""),
  links: z
    .array(z.object({ label: z.string().max(80), url: z.string().max(500) }))
    .max(MAX_SITE_LINKS)
    .default([]),
  faq: z
    .array(z.object({ q: z.string().max(200), a: z.string().max(1500) }))
    .max(MAX_SITE_FAQ)
    .default([]),
});

// The couple's hub link is the credential, same as every other hub section.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400, headers: NO_STORE });
  }
  const d = parsed.data;
  const bad = d.links.find((l) => l.url.trim() && !safeUrl(l.url));
  if (bad) return NextResponse.json({ error: `"${bad.url}" isn't a web address` }, { status: 400, headers: NO_STORE });
  try {
    const { slug } = await saveSite(wedding.id, {
      enabled: d.enabled,
      story: d.story.trim(),
      links: d.links.map((l) => ({ label: l.label.trim(), url: safeUrl(l.url) ?? "" })).filter((l) => l.url),
      faq: d.faq.map((f) => ({ q: f.q.trim(), a: f.a.trim() })).filter((f) => f.q && f.a),
    });
    return NextResponse.json({ ok: true, slug }, { headers: NO_STORE });
  } catch (err) {
    console.error("[hub/site] save failed:", err);
    return NextResponse.json({ error: "Couldn't save just now. Try again in a minute." }, { status: 503, headers: NO_STORE });
  }
}
