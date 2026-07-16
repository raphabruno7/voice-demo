import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-metrics-secret');
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { callId, turns } = (await req.json()) as {
    callId?: string;
    turns?: { e2eLatencyMs: number }[];
  };
  if (!callId || !turns?.length) {
    return NextResponse.json({ success: false, error: 'callId and turns required' }, { status: 200 });
  }

  const { error } = await getSupabaseAdmin()
    .from('turn_metrics')
    .insert(turns.map((t) => ({ call_id: callId, e2e_latency_ms: t.e2eLatencyMs })));

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 200 });
  }

  return NextResponse.json({ success: true });
}
