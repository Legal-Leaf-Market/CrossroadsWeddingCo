import { CITIES } from "@/lib/cities";
import {
  CONTACT_EMAIL,
  CONTACT_PHONE,
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
  "@id": SITE_URL + "/#business",
  name: SITE_NAME,
  alternateName: "Crossroads Wedding Co.",
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  email: CONTACT_EMAIL,
  telephone: CONTACT_PHONE,
  sameAs: ["https://www.theknot.com/marketplace/crossroads-wedding-co-columbus-in-2107955"],
  image: SITE_URL + "/opengraph-image",
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
  makesOffer: SERVICE_OFFERS.flatMap((offer) => {
    const itemOffered = {
      "@type": "Service",
      name: offer.name,
      description: offer.description,
    };

    if (offer.priceUsd !== null) {
      return [{
        "@type": "Offer",
        itemOffered,
        price: String(offer.priceUsd),
        priceCurrency: "USD",
      }];
    }

    if ("priceOptions" in offer && offer.priceOptions) {
      return offer.priceOptions.map((option) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: offer.name + " — " + option.name,
          description: offer.description,
        },
        price: String(option.priceUsd),
        priceCurrency: "USD",
      }));
    }

    return [{ "@type": "Offer", itemOffered, price: undefined, priceCurrency: undefined }];
  }),
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