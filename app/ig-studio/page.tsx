import type { Metadata } from "next";
import IgStudioClient from "@/components/ig-studio/IgStudioClient";

export const metadata: Metadata = {
  title: "IG Studio",
  robots: { index: false, follow: false },
};

export default function IgStudioPage() {
  return <IgStudioClient />;
}
