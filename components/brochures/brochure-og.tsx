import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/og-fonts";
import { BROCHURES, type BrochureKind } from "@/lib/brochures";
import { BROCHURE_LOGO_DATA_URI } from "@/lib/brochure-logo";
import { SITE_NAME } from "@/lib/site";

export const BROCHURE_OG_SIZE = { width: 1200, height: 630 };

// The card a shared brochure link shows in a text thread, Facebook, LinkedIn
// or Pinterest: the brochure's own cover look (cream, double gold frame,
// compass), its headline and its price line.
export async function brochureOgImage(kind: BrochureKind) {
  const b = BROCHURES[kind];
  const [spectral, karla] = await Promise.all([loadGoogleFont("Spectral", 600), loadGoogleFont("Karla", 500)]);
  const display = spectral ? { fontFamily: "Spectral" } : {};
  const body = karla ? { fontFamily: "Karla" } : {};
  const fonts = [
    spectral && { name: "Spectral", data: spectral, weight: 600 as const, style: "normal" as const },
    karla && { name: "Karla", data: karla, weight: 500 as const, style: "normal" as const },
  ].filter((font) => font !== null);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: "#fffdfa", padding: 28 }}>
        <div style={{ flex: 1, display: "flex", border: "5px solid #c8873f", padding: 8 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 56,
              border: "2px solid #c8873f",
              padding: "40px 64px",
            }}
          >
            <img src={BROCHURE_LOGO_DATA_URI} width={300} height={300} alt="" />
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ ...body, fontSize: 24, letterSpacing: 5, textTransform: "uppercase", color: "#6b6158" }}>
                {b.title}
              </div>
              <div style={{ ...display, marginTop: 18, fontSize: 60, lineHeight: 1.1, color: "#2b2622" }}>
                {b.headline}
              </div>
              <div style={{ ...body, marginTop: 24, fontSize: 28, lineHeight: 1.35, color: "#a34d2b" }}>
                {b.priceLine}
              </div>
              <div style={{ ...display, marginTop: 30, fontSize: 30, color: "#2b2622" }}>{SITE_NAME}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...BROCHURE_OG_SIZE, ...(fonts.length > 0 ? { fonts } : {}) },
  );
}
