import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WeddingSite from "@/components/site/WeddingSite";
import { SITE_NAME } from "@/lib/site";

// Dev-only layout twin of the wedding website, with obviously sample details.
// 404s in production builds.
export const metadata: Metadata = { title: "Wedding website preview", robots: { index: false, follow: false } };

export default function WeddingSitePreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <WeddingSite
      sample
      coupleNames="Sample & Partner"
      dateLabel="Saturday, June 12, 2027"
      daysToGo={213}
      venueName="The Sample Barn"
      venueAddress="123 Sample Rd, Columbus, IN"
      dressCode="Garden party. Comfortable shoes for the lawn."
      story={"We met at a friend's backyard cookout and argued about the best pizza in town.\n\nWe still haven't settled it, but we did settle on each other."}
      schedule={[
        { title: "Guests arrive", startTime: "15:30" },
        { title: "Ceremony", startTime: "16:00" },
        { title: "Cocktail hour", startTime: "16:30" },
        { title: "Dinner and toasts", startTime: "18:00" },
        { title: "Dancing", startTime: "19:30" },
        { title: "Send off", startTime: "22:45" },
      ]}
      links={[
        { label: "Registry", url: "https://example.com/registry" },
        { label: "Hotel block", url: "https://example.com/hotel" },
      ]}
      faq={[
        { q: "Is there parking?", a: "Yes, free parking on site." },
        { q: "Are kids welcome?", a: "We love your kids, but this one is adults only." },
      ]}
      brandName={SITE_NAME}
      art={null}
      photos={[]}
    />
  );
}
