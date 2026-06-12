"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Lang } from "@/lib/i18n/lang";
import type { Dict } from "@/lib/i18n/dictionaries";
import LanguageToggle from "@/components/LanguageToggle";

export default function AgentNav({ lang, dict }: { lang: Lang; dict: Dict["nav"] }) {
  const pathname = usePathname();

  const agents = [
    { label: dict.portfolio, href: "/" },
    { label: dict.hume, href: "/hume" },
    { label: dict.livekit, href: "/livekit" },
    { label: dict.elevenlabs, href: "/elevenlabs" },
  ];

  return (
    <nav className="fixed top-4 right-4 z-50 flex items-center gap-1 text-sm">
      {agents.map(({ label, href }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={[
              "px-3 py-1.5 rounded-full transition-colors duration-150",
              active
                ? "text-white font-semibold bg-white/10"
                : "text-zinc-500 hover:text-zinc-300",
            ].join(" ")}
          >
            {label}
          </Link>
        );
      })}
      <span className="text-zinc-700">·</span>
      <LanguageToggle lang={lang} label={dict.langToggleLabel} />
    </nav>
  );
}
