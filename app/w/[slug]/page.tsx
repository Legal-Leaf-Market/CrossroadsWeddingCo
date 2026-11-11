import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WeddingSite from "@/components/site/WeddingSite";
import { brandForTenant, brandedMetadata } from "@/lib/brand";
import { daysOut, formatEventDate } from "@/lib/hub-constants";
import { resolveWeddingArt } from "@/lib/wedding-art-server";
import { getPublishedSite } from "@/lib/wedding-site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublishedSite(slug).catch(() => null);
  if (!site) return { title: "Not found", robots: { index: false, follow: false } };
  const brand = await brandForTenant(site.wedding.tenantId);
  const title = `${site.wedding.coupleNames}, ${formatEventDate(site.wedding.eventDate)}`;
  // Never indexed: a wedding page is for the guests it is sent to, not for search.
  const base = brandedMetadata(brand, title);
  return {
    ...base,
    title: { absolute: title },
    description: `${site.wedding.coupleNames} are getting married at ${site.wedding.venueName}.`,
    openGraph: { title, description: `${site.wedding.venueName}`, siteName: site.wedding.coupleNames, url: undefined, images: [] },
    robots: { index: false, follow: false },
  };
}

export default async function WeddingSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  if (!site) notFound();
  const w = site.wedding;
  const brand = await brandForTenant(w.tenantId);
  const days = daysOut(w.eventDate);
  return (
    <WeddingSite
      coupleNames={w.coupleNames}
      dateLabel={formatEventDate(w.eventDate)}
      daysToGo={Number.isFinite(days) && days >= 0 ? days : null}
      venueName={w.venueName}
      venueAddress={w.venueAddress}
      dressCode={w.dressCode}
      story={w.siteStory}
      schedule={site.schedule}
      links={site.links}
      faq={site.faq}
      brandName={brand.name}
      art={resolveWeddingArt(w.artTheme, w.shareToken)}
      photos={site.photos.map((ph) => ({ src: `/w/${slug}/photo/${ph.id}`, width: ph.width, height: ph.height }))}
    />
  );
}
