// The bar rules, written once and shown on every path that offers a bar crew
// (weddings, corporate events, private parties). Owner directive 2026-11-01:
// split the site into three paths and tell each one plainly how the bar works
// and what the law asks. The standing rule underneath all three (CLAUDE.md
// §9.2): serve-only. The host or the venue provides the alcohol; we never sell
// it or supply it. Every line here is a rule we follow or a fact already on
// record (Nic's ATC permit); nothing is a legal opinion, and the agreement in
// lib/contract.ts carries the binding wording.

type Path = "wedding" | "corporate" | "party";

const COMMON = [
  "You or your venue provide the alcohol. We never sell it or supply it. We staff the bar, pour, and take care of your guests.",
  "Our bartenders hold current Indiana Alcohol and Tobacco Commission (ATC) employee permits, and our lead bartender has about twenty years behind the bar.",
  "At a venue with its own alcohol permit, we work under that permit and follow the venue's rules, alongside their team.",
  "We check IDs and serve guests 21 and over only. We won't serve anyone who is visibly intoxicated, and we handle that guest quietly instead of making a scene.",
];

const BY_PATH: Record<Path, string[]> = {
  wedding: [
    "On private property, a host serving their own guests is how the rules are meant to work. We pour on your behalf.",
  ],
  corporate: [
    "The company provides the bar for its own people. If the venue wants to run a cash bar, that runs on the venue's permit, not ours.",
    "We'll match your policy on drink tickets, last call, and a hard stop for the bar.",
  ],
  party: [
    "A party at your house or a rented hall works the same as a backyard wedding: it's your alcohol, served free to your own guests.",
    "No cash bar, no drink tickets for sale, and no cover charge that includes drinks. Charging guests for alcohol counts as selling it, and selling needs a permit.",
    "Costume party? Expect us to ask a masked guest to lift the mask for a second while we check their ID.",
  ],
};

export default function BarRules({ path, dark = false }: { path: Path; dark?: boolean }) {
  const lines = [...COMMON, ...BY_PATH[path]];
  return (
    <ul className={`space-y-4 ${dark ? "text-cream/80" : "text-ink/80"}`}>
      {lines.map((line) => (
        <li key={line} className="flex gap-3">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-terracotta" aria-hidden />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}
