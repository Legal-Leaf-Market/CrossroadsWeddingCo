import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Internal tooling and endpoints: nothing a search engine should index.
      // /hub/ is deliberately NOT disallowed: its pages carry noindex robots
      // metadata, and a crawler must be able to fetch them to see it. Blocking
      // them here would let an externally leaked hub URL be indexed URL-only.
      disallow: ["/api/", "/ig-studio"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
