"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  VoiceProvider,
  useVoice,
  type AssistantTranscriptMessage,
  type JSONMessage,
  type UserTranscriptMessage,
} from "@humeai/voice-react";

type CallState = "idle" | "permission" | "connecting" | "active" | "ending" | "error";

type TranscriptEntry = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type CallerContext = {
  phone?: string;
  name?: string;
};

function buildContextText(caller: CallerContext | undefined): string {
  const base =
    "A conversa decorre em português europeu de Portugal (pt-PT). " +
    "Se a transcrição do utilizador parecer truncada, em outra língua, ou sem sentido, " +
    "responde em pt-PT a pedir gentilmente para repetir — não tentes adivinhar. " +
    "Nunca respondas em russo, francês, espanhol ou outra língua só porque a transcrição apareceu nessa forma; " +
    "o utilizador está sempre a falar em português.";
  const parts: string[] = [base];
  if (caller?.name) parts.push(`Já sabes o nome do utilizador: ${caller.name}. NÃO perguntes o nome — usa-o naturalmente.`);
  if (caller?.phone) parts.push(`Já sabes o telefone do utilizador: ${caller.phone}. NÃO perguntes o telefone — usa-o directamente no book_meeting.`);
  return parts.join(" ");
}

const DEBUG = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");

function log(...args: unknown[]) {
  if (DEBUG) console.log("[HumeWidget]", ...args);
}

async function fetchToken(): Promise<string | null> {
  try {
    const r = await fetch("/api/hume/access-token", { method: "POST" });
    if (!r.ok) {
      const body = await r.text();
      console.error("[HumeWidget] token fetch failed", r.status, body);
      return null;
    }
    const d = (await r.json()) as { accessToken?: string };
    return d.accessToken ?? null;
  } catch (e) {
    console.error("[HumeWidget] token fetch error", e);
    return null;
  }
}

async function ensureMicPermission(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: "Browser sem suporte a microfone" };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return { ok: true };
  } catch (e) {
    const name = e instanceof Error ? e.name : "Unknown";
    const map: Record<string, string> = {
      NotAllowedError: "Permissão de microfone negada",
      NotFoundError: "Nenhum microfone encontrado",
      NotReadableError: "Microfone em uso por outra aplicação",
    };
    return { ok: false, reason: map[name] ?? "Falha a aceder ao microfone" };
  }
}

function FftBars({ values }: { values: number[] }) {
  const bars = values.length ? values.slice(0, 24) : Array.from({ length: 24 }, () => 0);
  return (
    <div className="flex items-end gap-[2px] h-8" aria-hidden>
      {bars.map((v, i) => {
        const h = Math.max(2, Math.min(32, v * 64));
        return (
          <span
            key={i}
            className="w-[3px] rounded-sm bg-emerald-400/70"
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
}

function WidgetInner({ state, setState, setError, transcript, setTranscript, caller }: {
  state: CallState;
  setState: (s: CallState) => void;
  setError: (s: string | null) => void;
  transcript: TranscriptEntry[];
  setTranscript: React.Dispatch<React.SetStateAction<TranscriptEntry[]>>;
  caller?: CallerContext;
}) {
  const { connect, disconnect, status, isPlaying, micFft, error, readyState, messages } = useVoice();
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    log("status", status);
    if (status.value === "connected") setState("active");
    else if (status.value === "disconnected" && state !== "idle") setState("idle");
    else if (status.value === "error") {
      setError(status.reason ?? "Erro de conexão");
      setState("error");
    }
  }, [status, setState, setError, state]);

  useEffect(() => {
    log("readyState", readyState);
  }, [readyState]);

  useEffect(() => {
    if (error) {
      log("voice error", error);
      setError(error.message ?? "Erro");
    }
  }, [error, setError]);

  // Build transcript live from messages stream
  useEffect(() => {
    if (!messages?.length) return;
    const latest = messages[messages.length - 1];
    log("msg", (latest as JSONMessage).type, latest);

    const m = latest as JSONMessage;
    if (m.type === "user_message") {
      const um = m as UserTranscriptMessage;
      // Skip interim transcripts — Hume streams partials until finalized;
      // we only want the final one to avoid duplicates in the UI.
      if (um.interim) return;
      const text = um.message?.content ?? "";
      if (text) {
        setTranscript((prev) => [
          ...prev,
          { id: `u-${um.receivedAt.getTime()}`, role: "user", text },
        ]);
      }
    } else if (m.type === "assistant_message") {
      const am = m as AssistantTranscriptMessage;
      const text = am.message?.content ?? "";
      if (text) {
        setTranscript((prev) => [
          ...prev,
          { id: `a-${am.receivedAt.getTime()}`, role: "assistant", text },
        ]);
      }
    }
  }, [messages, setTranscript]);

  async function startCall() {
    setError(null);
    setTranscript([]);
    setState("permission");
    const mic = await ensureMicPermission();
    if (!mic.ok) {
      setError(mic.reason);
      setState("error");
      return;
    }

    setState("connecting");
    const token = await fetchToken();
    if (!token) {
      setError("Não foi possível obter token de acesso");
      setState("error");
      return;
    }

    try {
      await connect({
        auth: { type: "accessToken", value: token },
        configId: process.env.NEXT_PUBLIC_HUME_CONFIG_ID,
        audioConstraints: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        sessionSettings: {
          type: "session_settings",
          context: {
            text: buildContextText(caller),
            type: "persistent",
          },
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("connect failed", msg);
      setError(`Falha a conectar: ${msg}`);
      setState("error");
    }
  }

  async function endCall() {
    setState("ending");
    try {
      await disconnect();
    } finally {
      setState("idle");
    }
  }

  const isActive = state === "active";
  const isBusy = state === "connecting" || state === "ending" || state === "permission";

  const label =
    state === "idle" ? "Falar com a Ana" :
    state === "permission" ? "A pedir microfone…" :
    state === "connecting" ? "A ligar…" :
    state === "active" ? "Terminar chamada" :
    state === "ending" ? "A desligar…" :
    "Tentar novamente";

  const subLabel =
    state === "active"
      ? isPlaying ? "Ana está a falar…" : "À escuta…"
      : null;

  return (
    <div className="mt-8 flex flex-col items-center gap-3 w-full max-w-xl mx-auto">
      <button
        onClick={isActive ? endCall : startCall}
        disabled={isBusy}
        aria-busy={isBusy}
        className={[
          "relative px-8 py-4 rounded-full font-semibold text-base transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950",
          isActive
            ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 focus:ring-red-500"
            : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 focus:ring-emerald-500",
          isBusy ? "opacity-60 cursor-not-allowed" : "",
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
        <div className="flex flex-col items-center gap-2 w-full">
          <FftBars values={micFft} />
          {subLabel && <p className="text-xs text-zinc-500">{subLabel}</p>}
        </div>
      )}

      {transcript.length > 0 && (
        <div
          ref={transcriptRef}
          className="mt-2 w-full max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm space-y-2 scroll-smooth"
        >
          {transcript.map((t) => (
            <p key={t.id} className={t.role === "assistant" ? "text-emerald-300" : "text-zinc-200"}>
              <span className="text-zinc-500 mr-2">{t.role === "assistant" ? "Ana" : "Tu"}:</span>
              {t.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HumeWidget({ caller }: { caller?: CallerContext } = {}) {
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Warm up AudioContext on first user interaction to satisfy Chrome autoplay policy
  useEffect(() => {
    const warm = () => {
      if (audioCtxRef.current) return;
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AC();
        audioCtxRef.current.resume().catch(() => undefined);
      } catch {
        // ignore
      }
    };
    window.addEventListener("pointerdown", warm, { once: true });
    return () => window.removeEventListener("pointerdown", warm);
  }, []);

  const onMessage = useCallback((m: JSONMessage) => log("[provider] message", m.type), []);
  const onError = useCallback((e: { message?: string }) => {
    console.error("[HumeWidget] provider error", e);
    setError(e?.message ?? "Erro desconhecido");
    setState("error");
  }, []);
  const onOpen = useCallback(() => log("[provider] open"), []);
  const onClose = useCallback((e: unknown) => {
    log("[provider] close", e);
  }, []);
  return (
    <VoiceProvider
      onMessage={onMessage}
      onError={onError}
      onOpen={onOpen}
      onClose={onClose}
      enableAudioWorklet
      messageHistoryLimit={200}
    >
      <WidgetInner
        state={state}
        setState={setState}
        setError={setError}
        transcript={transcript}
        setTranscript={setTranscript}
        caller={caller}
      />
      {error && (
        <div className="mt-3 max-w-xl mx-auto rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
    </VoiceProvider>
  );
}
