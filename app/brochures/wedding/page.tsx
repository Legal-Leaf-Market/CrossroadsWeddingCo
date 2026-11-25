import type { Metadata } from "next";
import BrochurePage from "@/components/brochures/BrochurePage";
import { BROCHURES } from "@/lib/brochures";

const b = BROCHURES.wedding;
const TITLE = "Wedding brochure: DJ & MC, live acoustic and bar service";
const DESCRIPTION = `${b.priceLine}. The whole Crossroads wedding menu on one trifold. Share it with the bride, the couple or the group chat.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: b.path },
  openGraph: { url: b.path, title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function WeddingBrochurePage() {
  return <BrochurePage kind="wedding" />;
}
