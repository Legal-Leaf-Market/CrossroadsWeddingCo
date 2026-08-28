// The people on the platform's public pages. Photos are coming (Adam at
// WeddingPro asked for them too); until then cards render brand-styled
// initials. Brayton (spelling unconfirmed) joins as CBO once Jacob confirms
// the plan with Nic: add his entry here and he appears everywhere at once.
// See CLAUDE.md §9.2.

export type TeamMember = {
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
    title: "Co-founder & CEO",
    roles: "DJ · MC · Day-of",
    bio: "The voice on the mic and the one watching the clock. Jake runs your sound from the processional to the last song, calls the cues so your wedding party is always where it needs to be, and keeps the whole day moving without anyone noticing he's doing it.",
    initials: "J",
  },
  {
    slug: "nic",
    name: "Nic",
    title: "Co-founder & COO",
    roles: "Acoustic sets · Bar",
    bio: "The live music and the steady hand behind the bar. Nic plays the solo acoustic sets, singer-songwriter style, and brings about twenty years of serving and bartending, with a current Indiana ATC permit. When we say licensed bartenders, he's who we mean.",
    initials: "N",
  },
];
