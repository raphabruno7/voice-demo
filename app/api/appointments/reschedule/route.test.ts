import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetOutboundAppointment, mockSendWhatsApp, mockUpdateEventTime, mockUpdate, mockEq } = vi.hoisted(() => ({
  mockGetOutboundAppointment: vi.fn(),
  mockSendWhatsApp: vi.fn(),
  mockUpdateEventTime: vi.fn(),
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
}));

vi.mock('@/lib/appointments', () => ({ getOutboundAppointment: mockGetOutboundAppointment }));
vi.mock('@/lib/whatsapp', () => ({ sendWhatsApp: mockSendWhatsApp }));
vi.mock('@/lib/google-calendar', () => ({ updateEventTime: mockUpdateEventTime }));
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn(() => ({ update: mockUpdate })),
  })),
}));

mockUpdate.mockImplementation(() => ({ eq: mockEq }));

import { POST } from './route';

const appointment = {
  id: 'apt-1',
  calendar_event_id: 'evt-1',
  client_name: 'João Silva',
  client_phone: '+351911111111',
  appointment_at: '2026-06-12T10:00:00Z',
  business_type: 'clínica',
  reminder_status: 'pending',
  reminder_attempts: 0,
};

function makeRequest(body: object, secret = 'test-webhook-secret') {
  return new NextRequest('http://localhost/api/appointments/reschedule', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-vapi-secret': secret },
    body: JSON.stringify(body),
  });
}

describe('POST /api/appointments/reschedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEBHOOK_SECRET = 'test-webhook-secret';
    mockEq.mockResolvedValue({ data: null, error: null });
    mockSendWhatsApp.mockResolvedValue(undefined);
    mockUpdateEventTime.mockResolvedValue({ eventId: 'evt-1', startTime: '2026-06-17T15:00:00+01:00' });
  });

  it('returns 401 with wrong secret', async () => {
    const res = await POST(makeRequest({ appointmentId: 'apt-1', newStartTime: '2026-06-17T15:00:00' }, 'wrong'));
    expect(res.status).toBe(401);
  });

  it('returns success:false when newStartTime missing', async () => {
    const res = await POST(makeRequest({ appointmentId: 'apt-1' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(mockGetOutboundAppointment).not.toHaveBeenCalled();
  });

  it('returns success:false when appointment not found', async () => {
    mockGetOutboundAppointment.mockResolvedValue(null);
    const res = await POST(makeRequest({ appointmentId: 'unknown', newStartTime: '2026-06-17T15:00:00' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('returns success:false when updateEventTime fails', async () => {
    mockGetOutboundAppointment.mockResolvedValue(appointment);
    mockUpdateEventTime.mockRejectedValue(new Error('calendar down'));

    const res = await POST(makeRequest({ appointmentId: 'apt-1', newStartTime: '2026-06-17T15:00:00' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates calendar + DB and returns the new meetingTime in pt-PT', async () => {
    mockGetOutboundAppointment.mockResolvedValue(appointment);

    const res = await POST(makeRequest({ appointmentId: 'apt-1', newStartTime: '2026-06-17T15:00:00' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(typeof data.meetingTime).toBe('string');
    expect(data.meetingTime).toMatch(/\d{1,2}\s+de\s+\w+/);

    expect(mockUpdateEventTime).toHaveBeenCalledWith('evt-1', '2026-06-17T15:00:00');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ appointment_at: '2026-06-17T15:00:00', reminder_status: 'rescheduled' })
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'apt-1');
    expect(mockSendWhatsApp).toHaveBeenCalledWith(expect.stringContaining('João Silva'));
  });
});
