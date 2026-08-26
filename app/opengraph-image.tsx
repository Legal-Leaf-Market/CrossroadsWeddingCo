import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "Crossroads Wedding Co., the DJ and music crew that also quietly runs your day";

// Satori can't read the fonts next/font bundles, so pull the same two faces the
// site uses straight from Google Fonts. The legacy UA makes the CSS endpoint
// hand back a .ttf instead of a .woff2, which is what satori can parse.
const LEGACY_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/533.20.25";

async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
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
    // Fall back to satori's built-in sans rather than failing the build.
    return null;
  }
}

export default async function OpengraphImage() {
  const [spectral, karla] = await Promise.all([
    loadGoogleFont("Spectral", 600),
    loadGoogleFont("Karla", 500),
  ]);

  // Naming a family satori wasn't given would silently fall back anyway, but
  // being explicit keeps the two typefaces from swapping roles.
  const display = spectral ? { fontFamily: "Spectral" } : {};
  const body = karla ? { fontFamily: "Karla" } : {};

  const fonts = [
    spectral && { name: "Spectral", data: spectral, weight: 600 as const, style: "normal" as const },
    karla && { name: "Karla", data: karla, weight: 500 as const, style: "normal" as const },
  ].filter((font) => font !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: "#2b2622",
          padding: "72px 80px",
        }}
      >
        <div
          style={{
            ...body,
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#cf9d4c",
          }}
        >
          Backyard weddings · DIY venues · Ballrooms
        </div>

        <div
          style={{
            ...display,
            marginTop: 36,
            maxWidth: 940,
            fontSize: 68,
            lineHeight: 1.15,
            color: "#faf5ec",
          }}
        >
          The DJ &amp; music crew that also quietly runs your day.
        </div>

        <div
          style={{
            marginTop: 44,
            width: 132,
            height: 8,
            borderRadius: 4,
            backgroundColor: "#c1633d",
          }}
        />

        <div
          style={{
            marginTop: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ ...display, fontSize: 34, color: "#faf5ec" }}>{SITE_NAME}</div>
          <div style={{ ...body, fontSize: 26, color: "#a49a8e" }}>
            DJ · Live music · Bar · Day-of
          </div>
        </div>
      </div>
    ),
    { ...size, ...(fonts.length > 0 ? { fonts } : {}) },
  );
}
