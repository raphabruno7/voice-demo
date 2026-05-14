import { NextRequest, NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { detectLanguage, extractIntent } from "@/lib/vapi";

const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const authHeader = req.headers.get("Authorization") ?? "";

  let event;
  try {
    event = await receiver.receive(body, authHeader);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (event.event === "room_started" && event.room) {
    await supabaseAdmin.from("calls").insert({
      call_id: event.room.name,
      started_at: new Date(Number(event.createdAt ?? 0) * 1000).toISOString(),
      caller_number: null,
    });
  }

  if (event.event === "room_finished" && event.room) {
    const meta = event.room.metadata ? JSON.parse(event.room.metadata) : {};
    const transcript: string = meta.transcript ?? "";
    const summary: string = meta.summary ?? "";
    const startMs = Number(event.createdAt ?? 0) * 1000;
    const duration = startMs > 0 ? Math.round((Date.now() - startMs) / 1000) : 0;

    await supabaseAdmin.from("calls").update({
      ended_at: new Date().toISOString(),
      duration_sec: duration,
      transcript,
      summary,
      language: detectLanguage(transcript),
      intent: extractIntent(summary),
    }).eq("call_id", event.room.name);
  }

  return NextResponse.json({ ok: true });
}
