import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/book-meeting', () => ({
  bookMeeting: vi.fn().mockResolvedValue({ success: true, meetingTime: '20 de maio, às 10:00' }),
}));

import { POST } from './route';
import { bookMeeting } from '@/lib/book-meeting';

function makeReq(body: object, secret = 'vapi-secret') {
  return new NextRequest('http://localhost/api/vapi/book-meeting', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-vapi-secret': secret },
    body: JSON.stringify(body),
  });
}

const toolCallBody = {
  message: {
    toolCallList: [
      { id: 'call-1', function: { name: 'book_meeting', arguments: { callerName: 'João', callerPhone: '+351 912 345 678', startTime: '2026-05-20T10:00:00' } } },
    ],
  },
};

describe('POST /api/vapi/book-meeting', () => {
  beforeEach(() => { process.env.VAPI_WEBHOOK_SECRET = 'vapi-secret'; vi.clearAllMocks(); });

  it('401 on wrong secret', async () => {
    const res = await POST(makeReq(toolCallBody, 'nope'));
    expect(res.status).toBe(401);
  });

  it('books and returns results array with toolCallId', async () => {
    const res = await POST(makeReq(toolCallBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results[0].toolCallId).toBe('call-1');
    expect(data.results[0].result).toContain('20 de maio');
    expect(vi.mocked(bookMeeting)).toHaveBeenCalledWith(
      expect.objectContaining({ callerPhone: '+351 912 345 678' })
    );
  });

  it('parses arguments when sent as a JSON string', async () => {
    const body = { message: { toolCallList: [
      { id: 'call-2', function: { name: 'book_meeting', arguments: JSON.stringify({ callerName: 'Ana', callerPhone: '+351 911', startTime: '2026-05-21T15:00:00' }) } },
    ] } };
    const res = await POST(makeReq(body));
    const data = await res.json();
    expect(data.results[0].toolCallId).toBe('call-2');
  });

  it('returns a fallback result string when booking fails', async () => {
    vi.mocked(bookMeeting).mockResolvedValueOnce({ success: false, error: 'Failed to create calendar event' });
    const res = await POST(makeReq(toolCallBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results[0].result).toContain('Não consegui');
  });
});
