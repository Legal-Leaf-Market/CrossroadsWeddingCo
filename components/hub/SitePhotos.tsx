"use client";

import { useState } from "react";

const MAX = 12;
const LONG_EDGE = 2000;

/**
 * Resize in the browser before upload: a phone photo is 4 to 12 MB, and
 * re-encoding through a canvas also drops EXIF and GPS, so where a photo was
 * taken never leaves the couple's phone.
 */
async function prepare(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
  if (!blob) throw new Error("Couldn't read that photo.");
  return { blob, width, height };
}

export default function SitePhotos({ token, initial }: { token: string; initial: { id: string }[] }) {
  const [photos, setPhotos] = useState(initial);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const list = [...files].slice(0, MAX - photos.length);
    for (let i = 0; i < list.length; i++) {
      setBusy(`Adding ${i + 1} of ${list.length}...`);
      try {
        const { blob, width, height } = await prepare(list[i]);
        const fd = new FormData();
        fd.append("file", blob, "photo.jpg");
        fd.append("width", String(width));
        fd.append("height", String(height));
        const res = await fetch(`/api/hub/${token}/site-photos`, { method: "POST", body: fd });
        const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!res.ok || !json.id) {
          setError(json.error ?? "A photo didn't upload.");
          break;
        }
        setPhotos((p) => [...p, { id: json.id! }]);
      } catch {
        setError("One photo couldn't be read. Try a JPG or PNG.");
      }
    }
    setBusy("");
  }

  async function remove(id: string) {
    const res = await fetch(`/api/hub/${token}/site-photos/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) setPhotos((p) => p.filter((x) => x.id !== id));
    else setError("Couldn't remove that one. Try again.");
  }

  return (
    <div className="mt-5">
      <p className="text-sm font-semibold text-charcoal">Engagement photos</p>
      <p className="text-sm text-ink/60">Up to {MAX}. The first one leads the page. We shrink them for the web and strip the location data first.</p>
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p, i) => (
            <div key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/hub/${token}/site-photos/${p.id}`} alt={`Engagement photo ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="absolute right-1 top-1 rounded-full bg-charcoal/80 px-2 py-0.5 text-xs font-semibold text-cream hover:bg-charcoal"
                aria-label={`Remove photo ${i + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length < MAX && (
        <label className="mt-3 inline-block cursor-pointer rounded-full border border-terracotta px-4 py-2 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream">
          {busy || "Add photos"}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="sr-only" disabled={Boolean(busy)} onChange={(e) => upload(e.target.files)} />
        </label>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-terracotta-dark" role="alert">{error}</p>}
    </div>
  );
}
