// Satori (next/og) can't read the fonts next/font bundles, so the generated
// images pull the site's faces straight from Google Fonts. The legacy UA makes
// the CSS endpoint hand back a .ttf instead of a .woff2, which is what satori
// can parse. Shared by the OG image and the app icons.
const LEGACY_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/533.20.25";

export async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const cssRes = await fetch(
      `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`,
      { headers: { "User-Agent": LEGACY_UA } },
    );
    if (!cssRes.ok) return null;

    const fontUrl = (await cssRes.text()).match(/src: url\((https:\/\/[^)]+\.ttf)\)/)?.[1];
    if (!fontUrl) return null;

    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) return null;

    return await fontRes.arrayBuffer();
  } catch {
    // Callers fall back to satori's built-in sans rather than failing the build.
    return null;
  }
}
