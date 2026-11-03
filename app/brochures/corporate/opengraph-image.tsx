import { brochureOgImage } from "@/components/brochures/brochure-og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "The Crossroads corporate events brochure: DJ, sound and MC at one flat price";

export default function OpengraphImage() {
  return brochureOgImage("corporate");
}
