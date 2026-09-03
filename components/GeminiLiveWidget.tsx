"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  useConnectionState,
  useTranscriptions,
  useLocalParticipant,
  useTrackVolume,
} from "@livekit/components-react";
import type { TrackReference } from "@livekit/components-react";
import type { LocalAudioTrack } from "livekit-client";
import type { Dict } from "@/lib/i18n/dictionaries";
import { BASE_PATH } from "@/lib/base-path";

type LiveKitDict = {
  common: Dict["widgets"]["common"];
  livekit: Dict["widgets"]["livekit"];
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * Orb that vibrates with the voice. Owns the ~few-Hz `useTrackVolume` hooks so
 * re-renders stay local — it's a sibling of the transcript list, never a parent.
 * Idle branch passes both tracks `undefined` → both volumes stay 0.
 */
function VoiceOrb({
  agentTrack,
  micTrack,
  connecting,
}: {
  agentTrack?: TrackReference;
  micTrack?: LocalAudioTrack;
  connecting: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const agentVol = useTrackVolume(agentTrack);
  const userVol = useTrackVolume(micTrack);

  const userActive = userVol > 0.06;
  const raw = Math.max(agentVol, userVol);
  const v = reduced ? 0 : Math.min(raw, 1);
  // ciano quando é o utilizador a falar, violeta caso contrário (agente / repouso)
  const tint = userActive
    ? "radial-gradient(circle at 35% 30%, #a5f3fc, #22d3ee 45%, #0e7490 80%)"
    : "radial-gradient(circle at 35% 30%, #ddd6fe, #8b5cf6 45%, #4c1d95 80%)";

  // A vibração (scale, estilo inline) e o morphing (@keyframes, transform) vivem
  // em elementos separados — uma animação CSS ganha à regra inline no mesmo nó.
  return (
    <div className="relative flex items-center justify-center" style={{ width: "clamp(180px, 26vw, 320px)", height: "clamp(180px, 26vw, 320px)" }}>
      <div className="absolute inset-0" style={{ transform: `scale(${1 + v * 0.28})` }}>
        <div className="orb-blob h-full w-full rounded-full blur-2xl opacity-70" style={{ background: tint }} />
      </div>
      <div className="absolute inset-6" style={{ transform: `scale(${1 + v * 0.18})` }}>
        <div className="orb-blob h-full w-full rounded-full blur-xl opacity-80" style={{ background: tint }} />
      </div>
      <div
        className="relative h-[72%] w-[72%]"
        style={{ transform: `scale(${1 + v * 0.18})`, opacity: connecting ? 0.6 : 0.95, transition: "opacity 300ms ease" }}
      >
        <div className="orb-blob h-full w-full rounded-full" style={{ background: tint }} />
      </div>
    </div>
  );
}

function ChatBubbles({
  transcript,
  dict,
  transcriptRef,
}: {
  transcript: { id: string; role: string; text: string }[];
  dict: LiveKitDict;
  transcriptRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (transcript.length === 0) {
    return (
      <div className="flex-1 flex items-start p-4">
        <p className="text-sm text-zinc-600">{dict.livekit.transcriptEmpty}</p>
      </div>
    );
  }
  return (
    <div ref={transcriptRef} className="flex-1 overflow-y-auto scroll-smooth p-4 space-y-3">
      {transcript.map((t) => {
        const agent = t.role === "assistant";
        return (
          <div key={t.id} className={`flex flex-col ${agent ? "items-start" : "items-end"}`}>
            <span className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1">
              {agent ? dict.common.agentName : dict.common.you}
            </span>
            <div
              className={
                agent
                  ? "max-w-[85%] rounded-2xl rounded-bl-sm border border-violet-500/20 bg-violet-500/10 text-violet-100 px-3 py-2 text-sm"
                  : "max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-800/60 text-zinc-100 px-3 py-2 text-sm"
              }
            >
              {t.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TranscriptPanel({
  dict,
  connected,
  transcript,
  transcriptRef,
}: {
  dict: LiveKitDict;
  connected: boolean;
  transcript: { id: string; role: string; text: string }[];
  transcriptRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <aside className="flex flex-col border-t lg:border-t-0 lg:border-l border-white/10 bg-zinc-900/40 backdrop-blur lg:w-[30%] lg:h-full h-[50vh] lg:pt-14">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-zinc-600"}`} />
        <span className="text-sm font-medium text-zinc-300">{dict.livekit.transcriptTitle}</span>
      </header>
      <ChatBubbles transcript={transcript} dict={dict} transcriptRef={transcriptRef} />
    </aside>
  );
}

function Stage({
  hero,
  footer,
  dict,
  connected,
  orb,
  control,
  status,
  transcript,
  transcriptRef,
}: {
  hero: ReactNode;
  footer: ReactNode;
  dict: LiveKitDict;
  connected: boolean;
  orb: ReactNode;
  control: ReactNode;
  status: ReactNode;
  transcript: { id: string; role: string; text: string }[];
  transcriptRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="relative flex flex-col lg:flex-row flex-1 min-h-0">
      {/* fundo em movimento */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-blob-a absolute -top-1/3 -left-1/4 h-[70vh] w-[70vh] rounded-full blur-3xl bg-[radial-gradient(circle,rgba(139,92,246,0.25),transparent_70%)]" />
        <div className="bg-blob-b absolute -bottom-1/3 right-0 h-[65vh] w-[65vh] rounded-full blur-3xl bg-[radial-gradient(circle,rgba(79,70,229,0.22),transparent_70%)]" />
      </div>

      {/* coluna esquerda */}
      <div className="flex flex-col flex-1 min-h-0 px-6 pb-8 pt-20 lg:pt-14">
        <div className="max-w-lg">{hero}</div>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-8">
          {orb}
          {control}
          {status}
        </div>
        <div className="text-xs text-zinc-500">{footer}</div>
      </div>

      {/* coluna direita */}
      <TranscriptPanel dict={dict} connected={connected} transcript={transcript} transcriptRef={transcriptRef} />
    </div>
  );
}

function VoiceControls({
  onDisconnect,
  dict,
  hero,
  footer,
}: {
  onDisconnect: () => void;
  dict: LiveKitDict;
  hero: ReactNode;
  footer: ReactNode;
}) {
  const { state, audioTrack } = useVoiceAssistant();
  const connectionState = useConnectionState();
  const { localParticipant, microphoneTrack } = useLocalParticipant();
  const transcriptions = useTranscriptions();
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const isConnected = connectionState === "connected";
  const agentState = state ?? "connecting";

  const statusLabel =
    agentState === "listening" ? dict.livekit.statusListening :
    agentState === "thinking" ? dict.livekit.statusThinking :
    agentState === "speaking" ? dict.livekit.statusSpeaking :
    dict.common.connecting;

  const transcript = useMemo(
    () =>
      [...transcriptions]
        .sort((a, b) => a.streamInfo.timestamp - b.streamInfo.timestamp)
        .map((t) => ({
          id: t.streamInfo.id,
          role: t.participantInfo.identity === localParticipant.identity ? "user" : "assistant",
          text: t.text,
        })),
    [transcriptions, localParticipant.identity]
  );

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  return (
    <Stage
      hero={hero}
      footer={footer}
      dict={dict}
      connected={isConnected}
      transcript={transcript}
      transcriptRef={transcriptRef}
      orb={
        <VoiceOrb
          agentTrack={audioTrack}
          micTrack={microphoneTrack?.track as LocalAudioTrack | undefined}
          
          connecting={!isConnected}
        />
      }
      control={
        <button
          onClick={onDisconnect}
          className="relative px-8 py-4 rounded-full font-semibold text-base transition-all duration-200 bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 focus:ring-red-500"
        >
          <span className="relative flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            {dict.common.endCall}
          </span>
        </button>
      }
      status={isConnected ? <p className="text-xs text-zinc-500 animate-pulse">{statusLabel}</p> : null}
    />
  );
}

export default function GeminiLiveWidget({
  dict,
  hero,
  footer,
}: {
  dict: LiveKitDict;
  hero: ReactNode;
  footer: ReactNode;
}) {
  const [connectionDetails, setConnectionDetails] = useState<{ token: string; url: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(false);
  const idleTranscriptRef = useRef<HTMLDivElement | null>(null);

  async function handleConnect() {
    setConnecting(true);
    setError(false);
    try {
      const leadPhone = new URLSearchParams(window.location.search).get("leadPhone") ?? undefined;
      const res = await fetch(`${BASE_PATH}/api/livekit/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantName: "tester", leadPhone }),
      });
      if (!res.ok) throw new Error("Token error");
      const { token, url } = await res.json();
      setConnectionDetails({ token, url });
    } catch {
      setConnecting(false);
      setError(true);
    }
  }

  function handleDisconnect() {
    setConnectionDetails(null);
    setConnecting(false);
  }

  if (!connectionDetails) {
    return (
      <Stage
        hero={hero}
        footer={footer}
        dict={dict}
        connected={false}
        transcript={[]}
        transcriptRef={idleTranscriptRef}
        orb={<VoiceOrb  connecting={connecting} />}
        control={
          <div className="flex flex-col items-center gap-3">
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
            {error && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 px-3 py-2 text-sm">
                {dict.livekit.errorGeneric}
              </p>
            )}
          </div>
        }
        status={null}
      />
    );
  }

  return (
    <LiveKitRoom
      className="flex flex-col flex-1 min-h-0"
      token={connectionDetails.token}
      serverUrl={connectionDetails.url}
      connect
      audio
      video={false}
      onDisconnected={handleDisconnect}
      onError={() => handleDisconnect()}
    >
      <RoomAudioRenderer />
      <VoiceControls onDisconnect={handleDisconnect} dict={dict} hero={hero} footer={footer} />
    </LiveKitRoom>
  );
}
