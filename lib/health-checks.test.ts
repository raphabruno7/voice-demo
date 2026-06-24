// lib/health-checks.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks têm de vir antes dos imports que os usam
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve({ data: [{ id: 1 }], error: null })) })),
    })),
  })),
}));

vi.mock('@/lib/google-calendar', () => ({
  listUpcomingEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock('livekit-server-sdk', () => ({
  RoomServiceClient: vi.fn().mockImplementation(() => ({
    listRooms: vi.fn().mockResolvedValue({ rooms: [] }),
  })),
}));

import {
  checkHume,
  checkElevenLabs,
  checkRetell,
  checkTwilio,
  checkRailway,
  checkFlyIo,
  runAllChecks,
  type ServiceCheckResult,
} from './health-checks';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeResponse(status: number, latencyMs = 100): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  process.env.HUME_API_KEY = 'hume-key';
  process.env.NEXT_PUBLIC_HUME_CONFIG_ID = 'cfg-1';
  process.env.ELEVENLABS_API_KEY = 'el-key';
  process.env.ELEVENLABS_AGENT_ID = 'agent-1';
  process.env.RETELL_API_KEY = 'retell-key';
  process.env.RETELL_AGENT_ID = 'ret-agent-1';
  process.env.TWILIO_ACCOUNT_SID = 'ACxxx';
  process.env.TWILIO_AUTH_TOKEN = 'tok';
  process.env.LIVEKIT_URL = 'wss://livekit.example.com';
  process.env.LIVEKIT_API_KEY = 'lk-key';
  process.env.LIVEKIT_API_SECRET = 'lk-secret';
  process.env.LIVEKIT_AGENT_HEALTH_URL = 'https://railway.example.com';
  process.env.TWILIO_AGENT_HEALTH_URL = 'https://fly.example.com';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('checkHume', () => {
  it('returns ok on 200', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200));
    const result = await checkHume();
    expect(result.service).toBe('Hume EVI');
    expect(result.status).toBe('ok');
    expect(result.error_msg).toBeUndefined();
  });

  it('returns fail on 401', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(401));
    const result = await checkHume();
    expect(result.status).toBe('fail');
    expect(result.error_msg).toMatch(/401/);
  });

  it('returns fail when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await checkHume();
    expect(result.status).toBe('fail');
    expect(result.error_msg).toBe('Network error');
  });
});

describe('checkElevenLabs', () => {
  it('returns ok on 200', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200));
    const result = await checkElevenLabs();
    expect(result.service).toBe('ElevenLabs');
    expect(result.status).toBe('ok');
  });

  it('returns fail on 402 (free plan block)', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(402));
    const result = await checkElevenLabs();
    expect(result.status).toBe('fail');
  });
});

describe('checkRetell', () => {
  it('returns ok on 200', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200));
    const result = await checkRetell();
    expect(result.service).toBe('Retell AI');
    expect(result.status).toBe('ok');
  });
});

describe('checkTwilio', () => {
  it('returns ok on 200', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200));
    const result = await checkTwilio();
    expect(result.service).toBe('Twilio');
    expect(result.status).toBe('ok');
  });

  it('returns fail on 401 (bad credentials)', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(401));
    const result = await checkTwilio();
    expect(result.status).toBe('fail');
  });
});

describe('checkRailway', () => {
  it('returns ok on 200', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200));
    const result = await checkRailway();
    expect(result.service).toBe('Railway (livekit-agent)');
    expect(result.status).toBe('ok');
  });

  it('returns fail when URL not configured', async () => {
    delete process.env.LIVEKIT_AGENT_HEALTH_URL;
    const result = await checkRailway();
    expect(result.status).toBe('fail');
    expect(result.error_msg).toMatch(/not configured/);
  });
});

describe('checkFlyIo', () => {
  it('returns ok on 200', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200));
    const result = await checkFlyIo();
    expect(result.service).toBe('Fly.io (twilio-agent)');
    expect(result.status).toBe('ok');
  });
});

describe('runAllChecks', () => {
  it('returns 10 results', async () => {
    mockFetch.mockResolvedValue(makeResponse(200));
    const results = await runAllChecks();
    expect(results).toHaveLength(10);
    results.forEach((r: ServiceCheckResult) => {
      expect(['ok', 'degraded', 'fail']).toContain(r.status);
    });
  });

  it('marks service as fail if individual check throws', async () => {
    mockFetch.mockRejectedValue(new Error('All down'));
    const results = await runAllChecks();
    const fetchBased = results.filter((r: ServiceCheckResult) =>
      ['Hume EVI', 'ElevenLabs', 'Retell AI', 'Twilio', 'Railway (livekit-agent)', 'Fly.io (twilio-agent)'].includes(r.service)
    );
    fetchBased.forEach((r: ServiceCheckResult) => expect(r.status).toBe('fail'));
  });
});
