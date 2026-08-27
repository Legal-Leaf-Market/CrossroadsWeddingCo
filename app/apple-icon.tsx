import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/og-fonts";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The home-screen mark: the brand's serif C on terracotta, matching the
// wordmark the site and Instagram use, instead of a bare crossed-lines X.
// Full bleed; iOS rounds the corners itself.
export default async function AppleIcon() {
  const spectral = await loadGoogleFont("Spectral", 600);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#c1633d",
          color: "#faf5ec",
          fontSize: 128,
          fontWeight: 600,
          ...(spectral ? { fontFamily: "Spectral" } : {}),
          // Optical centering: serif caps sit a touch high in their em box.
          paddingBottom: 10,
        }}
      >
        C
      </div>
    ),
    {
      ...size,
      fonts: spectral
        ? [{ name: "Spectral", data: spectral, weight: 600 as const, style: "normal" as const }]
        : undefined,
    },
  );
}
