// A partner's live menu from its own public Shopify catalog (/products.json,
// open to anyone; Heart of Columbus reads the same feed). Server only.
// Names, prices and links only: product photos stay on their site until the
// partner says we may show them. Refreshed every six hours; if their store
// does not answer, the section simply does not render.

export type MenuItem = { title: string; price: string; type: string; url: string };

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
