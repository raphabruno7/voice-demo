import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
const fromMock = vi.fn(() => ({ insert: insertMock }));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from: fromMock }),
}));

import { POST } from './route';

function makeRequest(body: object, secret = 'test-secret') {
  return new NextRequest('http://localhost/api/livekit/metrics', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-metrics-secret': secret,
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  callId: 'room-123',
  turns: [{ e2eLatencyMs: 850 }, { e2eLatencyMs: 620 }],
};

describe('POST /api/livekit/metrics', () => {
  beforeEach(() => {
    process.env.WEBHOOK_SECRET = 'test-secret';
    insertMock.mockClear();
    fromMock.mockClear();
  });

  it('returns 401 with wrong secret', async () => {
    const res = await POST(makeRequest(validBody, 'wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 401 with missing secret header', async () => {
    const req = new NextRequest('http://localhost/api/livekit/metrics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns success:false when turns missing', async () => {
    const res = await POST(makeRequest({ callId: 'room-123' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('inserts one row per turn with the call_id', async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('turn_metrics');
    expect(insertMock).toHaveBeenCalledWith([
      { call_id: 'room-123', e2e_latency_ms: 850 },
      { call_id: 'room-123', e2e_latency_ms: 620 },
    ]);
  });
});
