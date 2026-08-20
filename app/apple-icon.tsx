import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        }}
      >
        <svg width="120" height="120" viewBox="0 0 64 64">
          <g stroke="#faf5ec" strokeWidth="7" strokeLinecap="round">
            <line x1="20" y1="18" x2="44" y2="46" />
            <line x1="44" y1="18" x2="20" y2="46" />
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
