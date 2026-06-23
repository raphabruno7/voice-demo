export const dynamic = "force-dynamic";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import ElevenLabsWidget from "@/components/ElevenLabsWidget";
import { getLang } from "@/lib/i18n/lang";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { NICHES, NICHE_KEYS } from "@/lib/niches";

export default async function ElevenLabsPage({
  searchParams,
}: {
  searchParams: Promise<{ niche?: string }>;
}) {
  const params = await searchParams;
  const lang = await getLang();
  const dict = dictionaries[lang];

  const niche = params.niche?.trim();
  const isValidNiche = niche && NICHE_KEYS.includes(niche);

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full text-center">
        <Badge
          variant="outline"
          className="border-amber-500/40 text-amber-400 bg-amber-500/10 mb-6"
        >
          {dict.elevenlabs.badge}
        </Badge>

        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight uppercase tracking-wide">
          {dict.elevenlabs.title}{" "}
          <span className="text-amber-400">{dict.elevenlabs.titleHighlight}</span>
        </h1>

        <p className="mt-4 text-zinc-400 text-lg leading-relaxed">
          {dict.elevenlabs.descBefore}{" "}
          <strong className="text-white">{dict.elevenlabs.descBold}</strong> {dict.elevenlabs.descAfter}
        </p>

        {isValidNiche && (
          <div className="mt-4 text-center">
            <p className="text-sm border border-zinc-600/40 text-zinc-400 rounded-lg px-3 py-2 inline-block">
              Para: <strong>{NICHES[niche].label}</strong> · {NICHES[niche].pain_one_liner_pt}
            </p>
          </div>
        )}

        <p className="mt-4 text-zinc-500 text-sm">
          {dict.elevenlabs.powered}
        </p>

        <ElevenLabsWidget dict={{ common: dict.widgets.common, elevenlabs: dict.widgets.elevenlabs }} />

        <div className="mt-16 border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-300 transition-colors">
            {dict.elevenlabs.back}
          </Link>
          <span className="hidden sm:inline">·</span>
          <a
            href="mailto:work@raphaelbruno.dev"
            className="hover:text-zinc-300 transition-colors"
          >
            work@raphaelbruno.dev
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
          <span className="hidden sm:inline">·</span>
          <a
            href="https://linkedin.com/in/raphabruno7"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-300 transition-colors"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </main>
  );
}
