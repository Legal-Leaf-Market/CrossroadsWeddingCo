"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const input =
  "mt-1 w-full rounded-lg border border-parchment bg-white px-3 py-2.5 text-base text-charcoal focus:border-terracotta focus:outline-none";
const label = "block text-sm font-semibold text-ink/70";

/**
 * One expense from a phone: the receipt photo first (the camera opens), then
 * the few facts the books need. Everything is checked again on the server.
 */
export default function CaptureForm({
  token,
  today,
  jobs,
  categories,
}: {
  token: string;
  today: string;
  jobs: { id: string; label: string }[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (file instanceof File && file.size > 4 * 1024 * 1024) {
      setError("That photo is over 4 MB. Try again with a smaller one.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setError("");
    try {
      const res = await fetch(`/api/expense/${encodeURIComponent(token)}`, { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "That didn't send. Try again.");
        setStatus("error");
        return;
      }
      formRef.current?.reset();
      setFileName("");
      setStatus("sent");
      router.refresh();
    } catch {
      setError("That didn't send. Check your signal and try again.");
      setStatus("error");
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4 rounded-2xl border border-parchment bg-white p-4">
      <div>
        <span className={label}>Receipt</span>
        <label className="mt-1 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-terracotta/60 bg-cream px-4 py-6 text-center text-sm font-semibold text-terracotta-dark">
          <input
            type="file"
            name="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          />
          {fileName ? `Got it: ${fileName}` : "Take a photo of the receipt"}
        </label>
        <p className="mt-1 text-xs text-ink/55">No receipt? You can still send it; say why below.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Amount
          <input name="amount" inputMode="decimal" placeholder="12.50" required className={input} />
        </label>
        <label className={label}>
          Date paid
          <input name="spentOn" type="date" defaultValue={today} max={today} required className={input} />
        </label>
      </div>
      <label className={label}>
        Where
        <input name="merchant" placeholder="Speedway, Walmart, Guitar Center" maxLength={160} required className={input} />
      </label>
      <label className={label}>
        What it was for
        <textarea name="description" rows={2} maxLength={1000} required placeholder="Ice for the bar at the Hayes wedding" className={input} />
      </label>
      {jobs.length > 0 && (
        <label className={label}>
          Which event (if any)
          <select name="weddingId" defaultValue="" className={input}>
            <option value="">Not for one event</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {categories.length > 0 && (
        <label className={label}>
          Kind of expense (optional)
          <select name="categoryId" defaultValue="" className={input}>
            <option value="">Not sure</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-full bg-terracotta px-5 py-3 text-base font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
      >
        {status === "sending" ? "Sending..." : "Send it"}
      </button>
      {status === "sent" && <p className="text-center text-sm font-semibold text-sage-dark">Sent. It shows below while it&apos;s reviewed.</p>}
      {status === "error" && <p className="text-center text-sm font-semibold text-terracotta-dark">{error}</p>}
    </form>
  );
}
