"use client";

import { useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";
import type { Dict } from "@/lib/i18n/dictionaries";

type CallState = "idle" | "connecting" | "active" | "ending";
type TranscriptEntry = { role: "user" | "agent"; text: string };

type VapiDict = { common: Dict["widgets"]["common"]; vapi: Dict["widgets"]["vapi"] };

export default function VapiWidget({ dict }: { dict: VapiDict }) {
  const vapiRef = useRef<Vapi | null>(null);
  const [state, setState] = useState<CallState>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
  const configured = Boolean(publicKey && assistantId);

  useEffect(() => {
    if (!configured) return;
    const vapi = new Vapi(publicKey!);
    vapiRef.current = vapi;

    vapi.on("call-start", () => setState("active"));
    vapi.on("call-end", () => { setState("idle"); setIsSpeaking(false); });
    vapi.on("speech-start", () => setIsSpeaking(true));
    vapi.on("speech-end", () => setIsSpeaking(false));
    vapi.on("message", (m: { type?: string; transcriptType?: string; role?: string; transcript?: string }) => {
      if (m.type === "transcript" && m.transcriptType === "final" && m.transcript) {
        setTranscript((prev) => [...prev, { role: m.role === "user" ? "user" : "agent", text: m.transcript! }]);
      }
    });

    return () => { vapi.stop(); };
  }, [configured, publicKey]);

  async function handleClick() {
    if (!vapiRef.current) return;
    if (state === "active" || state === "ending") {
      setState("ending");
      vapiRef.current.stop();
    } else if (state === "idle") {
      setState("connecting");
      setTranscript([]);
      await vapiRef.current.start(assistantId!);
    }
  }

  const label =
    !configured ? dict.vapi.unavailable :
    state === "idle" ? dict.vapi.callButton :
    state === "connecting" ? dict.common.connecting :
    state === "active" ? dict.common.endCall : dict.vapi.ending;

  const isActive = state === "active";
  const isLoading = state === "connecting" || state === "ending";

  return (
    <div className="mt-8 flex flex-col items-center gap-3 w-full">
      <button
        onClick={handleClick}
        disabled={!configured || isLoading}
        className={[
          "relative px-8 py-4 rounded-full font-semibold text-base transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950",
          isActive
            ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 focus:ring-red-500"
            : "bg-sky-500 text-zinc-950 hover:bg-sky-400 focus:ring-sky-500",
          !configured || isLoading ? "opacity-60 cursor-not-allowed" : "",
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
      {isActive && <p className="text-xs text-zinc-500 animate-pulse">{dict.vapi.listening}</p>}

      {transcript.length > 0 && (
        <div className="mt-2 w-full max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3 text-left text-sm space-y-2">
          {transcript.map((entry, i) => (
            <p key={i} className={entry.role === "user" ? "text-zinc-200" : "text-sky-300"}>
              <span className="font-semibold">{entry.role === "user" ? `${dict.common.you}: ` : `${dict.common.agentName}: `}</span>
              {entry.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
