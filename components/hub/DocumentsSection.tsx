"use client";

import { useRef, useState } from "react";
import { RemoveButton, SectionCard, hubInput } from "@/components/hub/shared";

export type HubDocument = {
  id: string;
  label: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
};

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/heic,application/pdf";

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * The couple's own paperwork, sitting directly above our schedule. Theirs is
 * the official version, the one guests and family already hold; ours follows
 * it. Showing both on one page is the whole point: the couple can check our
 * run sheet against their own card without leaving the hub.
 *
 * Deliberately not on the debounced autosave engine. Files are whole objects,
 * uploaded and removed one at a time, so each action is its own request and
 * two devices adding files at once both succeed.
 */
export default function DocumentsSection({
  token,
  initial,
  demo = false,
}: {
  token: string;
  initial: HubDocument[];
  demo?: boolean;
}) {
  const [docs, setDocs] = useState<HubDocument[]>(initial);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (demo) {
      setError("This is a preview. Uploads work on a real hub.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("label", label);
      const res = await fetch(`/api/hub/${token}/documents`, { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as {
        document?: HubDocument;
        error?: string;
      };
      if (!res.ok || !json.document) {
        setError(json.error ?? "That upload didn't go through. Try again.");
        return;
      }
      setDocs((rows) => [...rows, json.document!]);
      setLabel("");
    } catch {
      setError("No connection. Try again in a moment.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove(id: string) {
    setArmed(null);
    if (demo) return;
    const previous = docs;
    setDocs((rows) => rows.filter((d) => d.id !== id));
    const res = await fetch(`/api/hub/${token}/documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setDocs(previous);
      setError("We couldn't remove that one. Try again.");
    }
  }

  return (
    <SectionCard
      title="Your documents"
      subtitle="Your own timeline, order of events, wedding party card, anything you've already sent out. Yours is the official version; the schedule below follows it. Keep them here so you can check one against the other."
      badge={null}
    >
      {docs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-parchment px-4 py-6 text-center text-sm text-ink/50">
          Nothing here yet. Add the graphics or documents you&apos;ve already shared with your
          guests and we&apos;ll work from them.
        </p>
      ) : (
        <ul className="space-y-4">
          {docs.map((doc) => {
            const src = `/api/hub/${token}/documents/${doc.id}/file`;
            const isPdf = doc.mimeType === "application/pdf";
            return (
              <li key={doc.id} className="overflow-hidden rounded-xl border border-parchment bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-parchment bg-parchment/30 px-3 py-2">
                  <span className="text-sm font-semibold text-charcoal">
                    {doc.label || doc.fileName || "Document"}
                  </span>
                  <span className="flex items-center gap-3">
                    <a
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-terracotta hover:text-terracotta-dark"
                    >
                      Open full size
                    </a>
                    <RemoveButton
                      label="Remove document"
                      armed={armed === doc.id}
                      onToggle={(next) => setArmed(next ? doc.id : null)}
                      onRemove={() => void remove(doc.id)}
                    />
                  </span>
                </div>
                {isPdf ? (
                  <object data={src} type="application/pdf" className="block h-[70vh] w-full">
                    <p className="p-4 text-sm text-ink/60">
                      <a href={src} target="_blank" rel="noreferrer" className="text-terracotta underline">
                        Open the PDF
                      </a>
                    </p>
                  </object>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={doc.label || doc.fileName || "Wedding document"}
                    className="mx-auto block max-h-[70vh] w-auto max-w-full bg-charcoal/5"
                  />
                )}
                <p className="px-3 py-2 text-xs text-ink/40">
                  {doc.fileName} · {prettySize(doc.byteSize)}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          aria-label="Document name"
          className={`${hubInput} basis-48 sm:basis-64 sm:flex-none`}
          value={label}
          maxLength={120}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name it, e.g. Order of events"
        />
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          disabled={busy}
          aria-label="Choose a document"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
          className="text-sm text-ink/70 file:mr-3 file:rounded-full file:border-0 file:bg-terracotta file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-cream hover:file:bg-terracotta-dark"
        />
        {busy && <span className="text-xs text-ink/50">Uploading...</span>}
      </div>
      <p className="mt-1.5 text-xs text-ink/40">
        Images or PDFs, up to 4 MB each. Adding a newer version and removing the old one is how
        you swap one out.
      </p>
      {error && <p className="mt-2 text-sm text-terracotta-dark">{error}</p>}
    </SectionCard>
  );
}
