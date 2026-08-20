import SafeImage from "@/components/SafeImage";
import { IMAGES } from "@/lib/images";

const GALLERY = [
  { src: IMAGES.galleryRings, alt: "Wedding rings resting on flower petals" },
  { src: IMAGES.galleryTable, alt: "Candlelit reception table decor detail" },
  { src: IMAGES.djBooth, alt: "DJ decks set up for a wedding reception" },
];

export default function Gallery() {
  return (
    <section className="bg-cream py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {GALLERY.map((img) => (
            <div key={img.src} className="relative h-56 overflow-hidden rounded-2xl sm:h-64">
              <SafeImage
                src={img.src}
                alt={img.alt}
                fill
                sizes="(min-width: 640px) 33vw, 100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
