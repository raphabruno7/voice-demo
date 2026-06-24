import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getLang } from "@/lib/i18n/lang";
import { dictionaries } from "@/lib/i18n/dictionaries";
import NicheSelector from "@/components/NicheSelector";
import { NICHE_KEYS, NICHES } from "@/lib/niches";

export const dynamic = "force-dynamic";

const colorClasses: Record<
  string,
  { border: string; bg: string; text: string; button: string; badge: string }
> = {
  emerald: {
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/5",
    text: "text-emerald-400",
    button: "bg-emerald-500 text-zinc-950 hover:bg-emerald-400",
    badge: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
  },
  violet: {
    border: "border-violet-500/20",
    bg: "bg-violet-500/5",
    text: "text-violet-400",
    button: "bg-violet-500 text-zinc-950 hover:bg-violet-400",
    badge: "border-violet-500/40 text-violet-400 bg-violet-500/10",
  },
  amber: {
    border: "border-amber-500/20",
    bg: "bg-amber-500/5",
    text: "text-amber-400",
    button: "bg-amber-500 text-zinc-950 hover:bg-amber-400",
    badge: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  },
  sky: {
    border: "border-sky-500/20", bg: "bg-sky-500/5", text: "text-sky-400",
    button: "bg-sky-500 text-zinc-950 hover:bg-sky-400",
    badge: "border-sky-500/40 text-sky-400 bg-sky-500/10",
  },
  fuchsia: {
    border: "border-fuchsia-500/20", bg: "bg-fuchsia-500/5", text: "text-fuchsia-400",
    button: "bg-fuchsia-500 text-zinc-950 hover:bg-fuchsia-400",
    badge: "border-fuchsia-500/40 text-fuchsia-400 bg-fuchsia-500/10",
  },
  rose: {
    border: "border-rose-500/20", bg: "bg-rose-500/5", text: "text-rose-400",
    button: "bg-rose-500 text-zinc-950 hover:bg-rose-400",
    badge: "border-rose-500/40 text-rose-400 bg-rose-500/10",
  },
};

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const lang = await getLang();
  const dict = dictionaries[lang];

  // Read niche from searchParams
  const niche = searchParams?.niche ?? null;
  const isValidNiche = niche && typeof niche === "string" ? NICHE_KEYS.includes(niche) : false;

  const stacks = [
    { href: "/hume", color: "emerald", ...dict.gallery.stacks.hume },
    { href: "/livekit", color: "violet", ...dict.gallery.stacks.livekit },
    { href: "/elevenlabs", color: "amber", ...dict.gallery.stacks.elevenlabs },
    { href: "/vapi", color: "sky", ...dict.gallery.stacks.vapi },
    { href: "/retell", color: "fuchsia", ...dict.gallery.stacks.retell },
    { href: "/twilio", color: "rose", ...dict.gallery.stacks.twilio },
  ].map(stack => ({
    ...stack,
    href: isValidNiche ? `${stack.href}?niche=${niche}` : stack.href,
  }));

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-3xl w-full text-center">
        <Badge
          variant="outline"
          className="border-white/20 text-zinc-300 bg-white/5 mb-6"
        >
          {dict.gallery.badge}
        </Badge>

        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight uppercase tracking-wide">
          {dict.gallery.title}{" "}
          <span className="text-zinc-400">{dict.gallery.titleHighlight}</span>
        </h1>

        <p className="mt-4 text-zinc-400 text-lg leading-relaxed max-w-2xl mx-auto">
          {dict.gallery.introBefore}{" "}
          <a
            href="https://raphaelbruno.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-200 hover:underline"
          >
            Raphael Bruno
          </a>
          {dict.gallery.introAfter}
        </p>

        <div className="mt-8 mb-8">
          <NicheSelector />
        </div>

        {isValidNiche && (
          <div className="mb-8 text-center">
            <Badge
              variant="outline"
              className="border-white/30 text-zinc-200 bg-white/10 mb-3"
            >
              Demo configurado para: {NICHES[niche as string].label}
            </Badge>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl mx-auto">
              {NICHES[niche as string].pain_one_liner_pt}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
          {stacks.map((stack) => {
            const c = colorClasses[stack.color];
            return (
              <div
                key={stack.href}
                className={`rounded-xl border ${c.border} ${c.bg} p-6 flex flex-col text-left`}
              >
                <Badge
                  variant="outline"
                  className={`${c.badge} mb-4 self-start`}
                >
                  {stack.badge}
                </Badge>

                <h2 className="text-lg font-semibold text-white">
                  {stack.title}
                </h2>

                <p className="mt-2 text-sm text-zinc-400 leading-relaxed flex-1">
                  {stack.description}
                </p>

                <p className="mt-3 text-xs text-zinc-500">{stack.powered}</p>

                <Link
                  href={stack.href}
                  className={`mt-5 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${c.button}`}
                >
                  {dict.gallery.cta}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-16 border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-zinc-500">
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
