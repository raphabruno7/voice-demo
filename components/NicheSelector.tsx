"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ACTIVE_NICHES, NICHES } from "@/lib/niches";

export default function NicheSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeNiche = searchParams.get("niche") ?? null;

  const [searchText, setSearchText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Filter niches by search text
  const filtered = ACTIVE_NICHES.filter(key =>
    NICHES[key].label.toLowerCase().includes(searchText.toLowerCase()) ||
    key.toLowerCase().includes(searchText.toLowerCase())
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (niche: string | null) => {
    router.push(niche ? `/?niche=${niche}` : "/");
    setSearchText("");
    setIsOpen(false);
  };

  return (
    <div ref={ref} className="relative w-full max-w-xs mx-auto">
      <div className="relative">
        <input
          type="text"
          placeholder="Procura um sector..."
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        />
        {activeNiche && searchText === "" && (
          <div className="absolute right-3 top-2 text-xs text-zinc-400">
            {NICHES[activeNiche].label}
          </div>
        )}
      </div>

      {isOpen && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          <button
            onClick={() => handleSelect(null)}
            className="w-full text-left px-4 py-2 text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Todos os sectores
          </button>
          {filtered.map((key) => (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              className={`w-full text-left px-4 py-2 transition-colors ${
                activeNiche === key
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <div className="font-medium">{NICHES[key].label}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{NICHES[key].pain_one_liner_pt}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
