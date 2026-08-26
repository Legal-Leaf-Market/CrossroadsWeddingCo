import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrintButton from "@/components/hub/PrintButton";
import { SITE_NAME } from "@/lib/site";

// Dev-only layout preview of the printable run sheet with sample data.
// Returns 404 in production builds; the real page lives at /hub/[token]/runsheet.
export const metadata: Metadata = {
  title: "Run sheet preview",
  robots: { index: false, follow: false },
};

const TIMELINE = [
  { time: "4:00 PM", title: "Guests arrive, prelude music", notes: "", minutes: 30 },
  { time: "4:30 PM", title: "Processional", notes: "", minutes: 5 },
  { time: "4:35 PM", title: "Ceremony", notes: "", minutes: 25 },
  { time: "5:00 PM", title: "Cocktail hour", notes: "Acoustic set on the patio", minutes: 60 },
  { time: "6:00 PM", title: "Grand entrance", notes: "Introduce the wedding party in roster order", minutes: 10 },
  { time: "6:10 PM", title: "Dinner", notes: "", minutes: 50 },
  { time: "7:00 PM", title: "Speeches and toasts", notes: "Best man first, then maid of honor", minutes: 20 },
  { time: "7:20 PM", title: "First dance", notes: "", minutes: 5 },
  { time: "7:25 PM", title: "Open dance floor", notes: "", minutes: 150 },
  { time: "9:55 PM", title: "Last song and send-off", notes: "Sparkler exit, line up at 9:50", minutes: 5 },
];

export default function RunSheetPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="min-h-screen bg-white p-8 text-charcoal print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between print:hidden">
          <span className="text-sm font-semibold text-terracotta">Back to your hub</span>
          <PrintButton />
        </div>

        <header className="mt-4 border-b-2 border-charcoal pb-3">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-bold">Jordan Hayes &amp; Taylor Morgan</h1>
            <span className="text-sm font-semibold">{SITE_NAME}</span>
          </div>
          <p className="mt-1 text-sm">
            Saturday, June 12, 2027 · The Sycamore Barn · 4280 County Road 325 N, Columbus, IN 47203
          </p>
        </header>

        <section className="mt-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-terracotta">Run of show</h2>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {TIMELINE.map((item) => (
                <tr key={item.title} className="border-b border-parchment align-top">
                  <td className="w-20 py-1.5 pr-3 font-semibold whitespace-nowrap">{item.time}</td>
                  <td className="py-1.5 pr-3">
                    <span className="font-semibold">{item.title}</span>
                    {item.notes && <span className="block text-ink/60">{item.notes}</span>}
                  </td>
                  <td className="w-16 py-1.5 text-right text-ink/50 whitespace-nowrap">
                    {item.minutes} min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-terracotta">Key tracks</h2>
            <ul className="mt-2 space-y-1 text-sm">
              <li>
                <span className="font-semibold">Processional:</span> Can&apos;t Help Falling in Love,
                Kina Grannis (live)
              </li>
              <li>
                <span className="font-semibold">First dance:</span> Lover, Taylor Swift
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-terracotta">
              Names and pronunciations
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              <li>
                <span className="font-semibold">Maid of Honor:</span> Siobhan Nguyen (shi-VAWN NWIN)
              </li>
              <li>
                <span className="font-semibold">Best Man:</span> Marcus Hayes (MAR-kus HAYZ)
              </li>
            </ul>
          </section>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-terracotta">Must play</h2>
            <ul className="mt-2 space-y-0.5 text-sm">
              <li>September, Earth, Wind &amp; Fire</li>
              <li>Mr. Brightside, The Killers</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-terracotta">Do not play</h2>
            <ul className="mt-2 space-y-0.5 text-sm">
              <li>Chicken Dance</li>
            </ul>
          </section>
        </div>

        <footer className="mt-6 border-t border-parchment pt-2 text-xs text-ink/50">
          Day-of contact: (812) 555-0142 · {SITE_NAME} · jake@crossroadsweddingco.com
        </footer>
      </div>
    </div>
  );
}
