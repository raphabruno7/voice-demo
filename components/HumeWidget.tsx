"use client";

import { useEffect, useState } from "react";
import { VoiceProvider, useVoice } from "@humeai/voice-react";

type CallState = "idle" | "connecting" | "active" | "ending";

function WidgetInner({ accessToken }: { accessToken: string | null }) {
  const [state, setState] = useState<CallState>("idle");
  const { connect, disconnect, status, isPlaying } = useVoice();

  useEffect(() => {
    if (status.value === "connected") setState("active");
    if (status.value === "disconnected") setState("idle");
    if (status.value === "error") setState("idle");
  }, [status]);

  async function handleClick() {
    if (state === "active" || state === "ending") {
      setState("ending");
      disconnect();
      setState("idle");
      return;
    }

    if (!accessToken) return;

    setState("connecting");
    try {
      await connect({
        auth: { type: "accessToken", value: accessToken },
        configId: process.env.NEXT_PUBLIC_HUME_CONFIG_ID,
      });
    } catch {
      setState("idle");
    }
  }

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
        disabled={isLoading || !accessToken}
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
            <span className={`w-2 h-2 rounded-full ${isPlaying ? "bg-red-400 animate-pulse" : "bg-red-400"}`} />
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

export default function HumeWidget() {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/hume/access-token", { method: "POST" })
      .then((r) => r.json())
      .then((d) => setAccessToken(d.accessToken ?? null))
      .catch(() => setAccessToken(null));
  }, []);

  return (
    <VoiceProvider>
      <WidgetInner accessToken={accessToken} />
    </VoiceProvider>
  );
}
