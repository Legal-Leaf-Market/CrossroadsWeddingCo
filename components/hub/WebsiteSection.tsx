"use client";

import { useEffect, useState } from "react";
import { hubInput, hubSave, SectionCard } from "./shared";
import SitePhotos from "./SitePhotos";
import { MAX_SITE_FAQ, MAX_SITE_LINKS, type SiteFaq, type SiteLink } from "@/lib/wedding-site-constants";

// The couple's public wedding website: on/off, their story, links, and answers
// to guest questions. Saved with a button rather than the autosave engine,
// because turning a public page on is a decision, not a keystroke.
export default function WebsiteSection({
  token,
  brandName,
  initial,
}: {
  token: string;
  brandName: string;
  initial: {
    enabled: boolean;
    slug: string | null;
    story: string;
    links: SiteLink[];
    faq: SiteFaq[];
    photos: { id: string }[];
    ownSiteUrl: string;
  };
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [slug, setSlug] = useState(initial.slug);
  const [story, setStory] = useState(initial.story);
  const [links, setLinks] = useState<SiteLink[]>(initial.links.length ? initial.links : [{ label: "", url: "" }]);
  const [faq, setFaq] = useState<SiteFaq[]>(initial.faq.length ? initial.faq : [{ q: "", a: "" }]);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [ownSite, setOwnSite] = useState(initial.ownSiteUrl);

  // The origin is only known in the browser; reading it during render would
  // make the server and client HTML disagree.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = slug ? `${origin}/w/${slug}` : "";

  async function save(nextEnabled = enabled) {
    setState("saving");
    setMsg("");
    const r = await hubSave(`/api/hub/${token}/site`, "PUT", { enabled: nextEnabled, story, links, faq });
    if (r.ok && ownSite.trim() !== initial.ownSiteUrl.trim()) {
      const d = await hubSave(`/api/hub/${token}/details`, "PATCH", { weddingSiteUrl: ownSite.trim() });
      if (!d.ok) {
        setState("error");
        setMsg(d.message ?? "Saved, but the outside site link didn't. Check the address.");
        return;
      }
    }
    if (!r.ok) {
      setState("error");
      setMsg(r.message ?? "Couldn't save. Check your connection and try again.");
      return;
    }
    const body = r.body as { slug?: string | null } | null;
    if (body?.slug) setSlug(body.slug);
    setEnabled(nextEnabled);
    setState("saved");
  }

  const badge =
    state === "saving" ? <span className="text-xs text-ink/50">Saving...</span> : state === "saved" ? <span className="text-xs text-ink/50">Saved</span> : null;

  return (
    <SectionCard
      title="Your wedding website"
      subtitle={`A free wedding website from ${brandName}, instead of Zola, The Knot or WeddingWire: your engagement photos, names, date, a map to the venue, the schedule you built above, your story, registry and answers to the questions guests ask. Nothing is public until you turn it on.`}
      badge={badge}
    >
      <div className="rounded-xl border border-parchment bg-cream/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-charcoal">{enabled ? `You're using the ${brandName} wedding website. It's live.` : `Use the ${brandName} wedding website? It's off, so guests can't see anything yet.`}</p>
          <button
            type="button"
            onClick={() => save(!enabled)}
            disabled={state === "saving"}
            className={
              enabled
                ? "rounded-full border border-parchment px-4 py-2 text-sm font-semibold text-ink/70 hover:border-terracotta disabled:opacity-60"
                : "rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
            }
          >
            {enabled ? "Turn it off" : "Yes, turn it on"}
          </button>
        </div>
        {enabled && slug && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <a href={`/w/${slug}`} target="_blank" rel="noreferrer" className="break-all font-semibold text-terracotta underline underline-offset-2">
              {url || `/w/${slug}`}
            </a>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  window.prompt("Copy this link:", url);
                }
              }}
              className="rounded-full border border-parchment px-3 py-1 text-xs font-semibold text-ink/70 hover:border-terracotta"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        )}
      </div>

      <SitePhotos token={token} initial={initial.photos} />

      <label className="mt-5 grid gap-1 text-sm font-semibold text-charcoal">
        Your story <span className="font-normal text-ink/55">(optional: how you met, the proposal, anything you want guests to know)</span>
        <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={5} maxLength={3000} className={hubInput} />
      </label>

      <div className="mt-5">
        <p className="text-sm font-semibold text-charcoal">Links</p>
        <p className="text-sm text-ink/60">Registry, hotel block, RSVP, anything with a web address.</p>
        <div className="mt-2 space-y-2">
          {links.map((l, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <input aria-label="Link name" placeholder="Registry" value={l.label} maxLength={80} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className={hubInput} />
              <input aria-label="Web address" placeholder="https://" value={l.url} maxLength={500} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} className={hubInput} />
              <button type="button" onClick={() => setLinks(links.filter((_, j) => j !== i))} className="text-sm text-ink/50 hover:text-terracotta" aria-label="Remove link">
                Remove
              </button>
            </div>
          ))}
        </div>
        {links.length < MAX_SITE_LINKS && (
          <button type="button" onClick={() => setLinks([...links, { label: "", url: "" }])} className="mt-2 text-sm font-semibold text-terracotta">
            + Add a link
          </button>
        )}
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-charcoal">Questions guests ask</p>
        <div className="mt-2 space-y-3">
          {faq.map((f, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-parchment p-3">
              <input aria-label="Question" placeholder="Is there parking?" value={f.q} maxLength={200} onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} className={hubInput} />
              <textarea aria-label="Answer" placeholder="Your answer" value={f.a} maxLength={1500} rows={2} onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} className={hubInput} />
              <button type="button" onClick={() => setFaq(faq.filter((_, j) => j !== i))} className="justify-self-start text-sm text-ink/50 hover:text-terracotta">
                Remove
              </button>
            </div>
          ))}
        </div>
        {faq.length < MAX_SITE_FAQ && (
          <button type="button" onClick={() => setFaq([...faq, { q: "", a: "" }])} className="mt-2 text-sm font-semibold text-terracotta">
            + Add a question
          </button>
        )}
      </div>

      <label className="mt-5 grid gap-1 text-sm font-semibold text-charcoal">
        Already have a site on Zola, The Knot or WeddingWire? <span className="font-normal text-ink/55">(optional: we link to it from your page)</span>
        <input value={ownSite} onChange={(e) => setOwnSite(e.target.value)} maxLength={500} placeholder="https://" className={hubInput} />
      </label>

      {msg && (
        <p className="mt-4 text-sm font-semibold text-terracotta-dark" role="alert">
          {msg}
        </p>
      )}
      <button
        type="button"
        onClick={() => save()}
        disabled={state === "saving"}
        className="mt-5 rounded-full bg-charcoal px-5 py-2 text-sm font-semibold text-cream hover:bg-ink disabled:opacity-60"
      >
        Save website
      </button>
    </SectionCard>
  );
}
