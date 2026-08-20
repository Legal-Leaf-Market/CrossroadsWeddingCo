"use client";

import { useState, type FormEvent } from "react";

const SERVICE_OPTIONS = [
  "Wedding DJ",
  "Live Acoustic Set",
  "Bar Service",
  "Day-Of Coordination",
];

const CONTACT_EMAIL = "hello@crossroadsweddingco.com";

type Status = "idle" | "submitting" | "success" | "error";

export default function LeadForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [services, setServices] = useState<string[]>([]);

  function toggleService(service: string) {
    setServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service],
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          eventDate: data.get("eventDate"),
          venue: data.get("venue"),
          services,
          message: data.get("message"),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMessage(json.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      setStatus("success");
      form.reset();
      setServices([]);
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-cream/20 bg-cream/5 p-8 text-center">
        <h3 className="text-xl text-cream">Got it — thank you!</h3>
        <p className="mt-2 text-cream/70">
          We'll get back to you by email shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl text-left">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">Name</span>
          <input
            name="name"
            type="text"
            required
            className="w-full rounded-lg border border-cream/20 bg-cream/5 px-4 py-2.5 text-cream placeholder:text-cream/40 focus:border-terracotta focus:outline-none"
            placeholder="Jane & Sam"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">Email</span>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-cream/20 bg-cream/5 px-4 py-2.5 text-cream placeholder:text-cream/40 focus:border-terracotta focus:outline-none"
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">Event date</span>
          <input
            name="eventDate"
            type="text"
            className="w-full rounded-lg border border-cream/20 bg-cream/5 px-4 py-2.5 text-cream placeholder:text-cream/40 focus:border-terracotta focus:outline-none"
            placeholder="e.g. June 14, 2027 (or TBD)"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">
            Venue or backyard address
          </span>
          <input
            name="venue"
            type="text"
            className="w-full rounded-lg border border-cream/20 bg-cream/5 px-4 py-2.5 text-cream placeholder:text-cream/40 focus:border-terracotta focus:outline-none"
            placeholder="Where's the big day?"
          />
        </label>
      </div>

      <div className="mt-4">
        <span className="mb-2 block text-sm font-semibold text-cream/80">
          What are you interested in?
        </span>
        <div className="flex flex-wrap gap-2">
          {SERVICE_OPTIONS.map((service) => (
            <button
              key={service}
              type="button"
              onClick={() => toggleService(service)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                services.includes(service)
                  ? "border-terracotta bg-terracotta text-cream"
                  : "border-cream/20 text-cream/70 hover:border-cream/40"
              }`}
            >
              {service}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-semibold text-cream/80">
          Anything else we should know?
        </span>
        <textarea
          name="message"
          rows={3}
          className="w-full rounded-lg border border-cream/20 bg-cream/5 px-4 py-2.5 text-cream placeholder:text-cream/40 focus:border-terracotta focus:outline-none"
          placeholder="Vibe, must-plays, must-nots, questions..."
        />
      </label>

      {status === "error" && (
        <p className="mt-3 text-sm text-terracotta">
          {errorMessage}{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            Email us instead
          </a>
          .
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 w-full rounded-full bg-terracotta px-8 py-3.5 text-base font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Send it over"}
      </button>
    </form>
  );
}
