import { adminKeyMatches } from "@/lib/admin";
import { PLAYBOOK_HTML } from "@/lib/playbook-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Crossroads lead playbook (call list, scripts), for partners signed in to
// a different claude.ai account than the one that owns the artifact. Same gate
// as the rest of /admin: a wrong key 404s. This copy saves to the site's own
// call log (/api/admin/[key]/playbook); the page finds it through
// window.CR_PLAYBOOK_API.
// Edit content/playbook/crossroads-playbook.html, then run
// `node scripts/build-playbook.mjs`.
export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!adminKeyMatches(key)) return new Response("Not found", { status: 404 });
  const page =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">' +
    "<script>window.CR_PLAYBOOK_API=" +
    JSON.stringify(`/api/admin/${encodeURIComponent(key)}/playbook`).replace(/</g, "\\u003c") +
    "</script></head><body>" +
    PLAYBOOK_HTML +
    "</body></html>";
  return new Response(page, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
