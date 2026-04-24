import { Suspense } from "react";

export const dynamic = "force-dynamic";
import { Badge } from "@/components/ui/badge";
import CallStats from "@/components/CallStats";
import PhoneNumber from "@/components/PhoneNumber";

const PHONE_NUMBER = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "+351 000 000 000";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full text-center">
        <Badge
          variant="outline"
          className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 mb-6"
        >
          Live Demo · Disponível agora
        </Badge>

        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
          Fala com um Agente de IA —{" "}
          <span className="text-emerald-400">ao vivo, agora</span>
        </h1>

        <p className="mt-4 text-zinc-400 text-lg leading-relaxed">
          Liga para o número abaixo e conversa com{" "}
          <strong className="text-white">Aria</strong>, um agente de voz com IA
          bilíngue (PT / EN). Demonstração real de automação com inteligência
          artificial construída por{" "}
          <a
            href="https://raphaelbruno.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            Raphael Bruno
          </a>
          .
        </p>

        <PhoneNumber number={PHONE_NUMBER} />

        <p className="mt-4 text-zinc-500 text-sm">
          Powered by Vapi · Groq · Llama 3.3 · Twilio
        </p>

        <Suspense fallback={null}>
          <CallStats />
        </Suspense>

        <div className="mt-16 border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-zinc-500">
          <a
            href="mailto:raphaelbruno.dev@gmail.com"
            className="hover:text-zinc-300 transition-colors"
          >
            raphaelbruno.dev@gmail.com
          </a>
          <span className="hidden sm:inline">·</span>
          <a
            href="https://linkedin.com/in/raphabruno7"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-300 transition-colors"
          >
            LinkedIn
          </a>
          <span className="hidden sm:inline">·</span>
          <a
            href="https://upwork.com/freelancers/raphabruno7"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-300 transition-colors"
          >
            Upwork
          </a>
        </div>
      </div>
    </main>
  );
}
