import { Suspense } from "react";

export const dynamic = "force-dynamic";
import { Badge } from "@/components/ui/badge";
import CallStats from "@/components/CallStats";
import PhoneNumber from "@/components/PhoneNumber";
import CallMeForm from "@/components/CallMeForm";
import QRCodeImage from "@/components/QRCode";
import HumeWidget from "@/components/HumeWidget";
import { getLang } from "@/lib/i18n/lang";
import { dictionaries } from "@/lib/i18n/dictionaries";

const PHONE_NUMBER = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "+351 000 000 000";

export default async function HumePage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; name?: string }>;
}) {
  const params = await searchParams;
  const caller = {
    phone: params.phone?.trim() || undefined,
    name: params.name?.trim() || undefined,
  };

  const lang = await getLang();
  const dict = dictionaries[lang];

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full text-center">
        <Badge
          variant="outline"
          className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 mb-6"
        >
          {dict.hume.badge}
        </Badge>

        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight uppercase tracking-wide">
          {dict.hume.title}{" "}
          <span className="text-emerald-400">{dict.hume.titleHighlight}</span>
        </h1>

        <p className="mt-4 text-zinc-400 text-lg leading-relaxed">
          {dict.hume.descBefore}{" "}
          <strong className="text-white">{dict.hume.descBold}</strong>
          {dict.hume.descMiddle}{" "}
          <a
            href="https://raphaelbruno.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            Raphael Bruno
          </a>
          {dict.hume.descEnd}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 mt-8">
          <PhoneNumber number={PHONE_NUMBER} dict={dict.widgets.phoneNumber} />
          <QRCodeImage phoneNumber={PHONE_NUMBER} dict={dict.widgets.qrCode} />
        </div>

        <p className="mt-4 text-zinc-500 text-sm">
          {dict.hume.powered}
        </p>

        <HumeWidget caller={caller} dict={{ common: dict.widgets.common, hume: dict.widgets.hume }} />

        <CallMeForm dict={dict.widgets.callMe} />

        <Suspense fallback={null}>
          <CallStats dict={dict.widgets.callStats} />
        </Suspense>

        <div className="mt-16 border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-zinc-500">
          <a href="/" className="hover:text-zinc-300 transition-colors">
            {dict.hume.back}
          </a>
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
