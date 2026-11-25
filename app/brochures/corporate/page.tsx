import type { Metadata } from "next";
import BrochurePage from "@/components/brochures/BrochurePage";
import { BROCHURES } from "@/lib/brochures";

const b = BROCHURES.corporate;
const TITLE = "Corporate events brochure: DJ, sound and MC";
const DESCRIPTION = `${b.priceLine}. Holiday parties, galas and company events on one trifold. Share it with your boss, HR or the office party planner.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: b.path },
  openGraph: { url: b.path, title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function CorporateBrochurePage() {
  return <BrochurePage kind="corporate" />;
}
