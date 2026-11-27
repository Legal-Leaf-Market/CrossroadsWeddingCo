"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BOOKS_HELP, type BooksHelpTopic } from "@/lib/books/help-topics";

export default function BooksHelp({ topic, label = "Ask Jake" }: { topic?: BooksHelpTopic; label?: string }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [selected, setSelected] = useState<BooksHelpTopic | null>(topic ?? null);
  const [query, setQuery] = useState("");
  const answer = selected ? BOOKS_HELP[selected] : null;
  const term = query.trim().toLowerCase();
  const topics = (Object.keys(BOOKS_HELP) as BooksHelpTopic[]).filter(key => {
    const { title, description } = BOOKS_HELP[key];
    return `${title} ${description}`.toLowerCase().includes(term);
  });

  useEffect(() => {
    if (dialog.current?.open) heading.current?.focus();
  }, [selected]);

  function open() {
    setSelected(topic ?? null);
    setQuery("");
    dialog.current?.showModal();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-controls={id}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-parchment bg-white px-2.5 py-1.5 text-sm font-semibold text-terracotta-dark hover:border-terracotta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <img src="/ask-jake.jpg" width={28} height={28} alt="" className="size-7 rounded-full object-cover" />
        {label}
      </button>
      <dialog
        ref={dialog}
        id={id}
        aria-labelledby={id + "-title"}
        className="m-auto w-[min(30rem,calc(100%-2rem))] max-h-[calc(100%-2rem)] overflow-auto rounded-2xl border border-parchment border-t-4 border-t-terracotta bg-cream p-5 text-charcoal shadow-2xl backdrop:bg-charcoal/65 sm:p-7"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-terracotta-dark">Ask Jake · Books</p>
          <form method="dialog">
            <button className="rounded-full border border-parchment bg-white px-3 py-1 text-sm font-semibold">Close</button>
          </form>
        </div>
        <h2 id={id + "-title"} ref={heading} tabIndex={-1} className="mt-4 text-xl font-semibold outline-none">
          {answer?.title ?? "What can I explain?"}
        </h2>
        {answer ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-ink/80">{answer.description}</p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-terracotta-dark">
              <a href={answer.link.href} className="underline underline-offset-2" onClick={() => dialog.current?.close()}>
                {answer.link.label}
              </a>
              <button type="button" className="underline underline-offset-2" onClick={() => setSelected(null)}>
                All questions
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="mt-3 block text-sm">
              Search questions
              <input
                type="search"
                className="mt-1 block w-full rounded-lg border border-parchment bg-white px-3 py-2"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
            </label>
            {topics.length ? (
              <ul className="mt-2 divide-y divide-parchment">
                {topics.map(key => (
                  <li key={key}>
                    <button
                      type="button"
                      className="min-h-10 w-full py-2 text-left text-sm font-semibold text-terracotta-dark hover:underline"
                      onClick={() => setSelected(key)}
                    >
                      {BOOKS_HELP[key].title}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status" className="mt-3 text-sm text-ink/75">No matching questions. Try another word.</p>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
