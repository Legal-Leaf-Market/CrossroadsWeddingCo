"use client";

import { useEffect, useMemo, useState } from "react";
import { AUDIENCES, BROCHURES, shareImageUrl, shareUrl, type BrochureKind } from "@/lib/brochures";

// "Who's it for?" sharing. Picking a person picks the brochure that fits them
// and a message written for them; every channel below sends that message and
// a link tagged ?src=share-<who>, so a booking from a forwarded brochure is
// counted. Nothing here posts on the visitor's behalf: each button opens the
// visitor's own app or the network's share page.
export default function ShareKit({ kind }: { kind: BrochureKind | "all" }) {
  const options = useMemo(
    () => (kind === "all" ? AUDIENCES : AUDIENCES.filter((a) => a.kind === kind || a.id === "planner")),
    [kind],
  );
  const [who, setWho] = useState(options[0].id);
  const [canNative, setCanNative] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const audience = options.find((a) => a.id === who) ?? options[0];
  const target: BrochureKind = kind === "all" ? audience.kind : kind;
  const url = shareUrl(target, audience.id);
  const text = audience.message;
  const subject = `${BROCHURES[target].short} from Crossroads`;
  const enc = encodeURIComponent;

  const links: { label: string; href: string }[] = [
    { label: "Text it", href: `sms:?&body=${enc(`${text} ${url}`)}` },
    { label: "Email it", href: `mailto:?subject=${enc(subject)}&body=${enc(`${text}\n\n${url}`)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
  ];
  if (target === "wedding") {
    links.push({
      label: "Pinterest",
      href: `https://www.pinterest.com/pin/create/button/?url=${enc(url)}&media=${enc(shareImageUrl("wedding"))}&description=${enc(text)}`,
    });
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: subject, text, url });
      setStatus("Shared. Thank you!");
    } catch {
      /* the visitor closed the share sheet: nothing to say */
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setStatus("Copied. Paste it anywhere: group chat, Slack, Instagram story.");
    } catch {
      setStatus(`Copy this link: ${url}`);
    }
  }

  return (
    <div className="rounded-2xl border border-terracotta/30 bg-white p-5 shadow-sm sm:p-6">
      <p id="share-who" className="text-sm font-semibold uppercase tracking-widest text-terracotta-dark">
        Who&rsquo;s it for?
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby="share-who">
        {options.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={a.id === audience.id}
            onClick={() => {
              setWho(a.id);
              setStatus("");
            }}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${
              a.id === audience.id
                ? "border-terracotta bg-terracotta text-cream"
                : "border-charcoal/20 bg-cream text-charcoal hover:border-terracotta"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <p className="mt-5 rounded-xl bg-parchment/60 p-4 text-[15px] leading-relaxed text-ink">
        {text} <span className="break-all font-semibold text-terracotta-dark">{url.replace(/^https?:\/\//, "")}</span>
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {canNative && (
          <button
            type="button"
            onClick={nativeShare}
            className="min-h-11 rounded-full bg-terracotta px-5 text-sm font-semibold text-cream hover:bg-terracotta-dark"
          >
            Share…
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          className={`min-h-11 rounded-full px-5 text-sm font-semibold ${
            canNative
              ? "border border-charcoal/20 bg-cream text-charcoal hover:border-terracotta"
              : "bg-terracotta text-cream hover:bg-terracotta-dark"
          }`}
        >
          Copy message and link
        </button>
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target={l.href.startsWith("http") ? "_blank" : undefined}
            rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="inline-flex min-h-11 items-center rounded-full border border-charcoal/20 bg-cream px-4 text-sm font-semibold text-charcoal hover:border-terracotta"
          >
            {l.label}
          </a>
        ))}
      </div>
      <p className="mt-3 min-h-5 text-sm text-sage-dark" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
