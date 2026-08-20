function unsplash(id: string, params = "w=1600&q=80&auto=format&fit=crop") {
  return `https://images.unsplash.com/photo-${id}?${params}`;
}

// stringLights does double duty: full-colour on the Wedding DJ service card,
// and as the near-invisible backdrop behind the contact section (30% opacity
// under a heavy gradient). Swap the card to its own photo when there's one.
export const IMAGES = {
  dancing: unsplash("1470225620780-dba8ba36b745"),
  liveMusic: unsplash("1465495976277-4387d4b0b4c6"),
  bar: unsplash("1470337458703-46ad1756a187"),
  dayOf: unsplash("1546032996-6dfacbacbf3f"),
  about: unsplash("1519225421980-715cb0215aed"),
  stringLights: unsplash("1583939003579-730e3918a45a", "w=1800&q=70&auto=format&fit=crop"),
  galleryRings: unsplash("1519741497674-611481863552", "w=900&q=80&auto=format&fit=crop"),
  galleryTable: unsplash("1511285560929-80b456fea0bc", "w=900&q=80&auto=format&fit=crop"),
  galleryArch: unsplash("1519671482749-fd09be7ccebf", "w=900&q=80&auto=format&fit=crop"),
};
