// The service area: home base plus everything within about two hours.
// Each entry gets genuinely distinct copy — these pages exist for couples
// searching "wedding dj <city>", and near-duplicate doorway pages get
// filtered by Google and read as spam by humans.

export type City = {
  /** Venue is past ~60 min of Columbus — travel surcharge applies. */
  hasTravelSurcharge?: boolean;
  stateSlug: string;
  citySlug: string;
  name: string;
  stateAbbr: string;
  stateName: string;
  isHomeBase?: boolean;
  headline: string;
  intro: string;
  localNotes: string[];
  travelNote: string;
};

export const CITIES: City[] = [
  {
    stateSlug: "in",
    citySlug: "columbus",
    name: "Columbus",
    stateAbbr: "IN",
    stateName: "Indiana",
    isHomeBase: true,
    headline: "Wedding DJ in Columbus, Indiana",
    intro:
      "Columbus is our home base. When your wedding is here, you're getting the crew with no drive time, no travel logistics, and a soft spot for the town that architecture nerds cross oceans to see.",
    localNotes: [
      "Backyard weddings across Bartholomew County are exactly what we build for — sound planned for open air, not a ballroom rig pointed at a fence.",
      "Barn and farm venues around Columbus usually mean we're the only vendor on site running a schedule. We're comfortable being that person.",
      "Downtown or park ceremony? We plan compact, generator-free sound for spots where power is a rumor.",
    ],
    travelNote: "Zero travel distance. Same flat rate as everywhere else.",
  },
  {
    stateSlug: "in",
    citySlug: "indianapolis",
    name: "Indianapolis",
    stateAbbr: "IN",
    stateName: "Indiana",
    headline: "Wedding DJ in Indianapolis",
    intro:
      "Indy weddings tend to come with Indy pricing. Ours doesn't change: the same flat $1,000 day rate we charge at home covers your downtown loft, your industrial venue, or your backyard on the south side.",
    localNotes: [
      "Industrial and loft venues love exposed brick and hate echo. We tune for the room, not just the playlist.",
      "City venues run tight schedules with hard cut-offs — our day-of timeline coordination exists for exactly this.",
      "Got a rooftop or courtyard ceremony plus an indoor reception? One crew, two setups, no handoff chaos.",
    ],
    travelNote: "About 45 minutes from our Columbus base. No travel fee — the rate is the rate.",
  },
  {
    stateSlug: "in",
    citySlug: "bloomington",
    name: "Bloomington",
    stateAbbr: "IN",
    stateName: "Indiana",
    headline: "Wedding DJ in Bloomington, Indiana",
    intro:
      "College town, wooded hills, and some of the prettiest DIY venues in the state. Bloomington weddings lean exactly the direction we lean: a little indie, a little unconventional, heavy on string lights.",
    localNotes: [
      "Wooded and lakeside venues around Monroe County often have zero infrastructure. We plan for that from the start: sound, power, backup gear — all on us.",
      "IU crowd on the guest list? We read the room between generations — the dance floor stays full without anyone's grandmother fleeing.",
      "Brewery and warehouse receptions downtown get the same treatment as a ballroom: clean sound, tight transitions, zero dead air.",
    ],
    travelNote: "Around 40 minutes from Columbus. No travel fee.",
  },
  {
    stateSlug: "in",
    citySlug: "nashville",
    name: "Nashville",
    stateAbbr: "IN",
    stateName: "Indiana",
    headline: "Wedding DJ in Nashville, Indiana (Brown County)",
    intro:
      "Yes, the Indiana one. Brown County is one of the Midwest's great wedding destinations — cabins, ridgelines, and October leaves that do half your decorating for you. We're thirty minutes away.",
    localNotes: [
      "Hillside and cabin venues mean winding load-ins and no house sound. We scout the setup ahead of your day instead of discovering it at 3 PM.",
      "A live acoustic set fits Brown County like it was invented here — guitar for the ceremony in the trees, decks for the reception in the barn. Flat $400 to add it.",
      "Fall wedding? We plan around early sunsets and cold snaps: lighting, blankets-hour playlists, and a timeline that gets your golden-hour photos in.",
    ],
    travelNote: "About 30 minutes from Columbus. No travel fee.",
  },
  {
    stateSlug: "ky",
    citySlug: "louisville",
    name: "Louisville",
    stateAbbr: "KY",
    stateName: "Kentucky",
    headline: "Wedding DJ in Louisville, Kentucky",
    intro:
      "Crossing the river doesn't change the number. Louisville couples get the same flat-rate DJ, MC, and day-of coordination we run in Indiana — bourbon-country venue or backyard in the Highlands.",
    localNotes: [
      "Distillery and warehouse venues have gorgeous acoustics problems. We bring the gear and the patience to solve them.",
      "Kentucky wedding timelines love a long cocktail hour. Add our acoustic set and it stops being the part guests endure and starts being the part they remember.",
      "Old Louisville mansions and garden venues: compact setups, discreet cabling, nothing taped across a marble floor.",
    ],
    hasTravelSurcharge: true,
    travelNote:
      "About an hour and a quarter from Columbus. Venues past the one-hour mark carry a $100–$150 travel surcharge — quoted up front, and it goes directly to the crew driving.",
  },
  {
    stateSlug: "oh",
    citySlug: "cincinnati",
    name: "Cincinnati",
    stateAbbr: "OH",
    stateName: "Ohio",
    headline: "Wedding DJ in Cincinnati, Ohio",
    intro:
      "Cincinnati sits right at the edge of our two-hour radius, and it's worth the drive: OTR event halls, river views, and Northern Kentucky venues that count as Cincinnati in every way that matters.",
    localNotes: [
      "Historic halls in Over-the-Rhine reward a DJ who does sound-check like it matters. It matters.",
      "Riverfront ceremonies fight barge horns and wind. We build ceremony sound for outdoor audio that guests in the back row actually hear.",
      "Northern Kentucky venues — Covington, Newport — are absolutely in range. The state line is not a surcharge.",
    ],
    hasTravelSurcharge: true,
    travelNote:
      "Just under two hours from Columbus — the edge of our range. A $100–$150 travel surcharge applies, quoted up front, paid directly to the crew driving.",
  },
];

export function getCity(stateSlug: string, citySlug: string): City | undefined {
  return CITIES.find((c) => c.stateSlug === stateSlug && c.citySlug === citySlug);
}

export function cityPath(c: City): string {
  return `/${c.stateSlug}/${c.citySlug}/wedding-dj`;
}
