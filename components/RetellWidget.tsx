"use client";

import { useEffect, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import type { Dict } from "@/lib/i18n/dictionaries";

type CallState = "idle" | "connecting" | "active" | "ending";
type TranscriptEntry = { role: "user" | "agent"; text: string };
type RetellDict = { common: Dict["widgets"]["common"]; retell: Dict["widgets"]["retell"] };
type RetellUpdate = { transcript?: { role: string; content: string }[] };

export default function RetellWidget({ dict }: { dict: RetellDict }) {
  const clientRef = useRef<RetellWebClient | null>(null);
  const [state, setState] = useState<CallState>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const client = new RetellWebClient();
    clientRef.current = client;
    client.on("call_started", () => setState("active"));
    client.on("call_ended", () => { setState("idle"); setIsSpeaking(false); });
    client.on("agent_start_talking", () => setIsSpeaking(true));
    client.on("agent_stop_talking", () => setIsSpeaking(false));
    client.on("update", (u: RetellUpdate) => {
      if (!u.transcript?.length) return;
      setTranscript(u.transcript.map((t) => ({ role: t.role === "user" ? "user" : "agent", text: t.content })));
    });
    return () => { client.stopCall(); };
  }, []);

  async function handleClick() {
    const client = clientRef.current;
    if (!client) return;
    if (state === "active" || state === "ending") {
      setState("ending"); client.stopCall(); return;
    }
    if (state === "idle") {
      setState("connecting"); setTranscript([]);
      try {
        const res = await fetch("/api/retell/web-call", { method: "POST" });
        if (!res.ok) { setAvailable(false); setState("idle"); return; }
        const { accessToken } = await res.json();
        await client.startCall({ accessToken });
      } catch { setAvailable(false); setState("idle"); }
    }
  }

  const label =
    !available ? dict.retell.unavailable :
    state === "idle" ? dict.retell.callButton :
    state === "connecting" ? dict.common.connecting :
    state === "active" ? dict.common.endCall : dict.retell.ending;

  const isActive = state === "active";
  const isLoading = state === "connecting" || state === "ending";

  return (
    <div className="mt-8 flex flex-col items-center gap-3 w-full">
      <button
        onClick={handleClick}
        disabled={!available || isLoading}
        className={[
          "relative px-8 py-4 rounded-full font-semibold text-base transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950",
          isActive
            ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 focus:ring-red-500"
            : "bg-fuchsia-500 text-zinc-950 hover:bg-fuchsia-400 focus:ring-fuchsia-500",
          !available || isLoading ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        {isActive && <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />}
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
      {isActive && <p className="text-xs text-zinc-500 animate-pulse">{dict.retell.listening}</p>}

      {transcript.length > 0 && (
        <div className="mt-2 w-full max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3 text-left text-sm space-y-2">
          {transcript.map((entry, i) => (
            <p key={i} className={entry.role === "user" ? "text-zinc-200" : "text-fuchsia-300"}>
              <span className="font-semibold">{entry.role === "user" ? `${dict.common.you}: ` : `${dict.common.agentName}: `}</span>
              {entry.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
