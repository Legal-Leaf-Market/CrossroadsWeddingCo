"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VENUE_TIME_ZONE } from "@/lib/site";

// The one-master-thread chat, rendered for both sides: the couple in the hub
// (viewer="couple") and Jake/Nic in the admin inbox (viewer="team"). Both see
// the identical thread; team messages are labeled with the teammate's first
// name so it reads like a group chat while staying one conversation.
//
// Endpoint contract: GET -> {messages: MessageWire[]} (also marks the other
// side's messages read), POST {body, senderName?} -> {message: MessageWire}.
// demo mode (previews) skips the network entirely and echoes locally.

export type ChatMessage = {
  id: string;
  sender: "couple" | "team";
  senderName: string;
  body: string;
  createdAt: string;
};

const MAX_BODY = 4000;
const POLL_MS = 12_000;
const TEAM_NAMES = ["Jake", "Nic"] as const;

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: VENUE_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export default function ChatThread({
  endpoint,
  viewer,
  coupleNames,
  initialMessages,
  demo = false,
}: {
  endpoint: string;
  viewer: "couple" | "team";
  coupleNames: string;
  initialMessages: ChatMessage[];
  demo?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [teamName, setTeamName] = useState<(typeof TEAM_NAMES)[number]>(TEAM_NAMES[0]);
  const listRef = useRef<HTMLDivElement>(null);
  const pollSeq = useRef(0);
  const stickToBottom = useRef(true);

  // Remember which teammate is replying across visits, one device each.
  useEffect(() => {
    if (viewer !== "team") return;
    try {
      const stored = window.localStorage.getItem("crossroads-team-name");
      if (stored === "Jake" || stored === "Nic") setTeamName(stored);
    } catch {}
  }, [viewer]);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (stickToBottom.current) scrollToBottom();
  }, [messages, scrollToBottom]);

  const refresh = useCallback(async () => {
    if (demo) return;
    const seq = ++pollSeq.current;
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { messages?: ChatMessage[] };
      // A stale poll must never clobber a newer one or an optimistic send.
      if (seq !== pollSeq.current || !Array.isArray(json.messages)) return;
      setMessages(json.messages);
    } catch {
      // Quiet: polling recovers on the next tick.
    }
  }, [demo, endpoint]);

  useEffect(() => {
    if (demo) return;
    const t = setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [demo, refresh]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    const senderName = viewer === "team" ? teamName : coupleNames;
    if (demo) {
      setMessages((prev) => [
        ...prev,
        {
          id: `demo-${prev.length}`,
          sender: viewer,
          senderName,
          body,
          createdAt: new Date().toISOString(),
        },
      ]);
      setDraft("");
      setSending(false);
      stickToBottom.current = true;
      return;
    }
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, senderName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "That didn't send. Try again.");
        setSending(false);
        return;
      }
      // Invalidate in-flight polls so they can't clobber the appended send.
      pollSeq.current++;
      if (json.message) setMessages((prev) => [...prev, json.message as ChatMessage]);
      setDraft("");
      stickToBottom.current = true;
    } catch {
      setError("No connection. Your message wasn't sent; try again.");
    }
    setSending(false);
  }

  function download() {
    const lines = messages.map(
      (m) => `[${timeLabel(m.createdAt)}] ${m.senderName}: ${m.body}`,
    );
    const blob = new Blob([lines.join("\n\n") + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "crossroads-conversation.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-parchment bg-white p-4"
      >
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-ink/50">
            {viewer === "couple"
              ? "This is your direct line to us. Anything at all: type it here and we see it right away."
              : "No messages yet. Anything you send lands in the couple's hub."}
          </p>
        )}
        {messages.map((m) => {
          const own = m.sender === viewer;
          return (
            <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] sm:max-w-[70%]`}>
                <div
                  className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm ${
                    m.sender === "team"
                      ? own
                        ? "rounded-br-sm bg-terracotta text-cream"
                        : "rounded-bl-sm bg-charcoal text-cream"
                      : own
                        ? "rounded-br-sm bg-terracotta text-cream"
                        : "rounded-bl-sm bg-parchment text-charcoal"
                  }`}
                >
                  {m.body}
                </div>
                <p className={`mt-1 text-[11px] text-ink/45 ${own ? "text-right" : ""}`}>
                  {m.sender === "team" ? `${m.senderName} · Crossroads` : m.senderName} ·{" "}
                  {timeLabel(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-terracotta">
          {error}
        </p>
      )}

      <div className="mt-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            maxLength={MAX_BODY}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder={viewer === "couple" ? "Message us..." : `Reply to ${coupleNames}...`}
            className="min-h-[52px] w-full flex-1 resize-y rounded-2xl border border-parchment bg-white px-4 py-3 text-sm text-charcoal placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || draft.trim().length === 0}
            className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-50"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink/50">
          {viewer === "team" ? (
            <label className="flex items-center gap-1.5">
              Replying as
              <select
                value={teamName}
                onChange={(e) => {
                  const v = e.target.value === "Nic" ? "Nic" : "Jake";
                  setTeamName(v);
                  try {
                    window.localStorage.setItem("crossroads-team-name", v);
                  } catch {}
                }}
                className="rounded-lg border border-parchment bg-white px-2 py-1 text-xs text-charcoal"
              >
                {TEAM_NAMES.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          ) : (
            <span>We reply here, not by email.</span>
          )}
          <button type="button" onClick={download} className="underline decoration-parchment underline-offset-2 hover:text-terracotta">
            Download conversation
          </button>
        </div>
      </div>
    </div>
  );
}
