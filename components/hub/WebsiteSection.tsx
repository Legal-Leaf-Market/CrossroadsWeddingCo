"use client";

import { useEffect, useState } from "react";
import { hubInput, hubSave, SectionCard } from "./shared";
import { MAX_SITE_FAQ, MAX_SITE_LINKS, type SiteFaq, type SiteLink } from "@/lib/wedding-site-constants";

// The couple's public wedding website: on/off, their story, links, and answers
// to guest questions. Saved with a button rather than the autosave engine,
// because turning a public page on is a decision, not a keystroke.
export default function WebsiteSection({
  token,
  initial,
}: {
  token: string;
  initial: { enabled: boolean; slug: string | null; story: string; links: SiteLink[]; faq: SiteFaq[] };
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [slug, setSlug] = useState(initial.slug);
  const [story, setStory] = useState(initial.story);
  const [links, setLinks] = useState<SiteLink[]>(initial.links.length ? initial.links : [{ label: "", url: "" }]);
  const [faq, setFaq] = useState<SiteFaq[]>(initial.faq.length ? initial.faq : [{ q: "", a: "" }]);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  // The origin is only known in the browser; reading it during render would
  // make the server and client HTML disagree.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = slug ? `${origin}/w/${slug}` : "";

  async function save(nextEnabled = enabled) {
    setState("saving");
    setMsg("");
    const r = await hubSave(`/api/hub/${token}/site`, "PUT", { enabled: nextEnabled, story, links, faq });
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
      title="Your page for guests"
      subtitle="One link to send guests: your names, date and venue, the schedule you built above, plus your story, registry and answers to the questions everyone asks. Off until you turn it on. Already have a site elsewhere? Keep its link in Details and we point to it here."
      badge={badge}
    >
      <div className="rounded-xl border border-parchment bg-cream/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-charcoal">{enabled ? "Your guest page is on." : "Your guest page is off. Guests can't see anything."}</p>
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
            {enabled ? "Turn it off" : "Turn it on"}
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
        Save guest page
      </button>
    </SectionCard>
  );
}
