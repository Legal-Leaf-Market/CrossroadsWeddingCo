"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Signing for the company: typed name, title, explicit confirmation. Mirrors
// the couple's accept box so both signatures on the page mean the same thing.
export default function CountersignForm({
  adminKey,
  weddingId,
}: {
  /** The secret path segment, not the "/admin/<key>" base path. */
  adminKey: string;
  weddingId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("Co-founder");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sign() {
    if (busy || name.trim().length < 2 || !agreed) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/${encodeURIComponent(adminKey)}/contract/${weddingId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), title: title.trim(), agreed }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "That didn't go through. Try again.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("No connection. Nothing was signed; try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border-2 border-terracotta bg-white p-6 print:hidden">
      <h2 className="text-lg font-semibold text-charcoal">Sign for Crossroads</h2>
      <p className="mt-1 text-sm text-ink/70">
        Your signature and today&apos;s date go on the signature block above and on the
        couple&apos;s copy in their hub. It can only be done once.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-charcoal">Your full name</span>
          <input
            value={name}
            maxLength={255}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-lg border border-parchment bg-cream px-4 py-2.5 text-charcoal placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-charcoal">Title</span>
          <input
            value={title}
            maxLength={255}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-parchment bg-cream px-4 py-2.5 text-charcoal focus:border-terracotta focus:outline-none"
          />
        </label>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm text-ink/80">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 accent-terracotta"
        />
        <span>
          I am signing this agreement on behalf of Crossroads Wedding Co. and I understand that
          typing my name here has the same effect as signing it.
        </span>
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm text-terracotta-dark">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void sign()}
        disabled={busy || name.trim().length < 2 || !agreed}
        className="mt-4 w-full rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-50 sm:w-auto"
      >
        {busy ? "Signing..." : "Sign agreement"}
      </button>
    </div>
  );
}
