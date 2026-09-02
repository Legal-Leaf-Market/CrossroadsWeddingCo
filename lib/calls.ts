// In-hub calls, on Daily.co.
//
// One call type, not two. There is no "video call" and no "voice call" in this
// product: you join a call and your camera is a toggle that starts off. That is
// why every room is created with start_video_off and start_audio_off false, and
// why nothing in the UI branches on which kind of call it is.
//
// Daily rather than Google Meet because Meet cannot be embedded: it sends
// frame-ancestors headers, so an iframe renders nothing, and its only embedding
// product puts your app inside Meet rather than the reverse. Daily renders in
// the page and guests join by typing a name, with no account. A couple's parent
// hitting a Google sign-in wall is the exact failure the hub exists to avoid.
//
// Everything fails closed until DAILY_API_KEY exists (free tier at daily.co is
// 10,000 participant-minutes a month, roughly seventy 45-minute three-person
// calls). With no key, isCallsConfigured() is false and the hub renders no call
// UI at all rather than a dead "Join call" button, matching how the Spotify and
// Stripe integrations behave.
//
// No recording, deliberately. Recorded audio of a couple is data with a
// retention obligation and, in a two-party-consent state, a consent question.
// If it is ever wanted it should be a decision, not a default that shipped
// because Daily offers it.

const API = "https://api.daily.co/v1";

/** Rooms live this long past creation before Daily deletes them. */
const ROOM_TTL_SECONDS = 60 * 60 * 12;
/** A join token is good for one sitting, not for forwarding to a friend. */
const TOKEN_TTL_SECONDS = 60 * 60 * 4;

export function isCallsConfigured(): boolean {
  return Boolean(process.env.DAILY_API_KEY);
}

export type CallSession = {
  /** Full https://<domain>.daily.co/<room> URL the client hands to daily-js. */
  roomUrl: string;
  /** Meeting token. Rooms are private, so this is what actually admits anyone. */
  token: string;
};

/**
 * Daily room names allow letters, digits, dash and underscore. Wedding ids are
 * UUIDs, so strip the dashes: "w" plus 32 hex is 33 characters, comfortably
 * inside Daily's limit, stable per wedding, and reveals nothing on its own
 * because the room is private and needs a minted token to enter.
 */
export function roomNameForWedding(weddingId: string): string {
  return `w${weddingId.replace(/-/g, "").toLowerCase()}`;
}

async function daily(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

/**
 * Create the wedding's room, or return the existing one. Daily answers a
 * duplicate name with 400, which is the expected path on every call after the
 * first, so it is handled rather than logged as a failure.
 */
async function ensureRoom(roomName: string): Promise<boolean> {
  const create = await daily("/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: roomName,
      privacy: "private",
      properties: {
        exp: Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS,
        eject_at_room_exp: true,
        // The camera starts off and stays the participant's choice.
        start_video_off: true,
        start_audio_off: false,
        enable_screenshare: true,
        enable_chat: false,
      },
    }),
  });
  if (create.ok) return true;

  if (create.status === 400) {
    // Already exists is the normal case, but a 400 can also mean a malformed
    // request, so confirm the room is really there before claiming success.
    const existing = await daily(`/rooms/${roomName}`);
    if (existing.ok) return true;
  }

  console.error(`[calls] could not ensure room ${roomName}: ${create.status} ${await create.text()}`);
  return false;
}

/**
 * Mint a session for one participant. `isOwner` gives the team member meeting
 * controls the couple does not get. `userName` is what everyone else sees, and
 * it is the only identity a guest needs: no account, no login.
 */
export async function createCallSession(
  weddingId: string,
  userName: string,
  isOwner: boolean,
): Promise<CallSession | null> {
  if (!isCallsConfigured()) return null;

  const roomName = roomNameForWedding(weddingId);
  if (!(await ensureRoom(roomName))) return null;

  const res = await daily("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName.slice(0, 60) || "Guest",
        is_owner: isOwner,
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
        start_video_off: true,
      },
    }),
  });

  if (!res.ok) {
    console.error(`[calls] token mint failed for ${roomName}: ${res.status} ${await res.text()}`);
    return null;
  }

  const { token } = (await res.json()) as { token?: string };
  if (!token) {
    console.error(`[calls] token mint returned no token for ${roomName}`);
    return null;
  }

  const domain = process.env.DAILY_DOMAIN;
  if (!domain) {
    console.error("[calls] DAILY_DOMAIN is unset, cannot build a room URL");
    return null;
  }

  return { roomUrl: `https://${domain}/${roomName}`, token };
}
