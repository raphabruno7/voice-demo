import { supabase } from "@/lib/supabase";
import type { Dict } from "@/lib/i18n/dictionaries";

export const revalidate = 60;

export default async function CallStats({ dict }: { dict: Dict["widgets"]["callStats"] }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  const { data: calls } = await supabase
    .from("calls")
    .select("duration_sec, language, intent")
    .not("ended_at", "is", null);

  const total = calls?.length ?? 0;
  if (total === 0) return null;

  const ptCount = calls?.filter((c) => c.language === "pt").length ?? 0;
  const enCount = calls?.filter((c) => c.language === "en").length ?? 0;
  const qualified = calls?.filter((c) => c.intent === "qualified" || c.intent === "booked").length ?? 0;
  const booked = calls?.filter((c) => c.intent === "booked").length ?? 0;

  const avgSec =
    Math.round(
      (calls?.reduce((sum, c) => sum + (c.duration_sec ?? 0), 0) ?? 0) / total
    );
  const avgMin = Math.floor(avgSec / 60);
  const avgSecRem = avgSec % 60;

  return (
    <div className="mt-10 space-y-3">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-3xl font-bold text-white">{total}</p>
          <p className="text-sm text-zinc-400 mt-1">{dict.callsReceived}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-3xl font-bold text-white">
            {total > 0 ? Math.round((ptCount / total) * 100) : 0}%
            <span className="text-base font-normal text-zinc-400 ml-1">PT</span>
            {" / "}
            {total > 0 ? Math.round((enCount / total) * 100) : 0}%
            <span className="text-base font-normal text-zinc-400 ml-1">EN</span>
          </p>
          <p className="text-sm text-zinc-400 mt-1">{dict.languages}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-3xl font-bold text-white">
            {avgMin}:{String(avgSecRem).padStart(2, "0")}
          </p>
          <p className="text-sm text-zinc-400 mt-1">{dict.avgDuration}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <p className="text-3xl font-bold text-emerald-400">{qualified}</p>
          <p className="text-sm text-zinc-400 mt-1">{dict.qualifiedLeads}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <p className="text-3xl font-bold text-emerald-400">{booked}</p>
          <p className="text-sm text-zinc-400 mt-1">{dict.appointmentsBooked}</p>
        </div>
      </div>
    </div>
  );
}
