import { CONTACT_EMAIL, SERVICE_OFFERS, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

// schema.org LocalBusiness describing the business and what it sells. Once a
// service area or mailing address is settled, add `areaServed` / `address`
// here — Google leans on both for local results.
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
  makesOffer: SERVICE_OFFERS.map((offer) => ({
    "@type": "Offer",
    itemOffered: {
      "@type": "Service",
      name: offer.name,
      description: offer.description,
    },
    ...(offer.priceUsd === null
      ? {}
      : { price: String(offer.priceUsd), priceCurrency: "USD" }),
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
