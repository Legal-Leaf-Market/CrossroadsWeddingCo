import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/og-fonts";

// The link preview for Jacob's tribute (Facebook, Messages, iMessage, X).
// Typography only, in the page's own colours: no photo, uniform, crest or
// official logo. Every fact on it is already on the page.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "My father was, and still is, my hero. Kevin Lee Kennedy, retired United States Air Force, 21 years. A Back YOUR Blue tribute by Jacob Kennedy.";

const PAPER = "#f6f0e4";
const INK = "#1f1d1a";
const NAVY = "#1f2a44";
const BRASS = "#a8834f";
const SOFT = "#4a443b";

export default async function TributeImage() {
  const [spectral, karla] = await Promise.all([loadGoogleFont("Spectral", 600), loadGoogleFont("Karla", 600)]);
  const display = spectral ? { fontFamily: "Spectral" } : {};
  const body = karla ? { fontFamily: "Karla" } : {};
  const fonts = [
    spectral && { name: "Spectral", data: spectral, weight: 600 as const, style: "normal" as const },
    karla && { name: "Karla", data: karla, weight: 600 as const, style: "normal" as const },
  ].filter((f) => f !== null);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: PAPER, padding: 28 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: `2px solid ${BRASS}`,
            padding: "52px 64px 44px",
          }}
        >
          <div style={{ ...body, display: "flex", fontSize: 24, letterSpacing: 7, color: NAVY }}>
            <span>BACK&nbsp;</span>
            <span style={{ borderBottom: `4px solid ${BRASS}`, paddingBottom: 2 }}>YOUR</span>
            <span>&nbsp;BLUE · A FIRST TRIBUTE</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ ...display, fontSize: 78, lineHeight: 1.06, color: INK, maxWidth: 980 }}>
              My father was, and still is, my hero.
            </div>
            <div style={{ marginTop: 34, width: 120, height: 6, borderRadius: 3, backgroundColor: BRASS }} />
            <div style={{ ...display, marginTop: 30, fontSize: 50, color: NAVY }}>Kevin Lee Kennedy</div>
            <div style={{ ...body, marginTop: 10, fontSize: 27, color: SOFT }}>
              Retired United States Air Force · 21 years · Turns 60 on November 16
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ ...body, fontSize: 24, color: SOFT }}>A tribute by his son, Jacob Kennedy</div>
            <div
              style={{
                ...body,
                fontSize: 24,
                color: PAPER,
                backgroundColor: NAVY,
                borderRadius: 40,
                padding: "12px 28px",
              }}
            >
              Leave Kevin a note for his 60th
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, ...(fonts.length > 0 ? { fonts } : {}) },
  );
}
