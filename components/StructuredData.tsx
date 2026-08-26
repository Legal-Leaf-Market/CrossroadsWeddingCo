import { CITIES } from "@/lib/cities";
import {
  CONTACT_EMAIL,
  SERVICE_OFFERS,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

// schema.org LocalBusiness describing the business, where it operates, and
// what it sells. City pages hang their Service nodes off this @id.
// AggregateRating is deliberately absent until real on-page reviews exist
// (CLAUDE.md §9.1).
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${SITE_URL}/#business`,
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  email: CONTACT_EMAIL,
  image: `${SITE_URL}/opengraph-image`,
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Columbus",
    addressRegion: "IN",
    addressCountry: "US",
  },
  areaServed: [
    ...CITIES.map((c) => ({
      "@type": "City",
      name: c.name,
      containedInPlace: { "@type": "State", name: c.stateName },
    })),
    {
      "@type": "GeoCircle",
      geoMidpoint: { "@type": "GeoCoordinates", latitude: 39.2014, longitude: -85.9214 },
      // ~2 hours of driving from Columbus, IN.
      geoRadius: "160000",
    },
  ],
  makesOffer: SERVICE_OFFERS.map((offer) => ({
    "@type": "Offer",
    itemOffered: {
      "@type": "Service",
      name: offer.name,
      description: offer.description,
    },
    ...(offer.priceUsd !== null
      ? { price: String(offer.priceUsd), priceCurrency: "USD" }
      : "minPriceUsd" in offer && offer.minPriceUsd !== undefined
        ? {
            priceSpecification: {
              "@type": "PriceSpecification",
              minPrice: offer.minPriceUsd,
              priceCurrency: "USD",
            },
          }
        : {}),
  })),
};

export default function StructuredData() {
  return (
    <script
      type="application/ld+json"
      // Serialized from a local constant, so there's no untrusted input to escape.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
    />
  );
}
