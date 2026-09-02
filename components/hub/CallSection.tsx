"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type DailyIframe from "@daily-co/daily-js";
import type { DailyCall } from "@daily-co/daily-js";
import { SectionCard } from "@/components/hub/shared";

/**
 * A call in the hub. One call type: you join, and your camera is a toggle that
 * starts off. Nothing here branches on "video call" versus "voice call",
 * because that distinction does not exist in this product.
 *
 * The Daily SDK is imported dynamically on click rather than at module scope.
 * It is a large bundle and it touches browser globals, so pulling it into the
 * hub's first load would cost every couple who never starts a call, which is
 * most of them on most visits.
 *
 * Rendered only when the server says calls are configured, so there is no state
 * in which this shows a control that cannot work.
 */
export default function CallSection({ token }: { token: string }) {
  const [joining, setJoining] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [error, setError] = useState("");
  const frameHost = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);

  const leave = useCallback(() => {
    const call = callRef.current;
    callRef.current = null;
    setInCall(false);
    setJoining(false);
    // destroy() also removes the iframe it created, so the host div is left
    // empty and reusable for the next call in this page session.
    void call?.destroy();
  }, []);

  // Leaving the page mid-call must tear the frame down. Without this the
  // Daily object outlives the React tree, holds the camera and microphone, and
  // the couple's device shows a recording indicator for a call nobody is in.
  useEffect(() => leave, [leave]);

  async function join() {
    if (joining || inCall) return;
    setJoining(true);
    setError("");

    try {
      const res = await fetch(`/api/hub/${token}/call`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not start the call. Please try again.");
        setJoining(false);
        return;
      }
      const { roomUrl, token: meetingToken } = (await res.json()) as {
        roomUrl: string;
        token: string;
      };

      const host = frameHost.current;
      if (!host) {
        setJoining(false);
        return;
      }

      const mod = (await import("@daily-co/daily-js")).default as typeof DailyIframe;
      const call = mod.createFrame(host, {
        showLeaveButton: true,
        showFullscreenButton: true,
        iframeStyle: {
          position: "relative",
          width: "100%",
          height: "100%",
          border: "0",
          borderRadius: "12px",
        },
      });
      callRef.current = call;
      call.on("left-meeting", leave);
      call.on("error", () => {
        setError("The call dropped. You can rejoin.");
        leave();
      });

      // startVideoOff is set on the room, on the meeting token, and here. All
      // three, because a participant arriving on camera when they expected not
      // to is not recoverable by turning it off a second later.
      await call.join({ url: roomUrl, token: meetingToken, startVideoOff: true });
      setInCall(true);
      setJoining(false);
    } catch {
      setError("Could not start the call. Please try again.");
      leave();
    }
  }

  return (
    <SectionCard
      title="Talk to us"
      subtitle="Jump on a call right here. Your camera starts off, and you can turn it on whenever you want."
      badge={null}
    >
      <div
        ref={frameHost}
        className={inCall || joining ? "h-[420px] w-full overflow-hidden rounded-xl bg-charcoal" : "hidden"}
      />

      {!inCall && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={join}
            disabled={joining}
            className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
          >
            {joining ? "Connecting..." : "Start a call"}
          </button>
          <span className="text-sm text-ink/55">No app, no account. It opens right on this page.</span>
        </div>
      )}

      {inCall && (
        <button
          type="button"
          onClick={leave}
          className="mt-4 rounded-full border border-parchment px-5 py-2 text-sm font-medium text-ink hover:bg-parchment/40"
        >
          Leave the call
        </button>
      )}

      {error && <p className="mt-3 text-sm text-terracotta-dark">{error}</p>}
    </SectionCard>
  );
}
