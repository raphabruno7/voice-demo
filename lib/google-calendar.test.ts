import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInsert, mockList, mockGet, mockPatch, mockDelete } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockList: vi.fn(),
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      GoogleAuth: vi.fn().mockImplementation(function (this: any) {
        this.getClient = vi.fn();
      }),
    },
    calendar: vi.fn().mockReturnValue({
      events: {
        insert: mockInsert,
        list: mockList,
        get: mockGet,
        patch: mockPatch,
        delete: mockDelete,
      },
    }),
  },
}));

import { createEvent, listUpcomingEvents, updateEventTime, cancelEvent } from './google-calendar';

describe('createEvent', () => {
  beforeEach(() => {
    process.env.GOOGLE_CALENDAR_ID = 'test-cal@group.calendar.google.com';
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
    expect(call.requestBody.start.timeZone).toBe('Europe/Lisbon');
    expect(call.requestBody.end.timeZone).toBe('Europe/Lisbon');
    expect(call.calendarId).toBe('test-cal@group.calendar.google.com');
  });

  it('includes phone number in event description when provided', async () => {
    await createEvent({
      callerName: 'João',
      callerPhone: '+351 912 345 678',
      startTime: '2026-05-20T10:00:00',
    });
    const call = mockInsert.mock.calls[0][0];
    expect(call.requestBody.description).toContain('+351 912 345 678');
  });

  it('omits phone line from description when callerPhone not provided', async () => {
    await createEvent({ callerName: 'Maria', startTime: '2026-05-20T10:00:00' });
    const call = mockInsert.mock.calls[0][0];
    expect(call.requestBody.description).not.toContain('Tel:');
  });

  it('stores phone in extendedProperties.private for later lookup', async () => {
    await createEvent({
      callerName: 'João',
      callerPhone: '+351 912 345 678',
      startTime: '2026-05-20T10:00:00',
    });
    const call = mockInsert.mock.calls[0][0];
    expect(call.requestBody.extendedProperties.private.phone).toBe('+351 912 345 678');
  });

  it('stores empty string in extendedProperties.private.phone when callerPhone not provided', async () => {
    await createEvent({ callerName: 'Maria', startTime: '2026-05-20T10:00:00' });
    const call = mockInsert.mock.calls[0][0];
    expect(call.requestBody.extendedProperties.private.phone).toBe('');
  });
});

describe('listUpcomingEvents', () => {
  beforeEach(() => {
    process.env.GOOGLE_CALENDAR_ID = 'test-cal@group.calendar.google.com';
    mockList.mockClear();
  });

  it('maps calendar events to UpcomingEvent, deriving attendeeName and phone', async () => {
    mockList.mockResolvedValue({
      data: {
        items: [
          {
            id: 'evt-1',
            summary: 'Demo — João Silva',
            start: { dateTime: '2026-06-12T10:00:00+01:00' },
            extendedProperties: { private: { phone: '+351911111111' } },
          },
          {
            id: 'evt-2',
            summary: 'Reunião sem telefone',
            start: { dateTime: '2026-06-12T15:00:00+01:00' },
          },
        ],
      },
    });

    const result = await listUpcomingEvents({
      timeMin: '2026-06-12T00:00:00Z',
      timeMax: '2026-06-13T00:00:00Z',
    });

    expect(result).toEqual([
      {
        eventId: 'evt-1',
        summary: 'Demo — João Silva',
        startTime: '2026-06-12T10:00:00+01:00',
        attendeeName: 'João Silva',
        phone: '+351911111111',
      },
      {
        eventId: 'evt-2',
        summary: 'Reunião sem telefone',
        startTime: '2026-06-12T15:00:00+01:00',
        attendeeName: 'Reunião sem telefone',
        phone: '',
      },
    ]);

    const call = mockList.mock.calls[0][0];
    expect(call.calendarId).toBe('test-cal@group.calendar.google.com');
    expect(call.singleEvents).toBe(true);
    expect(call.orderBy).toBe('startTime');
  });

  it('skips events without an id or start dateTime', async () => {
    mockList.mockResolvedValue({
      data: {
        items: [
          { id: 'evt-1', summary: 'Sem hora definida' },
          { summary: 'Sem id', start: { dateTime: '2026-06-12T10:00:00+01:00' } },
        ],
      },
    });

    const result = await listUpcomingEvents({ timeMin: 'a', timeMax: 'b' });
    expect(result).toEqual([]);
  });

  it('returns empty array when no items', async () => {
    mockList.mockResolvedValue({ data: {} });
    const result = await listUpcomingEvents({ timeMin: 'a', timeMax: 'b' });
    expect(result).toEqual([]);
  });
});

describe('updateEventTime', () => {
  beforeEach(() => {
    process.env.GOOGLE_CALENDAR_ID = 'test-cal@group.calendar.google.com';
    mockGet.mockClear();
    mockPatch.mockClear();
  });

  it('preserves the original duration when rescheduling', async () => {
    mockGet.mockResolvedValue({
      data: {
        start: { dateTime: '2026-06-12T10:00:00+01:00' },
        end: { dateTime: '2026-06-12T10:30:00+01:00' },
      },
    });
    mockPatch.mockResolvedValue({
      data: { id: 'evt-1', start: { dateTime: '2026-06-17T15:00:00+01:00' } },
    });

    const result = await updateEventTime('evt-1', '2026-06-17T15:00:00+01:00');

    expect(result.eventId).toBe('evt-1');
    expect(result.startTime).toBe('2026-06-17T15:00:00+01:00');

    const patchCall = mockPatch.mock.calls[0][0];
    expect(patchCall.eventId).toBe('evt-1');
    expect(patchCall.calendarId).toBe('test-cal@group.calendar.google.com');
    const newStart = new Date(patchCall.requestBody.start.dateTime);
    const newEnd = new Date(patchCall.requestBody.end.dateTime);
    expect((newEnd.getTime() - newStart.getTime()) / 60000).toBe(30);
    expect(patchCall.requestBody.start.timeZone).toBe('Europe/Lisbon');
  });
});

describe('cancelEvent', () => {
  beforeEach(() => {
    process.env.GOOGLE_CALENDAR_ID = 'test-cal@group.calendar.google.com';
    mockDelete.mockClear();
    mockDelete.mockResolvedValue({});
  });

  it('deletes the event by id', async () => {
    await cancelEvent('evt-1');
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-1', calendarId: 'test-cal@group.calendar.google.com' })
    );
  });
});
