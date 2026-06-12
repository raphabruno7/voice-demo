export const dynamic = "force-dynamic";

import { Badge } from "@/components/ui/badge";
import ElevenLabsWidget from "@/components/ElevenLabsWidget";

export default function ElevenLabsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full text-center">
        <Badge
          variant="outline"
          className="border-amber-500/40 text-amber-400 bg-amber-500/10 mb-6"
        >
          Teste · ElevenLabs ConvAI
        </Badge>

        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight uppercase tracking-wide">
          ElevenLabs{" "}
          <span className="text-amber-400">Conversational AI</span>
        </h1>

        <p className="mt-4 text-zinc-400 text-lg leading-relaxed">
          Agente de voz com{" "}
          <strong className="text-white">ElevenLabs Conversational AI</strong> — pipeline STT+LLM+TTS com voz nativa pt-PT, ideal para quem já usa o ecossistema ElevenLabs.
        </p>

        <p className="mt-4 text-zinc-500 text-sm">
          Powered by ElevenLabs ConvAI · Voz pt-PT
        </p>

        <ElevenLabsWidget />

        <div className="mt-16 border-t border-white/10 pt-8 text-sm text-zinc-500">
          <a href="/" className="hover:text-zinc-300 transition-colors">
            ← Voltar ao Hume EVI
          </a>
        </div>
      </div>
    </main>
  );
}
