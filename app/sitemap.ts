import { PARTNERS } from "@/lib/partners";
import { REVIEW_EVENTS } from "@/lib/review-constants";
import type { MetadataRoute } from "next";
import { CITIES, cityPath } from "@/lib/cities";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/book`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/acoustic`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/events`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/parties`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/back-your-blue`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/venues`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/past-events`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/partners`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...PARTNERS.map((p) => ({
      url: `${SITE_URL}/partners/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    {
      url: `${SITE_URL}/reviews`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/bartending`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...["/brochures", "/brochures/wedding", "/brochures/corporate"].map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...REVIEW_EVENTS.map((e) => ({
      url: `${SITE_URL}/weddings/${e.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...CITIES.map((c) => ({
      url: `${SITE_URL}${cityPath(c)}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
