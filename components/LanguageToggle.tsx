"use client";

import type { Lang } from "@/lib/i18n/lang";

export default function LanguageToggle({ lang, label }: { lang: Lang; label: string }) {
  function toggle() {
    const next: Lang = lang === "pt" ? "en" : "pt";
    document.cookie = `lang=${next}; path=/; max-age=31536000`;
    window.location.reload();
  }

  return (
    <button
      onClick={toggle}
      className="px-3 py-1.5 rounded-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
    >
      {label}
    </button>
  );
}
