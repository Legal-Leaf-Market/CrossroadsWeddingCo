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
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: NAVY,
          backgroundImage: `radial-gradient(circle at 50% 0%, #34477a 0%, ${NAVY} 60%, #141b2e 100%)`,
          padding: 36,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            backgroundColor: PAPER,
            borderRadius: 40,
            border: `4px solid ${BRASS}`,
            boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
            padding: "28px 60px",
          }}
        >
          <div style={{ ...body, display: "flex", fontSize: 24, letterSpacing: 7, color: NAVY }}>
            <span>BACK&nbsp;</span>
            <span style={{ borderBottom: `5px solid ${BRASS}`, paddingBottom: 2 }}>YOUR</span>
            <span>&nbsp;BLUE · A FIRST TRIBUTE</span>
          </div>

          {/* Broken by hand so "my hero." lands together on the second line. */}
          <div style={{ ...display, marginTop: 18, fontSize: 64, lineHeight: 1.06, color: INK, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span>My father was, and still is,</span>
            <span>my hero.</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", marginTop: 30 }}>
            <div style={{ width: 70, height: 4, borderRadius: 2, backgroundColor: BRASS }} />
            <div style={{ width: 14, height: 14, margin: "0 16px", backgroundColor: BRASS, transform: "rotate(45deg)" }} />
            <div style={{ width: 70, height: 4, borderRadius: 2, backgroundColor: BRASS }} />
          </div>

          <div style={{ ...display, marginTop: 14, fontSize: 58, lineHeight: 1.1, color: NAVY, letterSpacing: -0.5 }}>Kevin Lee Kennedy</div>
          <div style={{ ...body, marginTop: 6, fontSize: 25, color: SOFT }}>
            Retired United States Air Force · 21 years · Turns 60 on November 16
          </div>

          <div
            style={{
              ...body,
              marginTop: 24,
              fontSize: 26,
              color: PAPER,
              backgroundColor: NAVY,
              border: `3px solid ${BRASS}`,
              borderRadius: 50,
              padding: "12px 38px",
            }}
          >
            Leave Kevin a note for his 60th
          </div>
          <div style={{ ...body, marginTop: 14, fontSize: 20, color: SOFT }}>A tribute by his son, Jacob Kennedy</div>
        </div>
      </div>
    ),
    { ...size, ...(fonts.length > 0 ? { fonts } : {}) },
  );
}
