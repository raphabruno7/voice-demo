import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { detectLanguage, extractIntent, type VapiEvent } from "@/lib/vapi";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-vapi-secret");
  if (secret !== process.env.VAPI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: VapiEvent = await req.json();
  const type = body.message.type;

  if (type === "call-started") {
    const { call } = body.message;
    await supabaseAdmin.from("calls").insert({
      call_id: call.id,
      started_at: call.startedAt,
      caller_number: call.customer?.number ?? null,
    });
  }

  if (type === "end-of-call-report") {
    const { call, durationSeconds, transcript, summary } = body.message;
    const language = detectLanguage(transcript);
    const intent = extractIntent(summary);
    await supabaseAdmin
      .from("calls")
      .update({
        ended_at: call.endedAt,
        duration_sec: Math.round(durationSeconds),
        transcript,
        summary,
        language,
        intent,
      })
      .eq("call_id", call.id);
  }

  return NextResponse.json({ ok: true });
}
