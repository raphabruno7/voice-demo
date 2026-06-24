import { RoomServiceClient } from 'livekit-server-sdk';
import { getSupabaseAdmin } from '@/lib/supabase';
import { listUpcomingEvents } from '@/lib/google-calendar';
import type { HealthStatus, ServiceCheckResult } from '@/lib/resend';

export type { HealthStatus, ServiceCheckResult };

const TIMEOUT_MS = 5_000;
const DEGRADED_MS = 2_000;

function classify(latency_ms: number, error?: string): HealthStatus {
  if (error) return 'fail';
  if (latency_ms >= DEGRADED_MS) return 'degraded';
  return 'ok';
}

async function timed(
  fn: () => Promise<void>
): Promise<{ latency_ms: number; error?: string }> {
  const start = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
      ),
    ]);
    return { latency_ms: Date.now() - start };
  } catch (e) {
    return {
      latency_ms: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function checkHume(): Promise<ServiceCheckResult> {
  const { latency_ms, error } = await timed(async () => {
    const res = await fetch(
      `https://api.hume.ai/v0/evi/configs/${process.env.NEXT_PUBLIC_HUME_CONFIG_ID}`,
      { headers: { Authorization: `Token ${process.env.HUME_API_KEY}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  return { service: 'Hume EVI', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkLiveKit(): Promise<ServiceCheckResult> {
  const { latency_ms, error } = await timed(async () => {
    const httpUrl = process.env.LIVEKIT_URL!.replace('wss://', 'https://');
    const svc = new RoomServiceClient(
      httpUrl,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );
    await svc.listRooms();
  });
  return { service: 'LiveKit', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkElevenLabs(): Promise<ServiceCheckResult> {
  const { latency_ms, error } = await timed(async () => {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${process.env.ELEVENLABS_AGENT_ID}`,
      { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  return { service: 'ElevenLabs', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkVapi(): Promise<ServiceCheckResult> {
  // Vapi: validar que env vars estão presentes — chave pública não permite chamadas server-side
  const { latency_ms, error } = await timed(async () => {
    if (!process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || !process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID) {
      throw new Error('NEXT_PUBLIC_VAPI_PUBLIC_KEY or NEXT_PUBLIC_VAPI_ASSISTANT_ID not set');
    }
    const res = await fetch(`https://api.vapi.ai/assistant/${process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID}`, {
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY}` },
    });
    // 401 aqui é esperado (chave pública) — confirmamos apenas que o endpoint responde
    if (res.status === 500 || res.status === 502 || res.status === 503) {
      throw new Error(`HTTP ${res.status}`);
    }
  });
  return { service: 'Vapi', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkRetell(): Promise<ServiceCheckResult> {
  const { latency_ms, error } = await timed(async () => {
    const res = await fetch(
      `https://api.retellai.com/v2/get-agent/${process.env.RETELL_AGENT_ID}`,
      { headers: { Authorization: `Bearer ${process.env.RETELL_API_KEY}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  return { service: 'Retell AI', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkTwilio(): Promise<ServiceCheckResult> {
  const { latency_ms, error } = await timed(async () => {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  return { service: 'Twilio', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkGoogleCalendar(): Promise<ServiceCheckResult> {
  const { latency_ms, error } = await timed(async () => {
    await listUpcomingEvents({ timeMin: new Date().toISOString(), timeMax: new Date().toISOString() });
  });
  return { service: 'Google Calendar', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkSupabase(): Promise<ServiceCheckResult> {
  const { latency_ms, error } = await timed(async () => {
    const db = getSupabaseAdmin();
    const { error: dbErr } = await db.from('health_checks').select('id').limit(1);
    if (dbErr) throw new Error(dbErr.message);
  });
  return { service: 'Supabase', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkRailway(): Promise<ServiceCheckResult> {
  const url = process.env.LIVEKIT_AGENT_HEALTH_URL;
  if (!url) {
    return { service: 'Railway (livekit-agent)', status: 'fail', latency_ms: 0, error_msg: 'LIVEKIT_AGENT_HEALTH_URL not configured' };
  }
  const { latency_ms, error } = await timed(async () => {
    const res = await fetch(`${url}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  return { service: 'Railway (livekit-agent)', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkFlyIo(): Promise<ServiceCheckResult> {
  const url = process.env.TWILIO_AGENT_HEALTH_URL;
  if (!url) {
    return { service: 'Fly.io (twilio-agent)', status: 'fail', latency_ms: 0, error_msg: 'TWILIO_AGENT_HEALTH_URL not configured' };
  }
  const { latency_ms, error } = await timed(async () => {
    const res = await fetch(`${url}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  return { service: 'Fly.io (twilio-agent)', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function runAllChecks(): Promise<ServiceCheckResult[]> {
  const checks = [
    checkHume,
    checkLiveKit,
    checkElevenLabs,
    checkVapi,
    checkRetell,
    checkTwilio,
    checkGoogleCalendar,
    checkSupabase,
    checkRailway,
    checkFlyIo,
  ];

  const settled = await Promise.allSettled(checks.map((fn) => fn()));
  return settled.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    return {
      service: checks[i].name.replace('check', ''),
      status: 'fail' as HealthStatus,
      latency_ms: 0,
      error_msg: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
  });
}
