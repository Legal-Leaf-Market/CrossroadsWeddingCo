import { NextResponse, type NextRequest } from "next/server";
import { cleanSrcTag } from "@/lib/lead-sources";

// crossroadsweddingco.shop/tv: the address read out and shown at the end of a
// Roku or Hulu spot (plan: docs/GET_OFF_WEDDINGPRO.md). Nobody clicks a TV ad,
// they type what they saw, so the address has to be short and say nothing
// else. It lands on the homepage carrying ?src=tv, which SourceCapture
// remembers so the booking still counts for the ad days later.
//
// A campaign can be told apart with /tv?src=roku-nov; anything that is not a
// tv/roku/hulu tag is ignored so this door can only ever claim TV.
export function GET(req: NextRequest) {
  const asked = cleanSrcTag(req.nextUrl.searchParams.get("src"));
  const tag = asked && /^(tv|roku|hulu)([-_]|$)/.test(asked) ? asked : "tv";
  const url = new URL("/", req.nextUrl.origin);
  url.searchParams.set("src", tag);
  // 307 rather than 308: a permanent redirect gets cached by browsers, and the
  // destination may change per campaign.
  return NextResponse.redirect(url, 307);
}
