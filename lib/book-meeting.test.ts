import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/google-calendar', () => ({
  createEvent: vi.fn().mockResolvedValue({
    eventId: 'evt-1', htmlLink: 'https://cal/event', startTime: '2026-05-20T10:00:00',
  }),
}));
vi.mock('@/lib/whatsapp', () => ({ sendWhatsApp: vi.fn().mockResolvedValue(undefined) }));

import { bookMeeting } from './book-meeting';
import { createEvent } from '@/lib/google-calendar';
import { sendWhatsApp } from '@/lib/whatsapp';

const args = { callerName: 'João', callerPhone: '+351 912 345 678', startTime: '2026-05-20T10:00:00' };

describe('bookMeeting', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates the event and returns pt-PT meetingTime', async () => {
    const r = await bookMeeting(args);
    expect(r.success).toBe(true);
    expect(r.meetingTime).toMatch(/\d{1,2}\s+de\s+\w+/);
    expect(vi.mocked(createEvent)).toHaveBeenCalledWith(expect.objectContaining({ callerPhone: '+351 912 345 678' }));
  });

  it('sends a WhatsApp notification', async () => {
    await bookMeeting(args);
    expect(vi.mocked(sendWhatsApp)).toHaveBeenCalledOnce();
  });

  it('still succeeds if WhatsApp fails', async () => {
    vi.mocked(sendWhatsApp).mockRejectedValueOnce(new Error('twilio down'));
    const r = await bookMeeting(args);
    expect(r.success).toBe(true);
  });

  it('returns success:false when createEvent throws', async () => {
    vi.mocked(createEvent).mockRejectedValueOnce(new Error('Calendar down'));
    const r = await bookMeeting(args);
    expect(r.success).toBe(false);
    expect(r.error).toBe('Failed to create calendar event');
  });
});
