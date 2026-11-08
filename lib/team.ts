// The people on the platform's public pages, and the one place their names,
// titles and scopes are written down. lib/schedulers.ts reads this file rather
// than repeating any of it, so a title cannot say one thing on the team section
// and another on the page a QR code opens.
//
// Photos are still coming (Adam at WeddingPro asked for them too); until then
// cards render brand-styled initials, which is why photoUrl is optional and why
// a missing one costs nothing.
//
// (HISTORY) TITLES WERE THE ONES ON THE PRINTED BUSINESS CARDS, and that is a deliberate
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
  /** The officer title at the company (CEO, COO, CBO). Owner-stated 2026-11-08. */
  executiveTitle: string;
  /** What this person does at an event. Printed under the officer title. */
  title: string;
  roles: string;
  bio: string;
  initials: string;
  photoUrl?: string;
  /**
   * False keeps someone bookable for intro calls (lib/schedulers.ts) without
   * putting them on the public "Who you get" section, for a partner who sells
   * but whose title, roles and bio the owner has not yet written.
   */
  showOnTeam?: boolean;
};

// THREE PARTNERS, TWO TITLES EACH (2026-11-08, Jacob: "it's now me, Nic and
// Terry", and "put our white collar titles as well as the roles that we play").
// executiveTitle is the officer title, which reads as a real company to the
// corporate and events side; title and roles are what each person does on the
// day, which is what a couple is actually booking. Both are shown, officer
// title first. Terry's surname is Winchester; first names only on the site,
// matching Jake and Nic. Terry's bio carries only what Jacob stated (event
// promotion and execution experience, the go-to guy) and no number.
export const TEAM: TeamMember[] = [
  {
    slug: "jake",
    name: "Jake",
    executiveTitle: "Chief Executive Officer",
    title: "Event Producer",
    roles: "DJ · MC · Acoustic",
    bio: "Jake sets the direction for Crossroads and is the voice on the mic at your event. He runs your sound from the first song to the last, calls the cues so everyone is where they need to be, and keeps the whole day moving without anyone noticing he's doing it.",
    initials: "J",
  },
  {
    slug: "nic",
    name: "Nic",
    executiveTitle: "Chief Operating Officer",
    title: "Event Manager",
    roles: "DJ · MC · Acoustic · Bar",
    bio: "Nic keeps the operation running, from the schedule to the gear to the crew, and he's the live music and the steady hand behind the bar. He plays the solo acoustic sets, singer-songwriter style, and brings about twenty years of serving and bartending, with a current Indiana ATC permit. When we say licensed bartenders, he's who we mean.",
    initials: "N",
  },
  {
    // TERRY (bookable since 2026-11-01; titles, roles and bio from Jacob
    // 2026-11-08, so he is on the public team section now).
    slug: "terry",
    name: "Terry",
    executiveTitle: "Chief Business Officer",
    title: "Stage Manager",
    roles: "DJ · Bar · Stage Management",
    bio: "Terry brings tons of experience in event promotion and execution, and he's our go-to guy on just about everything. He DJs, works the bar, and runs the stage, so the room, the crew and the timing all come together the way they should.",
    initials: "T",
  },
];

/** The people shown in the public "Who you get" section. */
export const PUBLIC_TEAM: TeamMember[] = TEAM.filter((m) => m.showOnTeam !== false);

export function findTeamMember(slug: string): TeamMember | null {
  return TEAM.find((m) => m.slug === slug) ?? null;
}
