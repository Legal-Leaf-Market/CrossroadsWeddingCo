import { createElement } from "react";
import { ImageResponse } from "next/og";

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  if (raw !== "192" && raw !== "512") return new Response("Not found", { status: 404 });
  const size = Number(raw);

  return new ImageResponse(
    createElement("div", {
      style: {
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "100%", height: "100%", backgroundColor: "#c1633d", color: "#faf5ec",
        fontSize: size * 0.55, fontWeight: 700,
      },
    }, "C"),
    { width: size, height: size },
  );
}
