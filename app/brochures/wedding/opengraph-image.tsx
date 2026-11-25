import { brochureOgImage } from "@/components/brochures/brochure-og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "The Crossroads wedding brochure: DJ and MC, live acoustic and bar service at flat prices";

export default function OpengraphImage() {
  return brochureOgImage("wedding");
}
