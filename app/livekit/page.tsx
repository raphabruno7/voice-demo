export const dynamic = "force-dynamic";

import { Badge } from "@/components/ui/badge";
import GeminiLiveWidget from "@/components/GeminiLiveWidget";

export default function LiveKitPage() {
  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full text-center">
        <Badge
          variant="outline"
          className="border-violet-500/40 text-violet-400 bg-violet-500/10 mb-6"
        >
          Teste · Gemini Live
        </Badge>

        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight uppercase tracking-wide">
          Gemini Live{" "}
          <span className="text-violet-400">via LiveKit</span>
        </h1>

        <p className="mt-4 text-zinc-400 text-lg leading-relaxed">
          Agente de voz com{" "}
          <strong className="text-white">Google Gemini Live</strong> — teste de qualidade de voz e latência em browser, antes de ligar ao telefone.
        </p>

        <p className="mt-4 text-zinc-500 text-sm">
          Powered by Gemini 2.0 Flash · LiveKit · Ana pt-PT
        </p>

        <GeminiLiveWidget />

        <div className="mt-16 border-t border-white/10 pt-8 text-sm text-zinc-500">
          <a href="/" className="hover:text-zinc-300 transition-colors">
            ← Voltar ao Hume EVI
          </a>
        </div>
      </div>
    </main>
  );
}
