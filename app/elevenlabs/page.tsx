export const dynamic = "force-dynamic";

import { Badge } from "@/components/ui/badge";
import ElevenLabsWidget from "@/components/ElevenLabsWidget";
import { getLang } from "@/lib/i18n/lang";
import { dictionaries } from "@/lib/i18n/dictionaries";

export default async function ElevenLabsPage() {
  const lang = await getLang();
  const dict = dictionaries[lang];

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

        <p className="mt-4 text-zinc-500 text-sm">
          {dict.elevenlabs.powered}
        </p>

        <ElevenLabsWidget dict={{ common: dict.widgets.common, elevenlabs: dict.widgets.elevenlabs }} />

        <div className="mt-16 border-t border-white/10 pt-8 text-sm text-zinc-500">
          <a href="/" className="hover:text-zinc-300 transition-colors">
            {dict.elevenlabs.back}
          </a>
        </div>
      </div>
    </main>
  );
}
