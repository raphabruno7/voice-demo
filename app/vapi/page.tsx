export const dynamic = "force-dynamic";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import VapiWidget from "@/components/VapiWidget";
import { getLang } from "@/lib/i18n/lang";
import { dictionaries } from "@/lib/i18n/dictionaries";

export default async function VapiPage() {
  const lang = await getLang();
  const dict = dictionaries[lang];

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full text-center">
        <Badge variant="outline" className="border-sky-500/40 text-sky-400 bg-sky-500/10 mb-6">
          {dict.vapi.badge}
        </Badge>

        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight uppercase tracking-wide">
          {dict.vapi.title} <span className="text-sky-400">{dict.vapi.titleHighlight}</span>
        </h1>

        <p className="mt-4 text-zinc-400 text-lg leading-relaxed">
          {dict.vapi.descBefore} <strong className="text-white">{dict.vapi.descBold}</strong> {dict.vapi.descAfter}
        </p>

        <p className="mt-4 text-zinc-500 text-sm">{dict.vapi.powered}</p>

        <VapiWidget dict={{ common: dict.widgets.common, vapi: dict.widgets.vapi }} />

        <div className="mt-16 border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-300 transition-colors">{dict.vapi.back}</Link>
          <span className="hidden sm:inline">·</span>
          <a href="mailto:work@raphaelbruno.dev" className="hover:text-zinc-300 transition-colors">work@raphaelbruno.dev</a>
          <span className="hidden sm:inline">·</span>
          <a href="https://upwork.com/freelancers/raphabruno7" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">Upwork</a>
          <span className="hidden sm:inline">·</span>
          <a href="https://linkedin.com/in/raphabruno7" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">LinkedIn</a>
        </div>
      </div>
    </main>
  );
}
