import SafeImage from "@/components/SafeImage";
import { TEAM } from "@/lib/team";

// Who-you-get profile cards. Couples book people, not packages; WeddingPro's
// own advice (Adam, 2026-08-28) is that faces build confidence. Cards fall
// back to brand-styled initials until real photos land in lib/team.ts.
export default function Team() {
  return (
    <section id="team" className="border-t border-parchment bg-cream py-20">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center text-3xl text-charcoal">Who you get</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-ink/70">
          No rotating roster of strangers. When you book Crossroads, these are
          the people at your wedding.
        </p>
        <div className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
          {TEAM.map((m) => (
            <div key={m.slug} className="rounded-2xl border border-parchment bg-white p-6 text-center">
              {m.photoUrl ? (
                <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-full">
                  <SafeImage src={m.photoUrl} alt={m.name} fill sizes="112px" className="object-cover" />
                </div>
              ) : (
                <div
                  aria-hidden
                  className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-terracotta text-5xl text-cream"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {m.initials}
                </div>
              )}
              <h3 className="mt-4 text-xl text-charcoal">{m.name}</h3>
              <p className="text-sm font-semibold text-terracotta">{m.title}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-ink/50">{m.roles}</p>
              <p className="mt-3 text-sm text-ink/70">{m.bio}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
