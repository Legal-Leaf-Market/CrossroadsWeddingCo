import { NextResponse } from "next/server";
import type { MetadataRoute } from "next";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

const manifest: MetadataRoute.Manifest = {
  id: "/app/",
  name: PLATFORM_NAME,
  short_name: "Crossroads",
  description: "Bookings, transactions, expenses and accounting for your business.",
  start_url: "/app/books",
  scope: "/app/",
  display: "standalone",
  background_color: "#faf5ec",
  theme_color: "#faf5ec",
  icons: [
    { src: "/app/install-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/app/install-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/app/install-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export function GET() {
  return NextResponse.json(manifest, {
    headers: { "Content-Type": "application/manifest+json", "X-Robots-Tag": "noindex" },
  });
}
