"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { NICHES, NICHE_KEYS } from "@/lib/niches";

export default function NicheSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeNiche = searchParams.get("niche") ?? null;

  // Pills: niches + "Todos"
  const pills = [
    ...NICHE_KEYS.map(key => ({
      key,
      label: NICHES[key]?.label ?? key
    })),
    { key: null, label: "Todos" }
  ];

  return (
    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
      {pills.map(pill => (
        <button
          key={pill.key ?? "all"}
          onClick={() => router.push(pill.key ? `/?niche=${pill.key}` : "/")}
          className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
            activeNiche === pill.key
              ? "bg-zinc-700 text-white"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {pill.label}
        </button>
      ))}
    </div>
  );
}
