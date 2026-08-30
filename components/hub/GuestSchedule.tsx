import SchedulePrintButton from "@/components/hub/SchedulePrintButton";
import { hhmmToMinutes, minutesToLabel } from "@/lib/live";
import { SITE_NAME } from "@/lib/site";

export type GuestScheduleItem = {
  id: string;
  title: string;
  /** HH:MM, 24-hour, as stored on the timeline. */
  startTime: string;
};

// Guest-facing order of events, rendered dark so it reads well as a phone
// screenshot, on a printed sign, or dropped into a story. Deliberately shows
// only what a guest needs: when a thing happens and what it is. The MC notes
// on the same timeline rows stay with the crew.
export default function GuestSchedule({
  coupleNames,
  eventDate,
  venueName,
  items,
}: {
  coupleNames: string;
  eventDate: string;
  venueName: string;
  items: GuestScheduleItem[];
}) {
  return (
    <div className="min-h-screen bg-[#0f0e0d] px-6 py-12 text-white print:bg-white print:text-black">
      <div className="mx-auto max-w-2xl">
        <div className="flex justify-end">
          <SchedulePrintButton />
        </div>

        <header className="text-center">
          <p className="text-[0.7rem] uppercase tracking-[0.35em] text-white/50 print:text-black/60">
            We&apos;re so glad you&apos;re here
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-[0.08em] sm:text-5xl">
            Order of Events
          </h1>
          <p className="mt-3 text-sm text-white/60 print:text-black/60">{coupleNames}</p>
          <p className="text-sm text-white/40 print:text-black/50">
            {eventDate} · {venueName}
          </p>
          <div className="mx-auto mt-7 h-px w-24 bg-white/25 print:bg-black/25" />
        </header>

        {items.length === 0 ? (
          <p className="mt-16 text-center text-sm text-white/50">
            The schedule is still being written. Check back soon.
          </p>
        ) : (
          <ol className="relative mt-12 pb-6">
            {/* The spine. Sits behind the rows, centred on wide screens and
                tucked to the left once the two-column layout collapses. */}
            <span
              aria-hidden
              className="absolute inset-y-0 left-[7px] w-px bg-white/20 sm:left-1/2 print:bg-black/20"
            />
            {items.map((item, index) => {
              const right = index % 2 === 1;
              return (
                <li
                  key={item.id}
                  className="relative flex items-start gap-4 pb-9 pl-8 last:pb-0 sm:gap-0 sm:pl-0"
                >
                  <span
                    aria-hidden
                    className="absolute left-0 top-[9px] h-[15px] w-[15px] rounded-full border border-white/40 bg-[#0f0e0d] sm:left-1/2 sm:-translate-x-1/2 print:border-black/40 print:bg-white"
                  />
                  <div
                    className={`sm:w-1/2 ${
                      right
                        ? "sm:order-2 sm:pl-10 sm:text-left"
                        : "sm:order-1 sm:pr-10 sm:text-right"
                    }`}
                  >
                    <p className="font-display text-2xl leading-none">
                      {minutesToLabel(hhmmToMinutes(item.startTime))}
                    </p>
                    <p className="mt-1.5 text-sm uppercase tracking-[0.18em] text-white/70 print:text-black/70">
                      {item.title}
                    </p>
                  </div>
                  <span className={`hidden sm:block sm:w-1/2 ${right ? "sm:order-1" : "sm:order-2"}`} />
                </li>
              );
            })}
          </ol>
        )}

        <p className="mt-10 text-center text-[0.65rem] uppercase tracking-[0.25em] text-white/30 print:text-black/40">
          {SITE_NAME}
        </p>
      </div>
    </div>
  );
}
