"use client";

import { useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import type { Dict } from "@/lib/i18n/dictionaries";
import { BASE_PATH } from "@/lib/base-path";

type CallState = "idle" | "connecting" | "active" | "ending";
type TranscriptEntry = { role: "user" | "agent"; text: string };

type ElevenLabsDict = {
  common: Dict["widgets"]["common"];
  elevenlabs: Dict["widgets"]["elevenlabs"];
};

function WidgetInner({ dict, niche }: { dict: ElevenLabsDict; niche?: string }) {
  const [state, setState] = useState<CallState>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [textInput, setTextInput] = useState("");

  const conversation = useConversation({
    onConnect: () => setState("active"),
    onDisconnect: () => setState("idle"),
    onError: () => setState("idle"),
    onMessage: ({ message, source }) => {
      setTranscript((prev) => [
        ...prev,
        { role: source === "user" ? "user" : "agent", text: message },
      ]);
    },
  });

  async function handleClick() {
    if (state === "active" || state === "ending") {
      setState("ending");
      await conversation.endSession();
      setState("idle");
      return;
    }

    setState("connecting");
    setTranscript([]);
    try {
      const nicheName = niche ?? new URLSearchParams(window.location.search).get("niche") ?? undefined;
      const signedUrlPath = nicheName
        ? `${BASE_PATH}/api/elevenlabs/signed-url?niche=${encodeURIComponent(nicheName)}`
        : `${BASE_PATH}/api/elevenlabs/signed-url`;
      const res = await fetch(signedUrlPath);
      if (!res.ok) throw new Error("Failed to get signed URL");
      const { signedUrl } = await res.json();
      await conversation.startSession({ signedUrl });
    } catch {
      setState("idle");
    }
  }

  function handleSendText() {
    const text = textInput.trim();
    if (!text || state !== "active") return;
    conversation.sendUserMessage(text);
    setTranscript((prev) => [...prev, { role: "user", text }]);
    setTextInput("");
  }

  const isSpeaking = conversation.isSpeaking;
  const label =
    state === "idle" ? dict.elevenlabs.callButton :
    state === "connecting" ? dict.common.connecting :
    state === "active" ? dict.common.endCall : dict.elevenlabs.ending;

  const isActive = state === "active";
  const isLoading = state === "connecting" || state === "ending";

  return (
    <div className="mt-8 flex flex-col items-center gap-3 w-full">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={[
          "relative px-8 py-4 rounded-full font-semibold text-base transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950",
          isActive
            ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 focus:ring-red-500"
            : "bg-amber-500 text-zinc-950 hover:bg-amber-400 focus:ring-amber-500",
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
        <p className="text-xs text-zinc-500 animate-pulse">{dict.elevenlabs.listening}</p>
      )}

      {transcript.length > 0 && (
        <div className="mt-2 w-full max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3 text-left text-sm space-y-2">
          {transcript.map((entry, i) => (
            <p key={i} className={entry.role === "user" ? "text-zinc-200" : "text-amber-300"}>
              <span className="font-semibold">{entry.role === "user" ? `${dict.common.you}: ` : `${dict.common.agentName}: `}</span>
              {entry.text}
            </p>
          ))}
        </div>
      )}

      <div className="mt-2 w-full flex items-center gap-2">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSendText();
          }}
          disabled={!isActive}
          placeholder={isActive ? dict.elevenlabs.inputPlaceholder : dict.elevenlabs.inputPlaceholderDisabled}
          className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
        />
        <button
          onClick={handleSendText}
          disabled={!isActive || !textInput.trim()}
          className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {dict.elevenlabs.send}
        </button>
      </div>
    </div>
  );
}

export default function ElevenLabsWidget({ dict, niche }: { dict: ElevenLabsDict; niche?: string }) {
  return (
    <ConversationProvider>
      <WidgetInner dict={dict} niche={niche} />
    </ConversationProvider>
  );
}
