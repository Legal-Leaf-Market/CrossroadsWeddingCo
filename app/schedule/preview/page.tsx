import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GuestSchedule from "@/components/hub/GuestSchedule";

// Dev-only layout twin of the guest order of events, so the page can be
// measured without a database. 404s in production builds.
export const metadata: Metadata = {
  title: "Guest schedule preview",
  robots: { index: false, follow: false },
};

export default function GuestSchedulePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <GuestSchedule
      coupleNames="Jordan Hayes &amp; Taylor Morgan"
      eventDate="Saturday, June 12, 2027"
      venueName="The Sycamore Barn"
      items={[
        { id: "1", title: "Guests arrive", startTime: "14:00" },
        { id: "2", title: "Processional", startTime: "14:30" },
        { id: "3", title: "Ceremony", startTime: "15:00" },
        { id: "4", title: "Coffee hour", startTime: "15:30" },
        { id: "5", title: "Grand entrance", startTime: "16:30" },
        { id: "6", title: "Dinner", startTime: "16:45" },
        { id: "7", title: "Speeches", startTime: "17:30" },
        { id: "8", title: "First dance", startTime: "18:00" },
        { id: "9", title: "Cake cutting", startTime: "18:15" },
        { id: "10", title: "Bouquet and garter toss", startTime: "18:30" },
        { id: "11", title: "Open floor", startTime: "19:00" },
        { id: "12", title: "Last song and send-off", startTime: "21:00" },
      ]}
    />
  );
}
