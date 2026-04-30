import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInsert } = vi.hoisted(() => ({ mockInsert: vi.fn() }));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      GoogleAuth: vi.fn().mockImplementation(function (this: any) {
        this.getClient = vi.fn();
      }),
    },
    calendar: vi.fn().mockReturnValue({
      events: { insert: mockInsert },
    }),
  },
}));

import { createEvent } from './google-calendar';

describe('createEvent', () => {
  beforeEach(() => {
    mockInsert.mockClear();
    mockInsert.mockResolvedValue({
      data: {
        id: 'evt-abc123',
        htmlLink: 'https://calendar.google.com/event?eid=abc123',
        start: { dateTime: '2026-05-01T10:00:00+01:00' },
      },
    });
  });

  it('returns eventId and htmlLink from Google Calendar response', async () => {
    const result = await createEvent({
      callerName: 'João Silva',
      startTime: '2026-05-01T10:00:00+01:00',
    });

    expect(result.eventId).toBe('evt-abc123');
    expect(result.htmlLink).toContain('calendar.google.com');
    expect(result.startTime).toBe('2026-05-01T10:00:00+01:00');
  });

  it('inserts event with correct summary and 30-minute duration', async () => {
    await createEvent({ callerName: 'Maria', startTime: '2026-05-02T15:00:00+01:00' });

    const call = mockInsert.mock.calls[0][0];
    expect(call.requestBody.summary).toBe('Demo — Maria');
    const start = new Date(call.requestBody.start.dateTime);
    const end = new Date(call.requestBody.end.dateTime);
    expect((end.getTime() - start.getTime()) / 60000).toBe(30);
  });
});
