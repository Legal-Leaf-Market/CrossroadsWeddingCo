function unsplash(id: string, params = "w=1600&q=80&auto=format&fit=crop") {
  return `https://images.unsplash.com/photo-${id}?${params}`;
}

export const IMAGES = {
  hero: unsplash("1522673607200-164d1b6ce486"),
  dj: unsplash("1470225620780-dba8ba36b745"),
  liveMusic: unsplash("1465495976277-4387d4b0b4c6"),
  bar: unsplash("1470337458703-46ad1756a187"),
  dayOf: unsplash("1546032996-6dfacbacbf3f"),
  about: unsplash("1519225421980-715cb0215aed"),
  contact: unsplash("1583939003579-730e3918a45a", "w=1800&q=70&auto=format&fit=crop"),
};
