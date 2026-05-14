"use client";

import { useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";

type CallState = "idle" | "connecting" | "active" | "ending";

function WidgetInner() {
  const [state, setState] = useState<CallState>("idle");

  const conversation = useConversation({
    onConnect: () => setState("active"),
    onDisconnect: () => setState("idle"),
    onError: () => setState("idle"),
  });

  async function handleClick() {
    if (state === "active" || state === "ending") {
      setState("ending");
      await conversation.endSession();
      setState("idle");
      return;
    }

    setState("connecting");
    try {
      const res = await fetch("/api/elevenlabs/signed-url", { method: "POST" });
      if (!res.ok) throw new Error("Failed to get signed URL");
      const { signedUrl } = await res.json();
      await conversation.startSession({ signedUrl });
    } catch {
      setState("idle");
    }
  }

  const isSpeaking = conversation.isSpeaking;
  const label =
    state === "idle" ? "Talk to Ana — free, right now" :
    state === "connecting" ? "Connecting…" :
    state === "active" ? "End call" : "Ending…";

  const isActive = state === "active";
  const isLoading = state === "connecting" || state === "ending";

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={[
          "relative px-8 py-4 rounded-full font-semibold text-base transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950",
          isActive
            ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 focus:ring-red-500"
            : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 focus:ring-emerald-500",
          isLoading ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        {isActive && (
          <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />
        )}
        <span className="relative flex items-center gap-2">
          {isActive ? (
            <span className={`w-2 h-2 rounded-full ${isSpeaking ? "bg-red-400 animate-pulse" : "bg-red-400"}`} />
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          )}
          {label}
        </span>
      </button>
      {isActive && (
        <p className="text-xs text-zinc-500 animate-pulse">Ana is listening…</p>
      )}
    </div>
  );
}

export default function LiveKitWidget() {
  return (
    <ConversationProvider>
      <WidgetInner />
    </ConversationProvider>
  );
}
