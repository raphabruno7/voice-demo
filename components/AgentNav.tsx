"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const agents = [
  { label: "Hume EVI", href: "/" },
  { label: "Gemini Live", href: "/livekit" },
  { label: "ElevenLabs", href: "/elevenlabs" },
];

export default function AgentNav() {
  const pathname = usePathname();

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
    </nav>
  );
}
