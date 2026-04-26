"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface PhoneNumberProps {
  number: string;
}

export default function PhoneNumber({ number }: PhoneNumberProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-4 mt-8">
      <a
        href={`tel:${number.replace(/\s/g, "")}`}
        className="text-3xl font-bold tracking-widest text-white hover:text-emerald-400 transition-colors"
      >
        {number}
      </a>
      <Button
        onClick={copy}
        variant="outline"
        className="border-white/20 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
      >
        {copied ? "Copiado!" : "Copiar número"}
      </Button>
    </div>
  );
}
