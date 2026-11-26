import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

export const metadata: Metadata = {
  manifest: "/app/manifest.webmanifest",
  applicationName: PLATFORM_NAME,
  appleWebApp: { capable: true, title: PLATFORM_NAME, statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return children;
}
