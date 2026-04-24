import { supabase } from "@/lib/supabase";

export const revalidate = 60;

export default async function CallStats() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  const { data: calls } = await supabase
    .from("calls")
    .select("duration_sec, language")
    .not("ended_at", "is", null);

  const total = calls?.length ?? 0;
  const ptCount = calls?.filter((c) => c.language === "pt").length ?? 0;
  const enCount = calls?.filter((c) => c.language === "en").length ?? 0;
  const avgSec =
    total > 0
      ? Math.round(
          (calls?.reduce((sum, c) => sum + (c.duration_sec ?? 0), 0) ?? 0) / total
        )
      : 0;
  const avgMin = Math.floor(avgSec / 60);
  const avgSecRem = avgSec % 60;

  if (total === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-4 mt-10 text-center">
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <p className="text-3xl font-bold text-white">{total}</p>
        <p className="text-sm text-zinc-400 mt-1">chamadas recebidas</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <p className="text-3xl font-bold text-white">
          {total > 0 ? Math.round((ptCount / total) * 100) : 0}%
          <span className="text-base font-normal text-zinc-400 ml-1">PT</span>
          {" / "}
          {total > 0 ? Math.round((enCount / total) * 100) : 0}%
          <span className="text-base font-normal text-zinc-400 ml-1">EN</span>
        </p>
        <p className="text-sm text-zinc-400 mt-1">idiomas</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <p className="text-3xl font-bold text-white">
          {avgMin}:{String(avgSecRem).padStart(2, "0")}
        </p>
        <p className="text-sm text-zinc-400 mt-1">duração média</p>
      </div>
    </div>
  );
}
