"use client";

import { useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  useConnectionState,
} from "@livekit/components-react";
import type { Dict } from "@/lib/i18n/dictionaries";

type LiveKitDict = {
  common: Dict["widgets"]["common"];
  livekit: Dict["widgets"]["livekit"];
};

function VoiceControls({ onDisconnect, dict }: { onDisconnect: () => void; dict: LiveKitDict }) {
  const { state } = useVoiceAssistant();
  const connectionState = useConnectionState();

  const isConnected = connectionState === "connected";
  const agentState = state ?? "connecting";

  const statusLabel =
    agentState === "listening" ? dict.livekit.statusListening :
    agentState === "thinking"  ? dict.livekit.statusThinking :
    agentState === "speaking"  ? dict.livekit.statusSpeaking :
    dict.common.connecting;

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <button
        onClick={onDisconnect}
        className="relative px-8 py-4 rounded-full font-semibold text-base transition-all duration-200 bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 focus:ring-red-500"
      >
        <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />
        <span className="relative flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${agentState === "speaking" ? "bg-red-400 animate-pulse" : "bg-red-400"}`} />
          {dict.common.endCall}
        </span>
      </button>
      {isConnected && (
        <p className="text-xs text-zinc-500 animate-pulse">{statusLabel}</p>
      )}
    </div>
  );
}

export default function GeminiLiveWidget({ dict }: { dict: LiveKitDict }) {
  const [connectionDetails, setConnectionDetails] = useState<{ token: string; url: string } | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    setConnecting(true);
    try {
      const leadPhone = new URLSearchParams(window.location.search).get("leadPhone") ?? undefined;
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantName: "tester", leadPhone }),
      });
      if (!res.ok) throw new Error("Token error");
      const { token, url } = await res.json();
      setConnectionDetails({ token, url });
    } catch {
      setConnecting(false);
    }
  }

  function handleDisconnect() {
    setConnectionDetails(null);
    setConnecting(false);
  }

  if (!connectionDetails) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          onClick={handleConnect}
          disabled={connecting}
          className={[
            "relative px-8 py-4 rounded-full font-semibold text-base transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950",
            "bg-violet-500 text-zinc-950 hover:bg-violet-400 focus:ring-violet-500",
            connecting ? "opacity-60 cursor-not-allowed" : "",
          ].join(" ")}
        >
          <span className="relative flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
            {connecting ? dict.common.connecting : dict.livekit.callButton}
          </span>
        </button>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={connectionDetails.token}
      serverUrl={connectionDetails.url}
      connect
      audio
      video={false}
      onDisconnected={handleDisconnect}
      onError={() => handleDisconnect()}
    >
      <RoomAudioRenderer />
      <VoiceControls onDisconnect={handleDisconnect} dict={dict} />
    </LiveKitRoom>
  );
}
