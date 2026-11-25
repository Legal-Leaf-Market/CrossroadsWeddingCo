import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_PARADISE } from "@/lib/cookie-paradise";

// POST /api/partners/stock  { partner, lines: [{ handle, variantId }] }
// The cart asks this right before it hands the order to the partner's own
// checkout: which of these sold out at the store this minute? The menu on the
// page can be up to fifteen minutes old, and the rule is in stock only, so the
// last word comes from the store. Ported from Heart of Columbus's /api/stock.
//
// Only stores listed here are asked, at the origin on file: the browser names
// a partner, never an address. A store that does not answer in time counts as
// nothing sold out, so a slow shop never blocks a checkout; its own checkout
// still has the final word. Answers { ok, sold: [variantId...] }, never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORES: Record<string, string> = { [COOKIE_PARADISE.slug]: COOKIE_PARADISE.origin };

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

type ProductJs = { available?: boolean; variants?: { id?: number | string; available?: boolean }[] };

async function product(origin: string, handle: string): Promise<ProductJs | null> {
  try {
    const res = await fetch(`${origin}/products/${encodeURIComponent(handle)}.js`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? ((await res.json()) as ProductJs) : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: { partner?: unknown; lines?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, error: "Send JSON." }, 400);
  }
  const origin = STORES[String(body.partner || "")];
  if (!origin) return reply({ ok: false, error: "Unknown partner." }, 404);
  const lines = (Array.isArray(body.lines) ? body.lines : []).slice(0, 30) as { handle?: unknown; variantId?: unknown }[];
  const byHandle = new Map<string, string[]>();
  for (const l of lines) {
    const handle = String(l?.handle || "");
    const id = String(l?.variantId || "");
    if (!/^[a-z0-9][a-z0-9-]{0,120}$/i.test(handle) || !/^\d{1,20}$/.test(id)) continue;
    byHandle.set(handle, [...(byHandle.get(handle) || []), id]);
  }
  const sold = new Set<string>();
  await Promise.all(
    [...byHandle].slice(0, 15).map(async ([handle, ids]) => {
      const p = await product(origin, handle);
      if (!p) return;
      if (p.available === false) {
        ids.forEach((id) => sold.add(id));
        return;
      }
      for (const id of ids) {
        const v = (p.variants || []).find((x) => String(x.id) === id);
        if (!v || v.available === false) sold.add(id);
      }
    }),
  );
  return reply({ ok: true, sold: [...sold] });
}
