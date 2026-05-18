import { Suspense } from "react";

export const dynamic = "force-dynamic";
import { Badge } from "@/components/ui/badge";
import CallStats from "@/components/CallStats";
import PhoneNumber from "@/components/PhoneNumber";
import CallMeForm from "@/components/CallMeForm";
import QRCodeImage from "@/components/QRCode";
import HumeWidget from "@/components/HumeWidget";

const PHONE_NUMBER = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "+351 000 000 000";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full text-center">
        <Badge
          variant="outline"
          className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 mb-6"
        >
          Live Demo · Available Now
        </Badge>

        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight uppercase tracking-wide">
          Talk to an AI Agent{" "}
          <span className="text-emerald-400">live, right now</span>
        </h1>

        <p className="mt-4 text-zinc-400 text-lg leading-relaxed">
          Call the number below and chat with{" "}
          <strong className="text-white">Ana</strong>, a bilingual AI voice
          agent (PT / EN). A real-world demo of AI automation built by{" "}
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

        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 mt-8">
          <PhoneNumber number={PHONE_NUMBER} />
          <QRCodeImage phoneNumber={PHONE_NUMBER} />
        </div>

        <p className="mt-4 text-zinc-500 text-sm">
          Powered by Hume EVI 3 · Claude Sonnet 4
        </p>

        <HumeWidget />

        <CallMeForm />

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
