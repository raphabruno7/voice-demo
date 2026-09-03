export const dynamic = "force-dynamic";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import GeminiLiveWidget from "@/components/GeminiLiveWidget";
import { getLang } from "@/lib/i18n/lang";
import { dictionaries } from "@/lib/i18n/dictionaries";

export default async function LiveKitPage() {
  const lang = await getLang();
  const dict = dictionaries[lang];

  const hero = (
    <div className="text-left">
      <Badge
        variant="outline"
        className="border-violet-500/40 text-violet-400 bg-violet-500/10 mb-4"
      >
        {dict.livekit.badge}
      </Badge>

      <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight uppercase tracking-wide">
        {dict.livekit.title}{" "}
        <span className="text-violet-400">{dict.livekit.titleHighlight}</span>
      </h1>

      <p className="mt-3 text-zinc-400 leading-relaxed">
        {dict.livekit.descBefore}{" "}
        <strong className="text-white">{dict.livekit.descBold}</strong> {dict.livekit.descAfter}
      </p>
    </div>
  );

  const footer = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Link href="/" className="hover:text-zinc-300 transition-colors">
        {dict.livekit.back}
      </Link>
      <span>·</span>
      <a href="mailto:work@raphaelbruno.dev" className="hover:text-zinc-300 transition-colors">
        work@raphaelbruno.dev
      </a>
      <span>·</span>
      <a
        href="https://upwork.com/freelancers/raphabruno7"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-zinc-300 transition-colors"
      >
        Upwork
      </a>
      <span>·</span>
      <a
        href="https://linkedin.com/in/raphabruno7"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-zinc-300 transition-colors"
      >
        LinkedIn
      </a>
    </div>
  );

  return (
    <main className="min-h-[100dvh] lg:h-[100dvh] lg:overflow-hidden bg-zinc-950 flex flex-col">
      <GeminiLiveWidget
        dict={{ common: dict.widgets.common, livekit: dict.widgets.livekit }}
        hero={hero}
        footer={footer}
      />
    </main>
  );
}
