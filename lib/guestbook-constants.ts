// Client-safe guestbook constants (the form and the moderation page share them).
export const GUESTBOOK_NAME_MAX = 80;
export const GUESTBOOK_MESSAGE_MAX = 2000;
export const GUESTBOOK_RELATIONS = [
  "Couple",
  "Wedding guest",
  "Event guest",
  "Venue",
  "Fellow vendor",
  "Corporate client",
  "Friend",
] as const;
