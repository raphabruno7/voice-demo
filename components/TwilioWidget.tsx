"use client";

import { useRef, useState } from "react";
import { Device } from "@twilio/voice-sdk";
import type { Dict } from "@/lib/i18n/dictionaries";

type CallState = "idle" | "connecting" | "active" | "ending";
type TwilioDict = { common: Dict["widgets"]["common"]; twilio: Dict["widgets"]["twilio"] };

export default function TwilioWidget({ dict }: { dict: TwilioDict }) {
  const deviceRef = useRef<Device | null>(null);
  const [state, setState] = useState<CallState>("idle");
  const [available, setAvailable] = useState(true);

  async function handleClick() {
    if (state === "active" || state === "ending") {
      setState("ending");
      deviceRef.current?.disconnectAll();
      setState("idle");
      return;
    }
    if (state !== "idle") return;
    setState("connecting");
    try {
      const res = await fetch("/api/twilio/token", { method: "POST" });
      if (!res.ok) { setAvailable(false); setState("idle"); return; }
      const { token } = await res.json();
      const device = new Device(token);
      deviceRef.current = device;
      const call = await device.connect();
      call.on("accept", () => setState("active"));
      call.on("disconnect", () => setState("idle"));
    } catch { setAvailable(false); setState("idle"); }
  }

  const label =
    !available ? dict.twilio.unavailable :
    state === "idle" ? dict.twilio.callButton :
    state === "connecting" ? dict.common.connecting :
    state === "active" ? dict.common.endCall : dict.twilio.ending;

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
            : "bg-rose-500 text-zinc-950 hover:bg-rose-400 focus:ring-rose-500",
          !available || isLoading ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        {isActive && <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />}
        <span className="relative flex items-center gap-2">
          {isActive ? (
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          )}
          {label}
        </span>
      </button>
      {isActive && <p className="text-xs text-zinc-500 animate-pulse">{dict.twilio.listening}</p>}
    </div>
  );
}
