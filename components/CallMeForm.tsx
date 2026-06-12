"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Dict } from "@/lib/i18n/dictionaries";

export default function CallMeForm({ dict }: { dict: Dict["widgets"]["callMe"] }) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const res = await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: phone }),
    });

    setStatus(res.ok ? "success" : "error");
  }

  return (
    <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-6 text-left">
      <h2 className="text-white font-semibold text-lg mb-1">
        {dict.heading}
      </h2>
      <p className="text-zinc-400 text-sm mb-4">
        {dict.description}
      </p>

      {status === "success" ? (
        <p className="text-emerald-400 font-medium">{dict.success}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="tel"
            placeholder={dict.placeholder}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="flex-1 rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <Button
            type="submit"
            disabled={status === "loading"}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
          >
            {status === "loading" ? dict.calling : dict.button}
          </Button>
        </form>
      )}

      {status === "error" && (
        <p className="text-red-400 text-sm mt-2">{dict.error}</p>
      )}
    </div>
  );
}
