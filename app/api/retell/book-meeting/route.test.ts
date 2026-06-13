import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/book-meeting', () => ({
  bookMeeting: vi.fn().mockResolvedValue({ success: true, meetingTime: '20 de maio, às 10:00' }),
}));

import { POST } from './route';
import { bookMeeting } from '@/lib/book-meeting';

function makeReq(body: object, secret = 'retell-secret') {
  return new NextRequest('http://localhost/api/retell/book-meeting', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-retell-secret': secret },
    body: JSON.stringify(body),
  });
}

const body = { call: { call_id: 'c1' }, name: 'book_meeting', args: { callerName: 'João', callerPhone: '+351 912 345 678', startTime: '2026-05-20T10:00:00' } };

describe('POST /api/retell/book-meeting', () => {
  beforeEach(() => { process.env.RETELL_WEBHOOK_SECRET = 'retell-secret'; vi.clearAllMocks(); });

  it('401 on wrong secret', async () => {
    const res = await POST(makeReq(body, 'nope'));
    expect(res.status).toBe(401);
  });

  it('books and returns a result string', async () => {
    const res = await POST(makeReq(body));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toContain('20 de maio');
    expect(vi.mocked(bookMeeting)).toHaveBeenCalledWith(expect.objectContaining({ callerPhone: '+351 912 345 678' }));
  });

  it('fallback string when booking fails', async () => {
    vi.mocked(bookMeeting).mockResolvedValueOnce({ success: false, error: 'x' });
    const res = await POST(makeReq(body));
    const data = await res.json();
    expect(data.result).toContain('Não consegui');
  });
});
