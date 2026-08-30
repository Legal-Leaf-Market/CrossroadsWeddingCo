import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GuestSchedule from "@/components/hub/GuestSchedule";
import { getLiveBlocks, getWeddingByShareToken } from "@/lib/hub";
import { formatEventDate } from "@/lib/hub-constants";
import { weddingArt } from "@/lib/wedding-art";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order of events",
  robots: { index: false, follow: false },
};

// Guest-facing order of events. Same zero-auth share token as the vendor live
// view, but a different audience: times and titles only, never the MC notes,
// and built to be screenshotted or printed onto a sign. It reads the couple's
// own timeline, so it can never drift from the run sheet the way a graphic
// exported once in March does.
export default async function GuestSchedulePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const wedding = await getWeddingByShareToken(token);
  if (!wedding) notFound();
  const blocks = await getLiveBlocks(wedding.id);
  const items = blocks
    .filter((b) => b.title.trim() !== "")
    .map((b) => ({ id: b.id, title: b.title, startTime: b.scheduledStartTime }));

  return (
    <GuestSchedule
      coupleNames={wedding.coupleNames}
      eventDate={formatEventDate(wedding.eventDate)}
      venueName={wedding.venueName}
      items={items}
      art={weddingArt(wedding.artTheme)}
    />
  );
}
