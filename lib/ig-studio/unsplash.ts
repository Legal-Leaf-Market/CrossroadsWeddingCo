export type UnsplashPhoto = {
  id: string;
  url: string;
  thumb: string;
  width: number;
  height: number;
  photographer: string;
  photographerUrl: string;
  downloadLocation: string;
};

export async function searchUnsplash(query: string): Promise<UnsplashPhoto[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
    query,
  )}&per_page=9&orientation=squarish`;

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}` },
  });
  if (!res.ok) return [];

  const json = await res.json();
  type Result = {
    id: string;
    urls: { regular: string; small: string };
    width: number;
    height: number;
    user?: { name?: string; links?: { html?: string } };
    links?: { download_location?: string };
  };
  const results = (json.results || []) as Result[];

  return results.map((p) => ({
    id: p.id,
    url: p.urls.regular,
    thumb: p.urls.small,
    width: p.width,
    height: p.height,
    photographer: p.user?.name || "Unknown",
    photographerUrl: p.user?.links?.html || "https://unsplash.com",
    downloadLocation: p.links?.download_location || "",
  }));
}

/* Unsplash's API guidelines require pinging download_location when a photo is
   actually used, separately from the search/display call. Fire-and-forget:
   this never blocks the user's draft on Unsplash's own uptime. */
export function triggerUnsplashDownload(downloadLocation: string) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !downloadLocation) return;
  fetch(downloadLocation, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => {});
}
