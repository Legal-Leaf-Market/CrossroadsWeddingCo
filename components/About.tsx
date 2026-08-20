import SafeImage from "@/components/SafeImage";
import { IMAGES } from "@/lib/images";

export default function About() {
  return (
    <section id="about" className="border-t border-parchment bg-parchment/40 py-20">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 md:grid-cols-2 md:items-center">
        <div className="relative order-2 h-80 overflow-hidden rounded-2xl md:order-1 md:h-full md:min-h-[420px]">
          <SafeImage
            src={IMAGES.about}
            alt="Just-married couple walking hand in hand outdoors"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="order-1 md:order-2">
          <h2 className="text-3xl text-charcoal">
            Why couples call us the coordinator
          </h2>
          <div className="mt-6 space-y-4 text-ink/80">
            <p>
              We started out just DJing. Somewhere along the way, we became
              the people couples handed their whole schedule to — because
              someone has to call the cues, and it's easier to trust the
              person already holding the microphone.
            </p>
            <p>
              We're not a full wedding-planning service, and we won't pretend
              to be. But on the day itself, give us your names, your
              timeline, and your must-plays and must-nots — we'll run the
              room so you don't have to think about it.
            </p>
            <p>
              We work as comfortably in a backyard with a rented tent and
              string lights as we do in a formal venue. If your wedding leans
              indie folk, DIY, or a little unconventional, that's exactly the
              room we like best.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
