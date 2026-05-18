import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/google-calendar', () => ({
  createEvent: vi.fn().mockResolvedValue({
    eventId: 'evt-123',
    htmlLink: 'https://calendar.google.com/event',
    startTime: '2026-05-20T10:00:00',
  }),
}));

import { POST } from './route';

function makeRequest(body: object, secret = 'test-secret') {
  return new NextRequest('http://localhost/api/book-meeting', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hume-secret': secret,
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  callerName: 'João Silva',
  callerPhone: '+351 912 345 678',
  startTime: '2026-05-20T10:00:00',
};

describe('POST /api/book-meeting', () => {
  beforeEach(() => {
    process.env.HUME_TOOL_SECRET = 'test-secret';
  });

  it('returns 401 with wrong secret', async () => {
    const res = await POST(makeRequest(validBody, 'wrong-secret'));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 401 with missing secret header', async () => {
    const req = new NextRequest('http://localhost/api/book-meeting', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 if callerName missing', async () => {
    const res = await POST(makeRequest({ callerPhone: '+351 911', startTime: '2026-05-20T10:00:00' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 if callerPhone missing', async () => {
    const res = await POST(makeRequest({ callerName: 'João', startTime: '2026-05-20T10:00:00' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 if startTime missing', async () => {
    const res = await POST(makeRequest({ callerName: 'João', callerPhone: '+351 912 345 678' }));
    expect(res.status).toBe(400);
  });

  it('returns success with meetingTime on valid input', async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(typeof data.meetingTime).toBe('string');
    expect(data.meetingTime.length).toBeGreaterThan(0);
  });

  it('passes callerPhone to createEvent', async () => {
    const { createEvent } = await import('@/lib/google-calendar');
    await POST(makeRequest(validBody));
    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ callerPhone: '+351 912 345 678' })
    );
  });
});
