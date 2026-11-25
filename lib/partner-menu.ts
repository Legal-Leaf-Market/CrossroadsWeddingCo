// A partner's live menu from its own public Shopify catalog (/products.json,
// open to anyone; Heart of Columbus reads the same feed). Server only.
// getShopifyMenu: names, prices and links, for the shared partner template.
// getShopifyCatalog: the orderable version with photos and variant ids, for
// Cookie Paradise's own page. If their store does not answer, the menu
// section says so (or, in the template, does not render).

import { mapShopifyProducts, type ShopItem } from "@/lib/cookie-order";

export type MenuItem = { title: string; price: string; type: string; url: string };

/**
 * The whole orderable catalog, for a partner page with a cart
 * (/partners/cookie-paradise): photos, sizes and variant ids, in stock and
 * photographed only (lib/cookie-order.ts). Product photos are shown from the
 * shop's own CDN, the way Heart of Columbus shows them (Jacob, 2026-11-25:
 * replicate the Heart of Columbus page). Fifteen minutes old at most; the
 * cart asks the store again right before checkout (/api/partners/stock).
 * An empty list means their store did not answer, and the page says so.
 */
export async function getShopifyCatalog(origin: string): Promise<ShopItem[]> {
  const base = origin.replace(/\/+$/, "");
  const all: unknown[] = [];
  try {
    for (let page = 1; page <= 2; page++) {
      const res = await fetch(`${base}/products.json?limit=250&page=${page}`, {
        next: { revalidate: 900 },
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) break;
      const data = (await res.json()) as { products?: unknown[] };
      const batch = data.products ?? [];
      all.push(...batch);
      if (batch.length < 250) break;
    }
  } catch (err) {
    console.error("[partner-menu] catalog fetch failed:", base, err);
  }
  return mapShopifyProducts(base, all as Parameters<typeof mapShopifyProducts>[1]);
}

type ShopifyVariant = { price?: string; available?: boolean };
type ShopifyProduct = { title?: string; handle?: string; product_type?: string; variants?: ShopifyVariant[] };

const usd = (n: number) => `$${n % 1 ? n.toFixed(2) : n.toFixed(0)}`;

export async function getShopifyMenu(origin: string): Promise<MenuItem[]> {
  const base = origin.replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/products.json?limit=250`, {
      next: { revalidate: 21600 },
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: ShopifyProduct[] };
    return (data.products ?? [])
      .map((p) => {
        const live = (p.variants ?? []).filter((v) => v.available !== false && Number(v.price) > 0);
        if (!p.title || !p.handle || !live.length) return null;
        const prices = live.map((v) => Number(v.price)).sort((a, b) => a - b);
        const lo = prices[0];
        const hi = prices[prices.length - 1];
        const price = lo === hi ? usd(lo) : `${usd(lo)} to ${usd(hi)}`;
        return { title: p.title, price, type: (p.product_type ?? "").trim(), url: `${base}/products/${p.handle}` };
      })
      .filter((x): x is MenuItem => x !== null);
  } catch (err) {
    console.error("[partner-menu] fetch failed:", base, err);
    return [];
  }
}
