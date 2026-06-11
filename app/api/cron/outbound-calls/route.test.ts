import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockListUpcomingEvents, mockTriggerOutboundCall, mockSendWhatsApp, mockUpsert, mockLimit, mockUpdateEq, selectChain } =
  vi.hoisted(() => {
    const mockLimit = vi.fn();
    const selectChain: Record<string, ReturnType<typeof vi.fn>> = {};
    selectChain.eq = vi.fn(() => selectChain);
    selectChain.not = vi.fn(() => selectChain);
    selectChain.lt = vi.fn(() => selectChain);
    selectChain.gte = vi.fn(() => selectChain);
    selectChain.limit = mockLimit;

    return {
      mockListUpcomingEvents: vi.fn(),
      mockTriggerOutboundCall: vi.fn(),
      mockSendWhatsApp: vi.fn(),
      mockUpsert: vi.fn(),
      mockLimit,
      mockUpdateEq: vi.fn(),
      selectChain,
    };
  });

vi.mock('@/lib/google-calendar', () => ({ listUpcomingEvents: mockListUpcomingEvents }));
vi.mock('@/lib/livekit-outbound', () => ({ triggerOutboundCall: mockTriggerOutboundCall }));
vi.mock('@/lib/whatsapp', () => ({ sendWhatsApp: mockSendWhatsApp }));
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: mockUpsert,
      select: vi.fn(() => selectChain),
      update: vi.fn(() => ({ eq: mockUpdateEq })),
    })),
  })),
}));

function makeRequest(secret?: string) {
  return new NextRequest('http://localhost/api/cron/outbound-calls', {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

async function loadRoute() {
  vi.resetModules();
  return import('./route');
}

describe('GET /api/cron/outbound-calls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    mockUpsert.mockResolvedValue({ data: null, error: null });
    mockUpdateEq.mockResolvedValue({ data: null, error: null });
    mockListUpcomingEvents.mockResolvedValue([]);
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  it('returns 401 without correct CRON_SECRET', async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await loadRoute();
    const res = await GET(makeRequest('anything'));
    expect(res.status).toBe(401);
  });

  it('skips outside calling hours', async () => {
    process.env.CALL_HOURS_START = '0';
    process.env.CALL_HOURS_END = '0';

    const { GET } = await loadRoute();
    const res = await GET(makeRequest('test-cron-secret'));
    const data = await res.json();

    expect(data.skipped).toBe('outside calling hours');
    expect(mockListUpcomingEvents).not.toHaveBeenCalled();
  });

  it('upserts every event found, including ones without a phone', async () => {
    process.env.CALL_HOURS_START = '0';
    process.env.CALL_HOURS_END = '24';
    mockListUpcomingEvents.mockResolvedValue([
      {
        eventId: 'evt-1',
        summary: 'Demo — João',
        startTime: '2026-06-12T10:00:00Z',
        attendeeName: 'João',
        phone: '+351911111111',
      },
      {
        eventId: 'evt-2',
        summary: 'Sem telefone',
        startTime: '2026-06-12T11:00:00Z',
        attendeeName: 'Sem telefone',
        phone: '',
      },
    ]);

    const { GET } = await loadRoute();
    const res = await GET(makeRequest('test-cron-secret'));
    const data = await res.json();

    expect(data.checked).toBe(2);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ calendar_event_id: 'evt-1', client_phone: '+351911111111', outcome_notes: null }),
      expect.objectContaining({ onConflict: 'calendar_event_id' })
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ calendar_event_id: 'evt-2', client_phone: null, outcome_notes: expect.stringContaining('sem telefone') }),
      expect.anything()
    );
  });

  it('triggers outbound calls for pending candidates and marks them as called on success', async () => {
    process.env.CALL_HOURS_START = '0';
    process.env.CALL_HOURS_END = '24';
    mockLimit.mockResolvedValue({
      data: [
        {
          id: 'apt-1',
          calendar_event_id: 'evt-1',
          client_name: 'João',
          client_phone: '+351911111111',
          appointment_at: '2026-06-12T10:00:00Z',
          business_type: 'clínica',
          reminder_attempts: 0,
        },
      ],
      error: null,
    });
    mockTriggerOutboundCall.mockResolvedValue({ ok: true });

    const { GET } = await loadRoute();
    const res = await GET(makeRequest('test-cron-secret'));
    const data = await res.json();

    expect(mockTriggerOutboundCall).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 'apt-1',
        calendarEventId: 'evt-1',
        clientPhone: '+351911111111',
        businessType: 'clínica',
      })
    );
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'apt-1');
    expect(data.called).toBe(1);
    expect(data.results[0]).toEqual({ calendarEventId: 'evt-1', outcome: 'called' });
    expect(mockSendWhatsApp).not.toHaveBeenCalled();
  });

  it('marks failed dial attempts as no_answer and notifies via WhatsApp', async () => {
    process.env.CALL_HOURS_START = '0';
    process.env.CALL_HOURS_END = '24';
    mockLimit.mockResolvedValue({
      data: [
        {
          id: 'apt-2',
          calendar_event_id: 'evt-2',
          client_name: 'Maria',
          client_phone: '+351922222222',
          appointment_at: '2026-06-12T15:00:00Z',
          business_type: 'imobiliária',
          reminder_attempts: 0,
        },
      ],
      error: null,
    });
    mockTriggerOutboundCall.mockResolvedValue({ ok: false, reason: 'OUTBOUND_TRUNK_ID não configurado' });

    const { GET } = await loadRoute();
    const res = await GET(makeRequest('test-cron-secret'));
    const data = await res.json();

    expect(data.results[0]).toEqual({ calendarEventId: 'evt-2', outcome: 'no_answer' });
    expect(mockSendWhatsApp).toHaveBeenCalledWith(expect.stringContaining('Maria'));
  });

  it('returns 500 when the candidates query fails', async () => {
    process.env.CALL_HOURS_START = '0';
    process.env.CALL_HOURS_END = '24';
    mockLimit.mockResolvedValue({ data: null, error: { message: 'db unreachable' } });

    const { GET } = await loadRoute();
    const res = await GET(makeRequest('test-cron-secret'));
    expect(res.status).toBe(500);
  });
});
