// The people on the platform's public pages, and the one place their names,
// titles and scopes are written down. lib/schedulers.ts reads this file rather
// than repeating any of it, so a title cannot say one thing on the team section
// and another on the page a QR code opens.
//
// Photos are still coming (Adam at WeddingPro asked for them too); until then
// cards render brand-styled initials, which is why photoUrl is optional and why
// a missing one costs nothing.
//
// TITLES ARE THE ONES ON THE PRINTED BUSINESS CARDS, and that is a deliberate
// correction rather than a rewrite. The page had Jake and Nic as CEO and COO,
// which are their titles at the holding company, not their jobs at a wedding;
// it also gave Nic "Acoustic sets - Bar" with no DJ or MC on it, while the card
// in a couple's hand says he does both. Both DJ and MC. What differs is the
// last item, which is why every roles line here reads the same until it does not.
//
// BRAYTON AND ASHTON WERE REMOVED 2026-10-06 (owner directive: "it's just Jake
// and Nic for now"). Their slugs stay reserved in lib/schedulers.ts because
// they are printed on business cards; see the note there. Restoring either one
// means putting their entry back here and nothing else.
//
// BIOS ARE ROLE, NOT BIOGRAPHY. Nic's is the only one carrying a hard claim
// (about twenty years, a current Indiana ATC permit) because it is the only one
// anybody has stated. Nothing here invents an experience, a credential or a
// number, and nothing should: this section is the one couples read to decide
// whether to trust four strangers with their wedding.

export type TeamMember = {
  /** Also the QR-code slug on this person's business card. See lib/schedulers.ts. */
  slug: string;
  name: string;
  title: string;
  roles: string;
  bio: string;
  initials: string;
  photoUrl?: string;
};

export const TEAM: TeamMember[] = [
  {
    slug: "jake",
    name: "Jake",
    title: "Co-founder & Event Producer",
    roles: "DJ · MC · Acoustic",
    bio: "The voice on the mic and the one watching the clock. Jake runs your sound from the processional to the last song, calls the cues so your wedding party is always where it needs to be, and keeps the whole day moving without anyone noticing he's doing it.",
    initials: "J",
  },
  {
    slug: "nic",
    name: "Nic",
    title: "Co-founder & Event Manager",
    roles: "DJ · MC · Acoustic · Bar",
    bio: "The live music and the steady hand behind the bar. Nic plays the solo acoustic sets, singer-songwriter style, and brings about twenty years of serving and bartending, with a current Indiana ATC permit. When we say licensed bartenders, he's who we mean.",
    initials: "N",
  },
];

export function findTeamMember(slug: string): TeamMember | null {
  return TEAM.find((m) => m.slug === slug) ?? null;
}
