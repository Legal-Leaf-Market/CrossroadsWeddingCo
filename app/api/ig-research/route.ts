import { NextResponse, type NextRequest } from "next/server";
import { callClaude, extractJson } from "@/lib/ig-studio/claude";
import { searchUnsplash, triggerUnsplashDownload } from "@/lib/ig-studio/unsplash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* /api/ig-research: the research half of /ig-studio.
 *
 *   POST { mode:"findings", topic? }                    -> content ideas + matching Unsplash photos
 *   POST { mode:"draft", finding, photoDownloadLocation?, notes? } -> ONE Instagram post draft
 *
 * Two calls with a person in between, deliberately: run one surfaces ideas and
 * photos, a human picks one of each, run two drafts the post for that specific
 * pairing. Mirrors the pattern in legal-leaf-market/Code_Backup's ig-research.js,
 * scoped down for a single-image post instead of a 7-slide carousel.
 *
 * Fails closed: with no IG_STUDIO_TOKEN set this is 501 and does nothing, so an
 * unconfigured deploy can't be billed by a stranger who finds the URL.
 */

const FINDINGS_SYSTEM = `You are a content research assistant for Crossroads Wedding Co., a wedding DJ,
live acoustic music, bar service, and day-of-coordination business based in the Midwest. It specializes
in backyard weddings, DIY venues, and indie-folk-leaning celebrations rather than formal ballrooms. The
DJ service is a flat $1,000 day rate covering ceremony through last dance, sound equipment, MC duties,
and day-of timeline coordination.

Search the web for genuinely useful, current content ideas for this business's Instagram: seasonal
wedding-planning trends, backyard/DIY/indie-folk wedding inspiration, practical tips couples actually
search for, or notable shifts in the wedding-vendor industry relevant to a small DJ/entertainment
business. This is content research for social posts, not journalism. Keep it practical and on-brand.
No hype, no fake urgency, no invented statistics.

For each idea report: the headline, what it is, why it matters to couples planning backyard/DIY/indie-folk
weddings, a suggested angle for an Instagram post, and the source url.

Return ONLY a JSON array of at most 8 objects, no prose around it:
[{"headline": "...", "what": "one or two sentences", "why": "one sentence", "angle": "the post this could become, one line",
  "sources": ["url", ...], "confidence": "high|medium|low"}]
confidence is LOW when one outlet carries it, MEDIUM when reported but not primary, HIGH when a primary
source confirms it. Be honest: the editor is deciding what to post from this.`;

const DRAFT_SYSTEM = `You draft ONE Instagram post for Crossroads Wedding Co. (wedding DJ, live acoustic
sets, bar service, day-of coordination; flat $1,000 DJ day rate; backyard/DIY/indie-folk niche; Midwest),
from a finding a human editor has already chosen. House voice: warm, honest, no hype, no fake urgency.
The business has no client testimonials yet. Never invent one, a client name, or a review.

Never invent a statistic, price, or client story. The $1,000 day rate may be reused since it's a real
fact; do not invent any other number, date, or figure not present in the finding you were given.

Return ONLY JSON, no prose around it:
{"overlayHeadline": "text to appear ON the image, 8 words or fewer",
 "overlaySubhead": "optional short supporting line, 12 words or fewer, or empty string",
 "caption": "the Instagram caption. First line is the hook, 2-4 short paragraphs",
 "hashtags": ["#weddingdj", ... 8-15 relevant tags mixing broad, niche, and regional terms],
 "claims": [{"claim": "the factual assertion as it appears", "source": "url", "confidence": "high|medium|low"}]}
claims is an empty array if the post asserts nothing factual beyond the $1,000 rate, most posts won't need it.`;

function noStore(json: unknown, status = 200) {
  return NextResponse.json(json, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

function authorized(req: NextRequest): boolean {
  const token = process.env.IG_STUDIO_TOKEN;
  return !!token && req.headers.get("x-studio-token") === token;
}

export async function POST(req: NextRequest) {
  if (!process.env.IG_STUDIO_TOKEN) {
    return noStore(
      {
        error: "IG_STUDIO_TOKEN is not set, so this tool is off",
        hint: "fails closed on purpose so an unconfigured deploy can't be billed by a stranger",
      },
      501,
    );
  }
  if (!authorized(req)) return noStore({ error: "Unauthorized" }, 401);

  if (!process.env.ANTHROPIC_API_KEY) {
    return noStore(
      { error: "ANTHROPIC_API_KEY is not set, so there's nothing to research with" },
      501,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return noStore({ error: "Invalid request" }, 400);
  }

  const mode = body.mode === "draft" ? "draft" : "findings";

  if (mode === "findings") {
    const topic = String(body.topic || "").trim().slice(0, 300);
    const user = topic
      ? `Research this specifically: ${topic}\n\nToday is ${new Date().toISOString().slice(0, 10)}.`
      : `Suggest current, on-brand Instagram content ideas for a backyard/indie-folk-leaning wedding DJ business in the Midwest. Today is ${new Date().toISOString().slice(0, 10)}.`;

    const [textResult, photos] = await Promise.all([
      callClaude({ system: FINDINGS_SYSTEM, user, useSearch: true }).catch(
        (err: Error) => ({ error: err.message }),
      ),
      searchUnsplash(topic || "backyard indie folk wedding string lights"),
    ]);

    if (typeof textResult === "object") {
      return noStore({ error: "The model call failed", detail: textResult.error.slice(0, 300) }, 502);
    }

    const parsed = extractJson(textResult);
    const findings = Array.isArray(parsed) ? parsed : [];

    return noStore({ mode, findings, photos });
  }

  // draft mode
  const finding = body.finding;
  if (!finding || typeof finding !== "object") {
    return noStore({ error: "draft mode needs the finding you picked" }, 400);
  }

  const user =
    `Draft the Instagram post for this finding:\n\n${JSON.stringify(finding).slice(0, 3000)}` +
    (body.notes ? `\n\nEditor's steer: ${String(body.notes).slice(0, 400)}` : "");

  let text: string;
  try {
    text = await callClaude({ system: DRAFT_SYSTEM, user, useSearch: false });
  } catch (err) {
    return noStore({ error: "The model call failed", detail: (err as Error).message.slice(0, 300) }, 502);
  }

  const parsed = extractJson(text) as Record<string, unknown> | null;
  if (!parsed) {
    return noStore({ error: "The model did not return usable JSON", raw: text.slice(0, 1000) }, 502);
  }

  if (typeof body.photoDownloadLocation === "string" && body.photoDownloadLocation) {
    triggerUnsplashDownload(body.photoDownloadLocation);
  }

  return noStore({
    mode,
    draft: {
      overlayHeadline: String(parsed.overlayHeadline || ""),
      overlaySubhead: String(parsed.overlaySubhead || ""),
      caption: String(parsed.caption || ""),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String) : [],
    },
    claims: Array.isArray(parsed.claims) ? parsed.claims : [],
  });
}
