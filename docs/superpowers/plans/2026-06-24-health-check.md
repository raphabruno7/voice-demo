# Health Check & Monitoring System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema de verificação diária de todas as APIs e serviços do voice-demo, com email via Resend e dashboard admin em `/status`.

**Architecture:** Vercel Cron (07:00 UTC) corre `lib/health-checks.ts` em paralelo para os 10 serviços, persiste em Supabase `health_checks`, envia email HTML via Resend. Dashboard em `/status` (Server Component) lê Supabase e é protegido por cookie `admin_token` via `middleware.ts`. Agentes Railway e Fly.io expõem `GET /health`.

**Tech Stack:** Next.js App Router, Supabase (service_role), Resend SDK, Vitest, `livekit-server-sdk`, Python `http.server` (stdlib)

## Global Constraints

- Seguir padrão lazy singleton para Supabase (nunca instanciar a module-level)
- `export const dynamic = "force-dynamic"` em todas as route handlers de cron e status
- Cron autenticado com header `Authorization: Bearer ${CRON_SECRET}` (igual ao padrão existente)
- Thresholds: ok < 2 000ms, degraded 2 000–5 000ms, fail > 5 000ms ou erro HTTP
- Sem bibliotecas de gráficos — barras simples em CSS inline
- Commits frequentes após cada task

---

## File Map

| Ficheiro | Acção | Responsabilidade |
|---|---|---|
| `supabase/migrations/004_health_checks.sql` | Criar | Tabela `health_checks` |
| `lib/health-checks.ts` | Criar | Funções de check por serviço |
| `lib/health-checks.test.ts` | Criar | Testes das funções de check |
| `lib/resend.ts` | Criar | `sendHealthEmail()` |
| `app/api/cron/health-check/route.ts` | Criar | Handler do cron Vercel |
| `vercel.json` | Modificar | Adicionar entrada de cron |
| `middleware.ts` | Criar | Protecção de `/status` via cookie |
| `app/status/login/page.tsx` | Criar | Formulário de login admin |
| `app/api/status/logout/route.ts` | Criar | Limpa cookie `admin_token` |
| `app/status/page.tsx` | Criar | Dashboard admin |
| `twilio-agent/server.js` | Modificar | Adicionar `GET /health` HTTP |
| `livekit-agent/agent.py` | Modificar | Adicionar `GET /health` HTTP (daemon thread) |
| `livekit-agent/requirements.txt` | Modificar | Sem alteração (usa stdlib `http.server`) |

---

## Task 1: Database migration `health_checks`

**Files:**
- Create: `supabase/migrations/004_health_checks.sql`

**Interfaces:**
- Produces: tabela `health_checks(id, checked_at, service, status, latency_ms, error_msg)` disponível para `getSupabaseAdmin()`

- [ ] **Step 1: Criar migração**

```sql
-- supabase/migrations/004_health_checks.sql
create table health_checks (
  id          uuid primary key default gen_random_uuid(),
  checked_at  timestamptz not null default now(),
  service     text not null,
  status      text not null check (status in ('ok', 'degraded', 'fail')),
  latency_ms  integer,
  error_msg   text
);

alter table health_checks enable row level security;
-- Dados operacionais internos — service_role only, sem public select
create index health_checks_service_checked_at on health_checks (service, checked_at desc);
```

- [ ] **Step 2: Aplicar migração localmente**

```bash
# No dashboard Supabase ou via CLI:
supabase db push
# ou executar o SQL directamente no SQL Editor do Supabase dashboard
```

Expected: tabela `health_checks` criada sem erros.

- [ ] **Step 3: Verificar no Supabase dashboard**

Navegar para Table Editor → confirmar colunas `id`, `checked_at`, `service`, `status`, `latency_ms`, `error_msg`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/004_health_checks.sql
git commit -m "feat(health): add health_checks table migration"
```

---

## Task 2: Instalar Resend + `lib/resend.ts`

**Files:**
- Create: `lib/resend.ts`

**Interfaces:**
- Produces: `sendHealthEmail(results: ServiceCheckResult[], type: 'daily' | 'alert'): Promise<void>`
- Consumes: `ServiceCheckResult` (definido em Task 3 — copiar definição aqui para implementar em paralelo)

```typescript
// Tipo a usar nesta task (será exportado de lib/health-checks.ts na Task 3)
export type HealthStatus = 'ok' | 'degraded' | 'fail';
export interface ServiceCheckResult {
  service: string;
  status: HealthStatus;
  latency_ms: number;
  error_msg?: string;
}
```

- [ ] **Step 1: Instalar Resend**

```bash
npm install resend
```

Expected: `resend` aparece em `package.json` dependencies.

- [ ] **Step 2: Criar `lib/resend.ts`**

```typescript
import { Resend } from 'resend';

export type HealthStatus = 'ok' | 'degraded' | 'fail';
export interface ServiceCheckResult {
  service: string;
  status: HealthStatus;
  latency_ms: number;
  error_msg?: string;
}

const ICON: Record<HealthStatus, string> = {
  ok: '✅',
  degraded: '⚠️',
  fail: '❌',
};

function buildHtml(results: ServiceCheckResult[], type: 'daily' | 'alert'): string {
  const rows = results
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${r.service}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${ICON[r.status]} ${r.status}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${r.latency_ms ?? '—'}ms</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;font-size:12px">${r.error_msg ?? '—'}</td>
      </tr>`
    )
    .join('');

  const title =
    type === 'alert'
      ? `[ALERTA] Voice Demo — ${results.filter((r) => r.status === 'fail').length} serviço(s) em falha`
      : 'Voice Demo — Relatório de saúde diário';

  return `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
      <h2 style="color:${type === 'alert' ? '#dc2626' : '#1e3a5f'}">${title}</h2>
      <p style="color:#666;font-size:14px">Verificado em ${new Date().toISOString()}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px 12px;text-align:left">Serviço</th>
            <th style="padding:8px 12px;text-align:left">Estado</th>
            <th style="padding:8px 12px;text-align:left">Latência</th>
            <th style="padding:8px 12px;text-align:left">Erro</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:24px;font-size:13px;color:#888">
        <a href="https://voice-demo-navy.vercel.app/status">Ver dashboard</a>
      </p>
    </div>`;
}

export async function sendHealthEmail(
  results: ServiceCheckResult[],
  type: 'daily' | 'alert'
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY not set — skipping email');
    return;
  }

  const client = new Resend(apiKey);
  const from = process.env.HEALTH_EMAIL_FROM ?? 'health@raphaelbruno.dev';
  const to = 'raphaelbruno.dev@gmail.com';

  const subject =
    type === 'alert'
      ? `[ALERTA] Voice Demo — ${results.filter((r) => r.status === 'fail').length} falha(s)`
      : `Voice Demo — Saúde ${new Date().toLocaleDateString('pt-PT')}`;

  await client.emails.send({
    from,
    to,
    subject,
    html: buildHtml(results, type),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/resend.ts package.json package-lock.json
git commit -m "feat(health): add Resend email helper"
```

---

## Task 3: `lib/health-checks.ts` + testes

**Files:**
- Create: `lib/health-checks.ts`
- Create: `lib/health-checks.test.ts`

**Interfaces:**
- Produces:
  - `type HealthStatus = 'ok' | 'degraded' | 'fail'`
  - `interface ServiceCheckResult { service: string; status: HealthStatus; latency_ms: number; error_msg?: string }`
  - `runAllChecks(): Promise<ServiceCheckResult[]>`
  - (funções individuais exportadas para testabilidade)

- [ ] **Step 1: Escrever testes falhantes**

```typescript
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
```

- [ ] **Step 2: Correr testes — confirmar que falham**

```bash
cd /Users/raphaelbruno/voice-demo && npm test -- lib/health-checks.test.ts
```

Expected: FAIL com `Cannot find module './health-checks'`

- [ ] **Step 3: Criar `lib/health-checks.ts`**

```typescript
import { RoomServiceClient } from 'livekit-server-sdk';
import { getSupabaseAdmin } from '@/lib/supabase';
import { listUpcomingEvents } from '@/lib/google-calendar';

export type HealthStatus = 'ok' | 'degraded' | 'fail';

export interface ServiceCheckResult {
  service: string;
  status: HealthStatus;
  latency_ms: number;
  error_msg?: string;
}

const TIMEOUT_MS = 5_000;
const DEGRADED_MS = 2_000;

function classify(latency_ms: number, error?: string): HealthStatus {
  if (error) return 'fail';
  if (latency_ms >= DEGRADED_MS) return 'degraded';
  return 'ok';
}

async function timed(
  fn: () => Promise<void>
): Promise<{ latency_ms: number; error?: string }> {
  const start = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
      ),
    ]);
    return { latency_ms: Date.now() - start };
  } catch (e) {
    return {
      latency_ms: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function checkHume(): Promise<ServiceCheckResult> {
  const { latency_ms, error } = await timed(async () => {
    const res = await fetch(
      `https://api.hume.ai/v0/evi/configs/${process.env.NEXT_PUBLIC_HUME_CONFIG_ID}`,
      { headers: { Authorization: `Token ${process.env.HUME_API_KEY}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  return { service: 'Hume EVI', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkLiveKit(): Promise<ServiceCheckResult> {
  const { latency_ms, error } = await timed(async () => {
    const httpUrl = process.env.LIVEKIT_URL!.replace('wss://', 'https://');
    const svc = new RoomServiceClient(
      httpUrl,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );
    await svc.listRooms();
  });
  return { service: 'LiveKit', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkElevenLabs(): Promise<ServiceCheckResult> {
  const { latency_ms, error } = await timed(async () => {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${process.env.ELEVENLABS_AGENT_ID}`,
      { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  return { service: 'ElevenLabs', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkVapi(): Promise<ServiceCheckResult> {
  // Vapi: validar que env vars estão presentes — chave pública não permite chamadas server-side
  const { latency_ms, error } = await timed(async () => {
    if (!process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || !process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID) {
      throw new Error('NEXT_PUBLIC_VAPI_PUBLIC_KEY or NEXT_PUBLIC_VAPI_ASSISTANT_ID not set');
    }
    const res = await fetch(`https://api.vapi.ai/assistant/${process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID}`, {
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY}` },
    });
    // 401 aqui é esperado (chave pública) — confirmamos apenas que o endpoint responde
    if (res.status === 500 || res.status === 502 || res.status === 503) {
      throw new Error(`HTTP ${res.status}`);
    }
  });
  return { service: 'Vapi', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkRetell(): Promise<ServiceCheckResult> {
  const { latency_ms, error } = await timed(async () => {
    const res = await fetch(
      `https://api.retellai.com/v2/get-agent/${process.env.RETELL_AGENT_ID}`,
      { headers: { Authorization: `Bearer ${process.env.RETELL_API_KEY}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  return { service: 'Retell AI', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkTwilio(): Promise<ServiceCheckResult> {
  const { latency_ms, error } = await timed(async () => {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  return { service: 'Twilio', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkGoogleCalendar(): Promise<ServiceCheckResult> {
  const { latency_ms, error } = await timed(async () => {
    await listUpcomingEvents({ timeMin: new Date().toISOString(), timeMax: new Date().toISOString() });
  });
  return { service: 'Google Calendar', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkSupabase(): Promise<ServiceCheckResult> {
  const { latency_ms, error } = await timed(async () => {
    const db = getSupabaseAdmin();
    const { error: dbErr } = await db.from('health_checks').select('id').limit(1);
    if (dbErr) throw new Error(dbErr.message);
  });
  return { service: 'Supabase', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkRailway(): Promise<ServiceCheckResult> {
  const url = process.env.LIVEKIT_AGENT_HEALTH_URL;
  if (!url) {
    return { service: 'Railway (livekit-agent)', status: 'fail', latency_ms: 0, error_msg: 'LIVEKIT_AGENT_HEALTH_URL not configured' };
  }
  const { latency_ms, error } = await timed(async () => {
    const res = await fetch(`${url}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  return { service: 'Railway (livekit-agent)', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function checkFlyIo(): Promise<ServiceCheckResult> {
  const url = process.env.TWILIO_AGENT_HEALTH_URL;
  if (!url) {
    return { service: 'Fly.io (twilio-agent)', status: 'fail', latency_ms: 0, error_msg: 'TWILIO_AGENT_HEALTH_URL not configured' };
  }
  const { latency_ms, error } = await timed(async () => {
    const res = await fetch(`${url}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  return { service: 'Fly.io (twilio-agent)', status: classify(latency_ms, error), latency_ms, error_msg: error };
}

export async function runAllChecks(): Promise<ServiceCheckResult[]> {
  const checks = [
    checkHume,
    checkLiveKit,
    checkElevenLabs,
    checkVapi,
    checkRetell,
    checkTwilio,
    checkGoogleCalendar,
    checkSupabase,
    checkRailway,
    checkFlyIo,
  ];

  const settled = await Promise.allSettled(checks.map((fn) => fn()));
  return settled.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    return {
      service: checks[i].name.replace('check', ''),
      status: 'fail' as HealthStatus,
      latency_ms: 0,
      error_msg: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
  });
}
```

- [ ] **Step 4: Correr testes — confirmar que passam**

```bash
npm test -- lib/health-checks.test.ts
```

Expected: todos os testes PASS

- [ ] **Step 5: Commit**

```bash
git add lib/health-checks.ts lib/health-checks.test.ts
git commit -m "feat(health): add health check functions with tests"
```

---

## Task 4: Cron route + `vercel.json`

**Files:**
- Create: `app/api/cron/health-check/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `runAllChecks()` de `lib/health-checks.ts`, `sendHealthEmail()` de `lib/resend.ts`, `getSupabaseAdmin()` de `lib/supabase.ts`

- [ ] **Step 1: Criar route handler**

```typescript
// app/api/cron/health-check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runAllChecks } from '@/lib/health-checks';
import { sendHealthEmail } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await runAllChecks();
  const db = getSupabaseAdmin();

  // Persistir resultados
  await db.from('health_checks').insert(
    results.map((r) => ({
      service: r.service,
      status: r.status,
      latency_ms: r.latency_ms,
      error_msg: r.error_msg ?? null,
    }))
  );

  // Limpar registos com mais de 30 dias
  await db.from('health_checks').delete().lt(
    'checked_at',
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  );

  const hasFail = results.some((r) => r.status === 'fail');

  // Alerta imediato se houver falha
  if (hasFail) {
    await sendHealthEmail(results, 'alert');
  }

  // Relatório diário sempre
  await sendHealthEmail(results, 'daily');

  const summary = results.map((r) => ({ service: r.service, status: r.status, latency_ms: r.latency_ms }));
  return NextResponse.json({ ok: true, checked: results.length, hasFail, summary });
}
```

- [ ] **Step 2: Actualizar `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/ai-agent-voice/api/cron/outbound-calls",
      "schedule": "30 9 * * *"
    },
    {
      "path": "/ai-agent-voice/api/cron/health-check",
      "schedule": "0 7 * * *"
    }
  ]
}
```

- [ ] **Step 3: Testar a rota localmente (opcional)**

```bash
# Num terminal: npm run dev
# Noutro terminal:
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/health-check
```

Expected: JSON com `ok: true` e lista de serviços.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/health-check/route.ts vercel.json
git commit -m "feat(health): add health check cron route and vercel.json entry"
```

---

## Task 5: Middleware + login + logout

**Files:**
- Create: `middleware.ts` (raiz do projecto)
- Create: `app/status/login/page.tsx`
- Create: `app/api/status/logout/route.ts`

**Interfaces:**
- Produces: cookie `admin_token` (HttpOnly, path=/status) validado contra `ADMIN_SECRET`

- [ ] **Step 1: Criar `middleware.ts`**

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Só proteger /status — ignorar /status/login e /api/status/*
  if (!pathname.startsWith('/status') || pathname.startsWith('/status/login') || pathname.startsWith('/api/status')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('admin_token')?.value;
  const secret = process.env.ADMIN_SECRET;

  if (!secret || token !== secret) {
    const loginUrl = new URL('/status/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/status', '/status/:path*'],
};
```

- [ ] **Step 2: Criar página de login `app/status/login/page.tsx`**

```tsx
// app/status/login/page.tsx
export const dynamic = 'force-dynamic';

async function login(formData: FormData) {
  'use server';
  const { cookies } = await import('next/headers');
  const { redirect } = await import('next/navigation');

  const password = formData.get('password') as string;
  const secret = process.env.ADMIN_SECRET;

  if (!secret || password !== secret) {
    redirect('/status/login?error=1');
  }

  const jar = await cookies();
  jar.set('admin_token', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/status',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
    sameSite: 'lax',
  });

  redirect('/status');
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ width: 320, padding: 32, border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Voice Demo — Admin</h1>
        {params.error && (
          <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 16 }}>Password incorrecta.</p>
        )}
        <form action={login}>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Password</label>
          <input
            type="password"
            name="password"
            required
            autoFocus
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
          />
          <button
            type="submit"
            style={{ marginTop: 16, width: '100%', padding: '10px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Criar logout `app/api/status/logout/route.ts`**

```typescript
// app/api/status/logout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST() {
  const jar = await cookies();
  jar.delete('admin_token');
  return NextResponse.redirect(new URL('/status/login', process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'));
}
```

- [ ] **Step 4: Verificar em dev**

```bash
npm run dev
# Navegar para http://localhost:3000/status
# Deve redirecionar para /status/login
# Introduzir ADMIN_SECRET → deve redirecionar para /status (404 por agora — normal)
```

- [ ] **Step 5: Commit**

```bash
git add middleware.ts app/status/login/page.tsx app/api/status/logout/route.ts
git commit -m "feat(health): add admin auth middleware, login page and logout"
```

---

## Task 6: Dashboard `/status/page.tsx`

**Files:**
- Create: `app/status/page.tsx`

**Interfaces:**
- Consumes: tabela `health_checks` via `getSupabaseAdmin()`
- Consumes: cookie `admin_token` via `next/headers`

- [ ] **Step 1: Criar dashboard**

```tsx
// app/status/page.tsx
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type Row = {
  service: string;
  status: 'ok' | 'degraded' | 'fail';
  latency_ms: number | null;
  error_msg: string | null;
  checked_at: string;
};

const ICON = { ok: '✅', degraded: '⚠️', fail: '❌' } as const;
const COLOUR = { ok: '#16a34a', degraded: '#d97706', fail: '#dc2626' } as const;

async function getLatest(): Promise<Row[]> {
  const db = getSupabaseAdmin();
  // Último resultado por serviço
  const { data } = await db
    .from('health_checks')
    .select('service, status, latency_ms, error_msg, checked_at')
    .order('checked_at', { ascending: false })
    .limit(100);

  if (!data) return [];

  const seen = new Set<string>();
  return data.filter((r: Row) => {
    if (seen.has(r.service)) return false;
    seen.add(r.service);
    return true;
  });
}

async function getHistory(): Promise<{ service: string; ok: number; total: number }[]> {
  const db = getSupabaseAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from('health_checks')
    .select('service, status')
    .gte('checked_at', since);

  if (!data) return [];

  const map = new Map<string, { ok: number; total: number }>();
  for (const r of data as Pick<Row, 'service' | 'status'>[]) {
    const cur = map.get(r.service) ?? { ok: 0, total: 0 };
    cur.total++;
    if (r.status === 'ok') cur.ok++;
    map.set(r.service, cur);
  }
  return Array.from(map.entries()).map(([service, v]) => ({ service, ...v }));
}

export default async function StatusPage() {
  const [latest, history] = await Promise.all([getLatest(), getHistory()]);
  const historyMap = new Map(history.map((h) => [h.service, h]));
  const lastChecked = latest[0]?.checked_at
    ? new Date(latest[0].checked_at).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })
    : '—';
  const allOk = latest.every((r) => r.status === 'ok');

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 860, margin: '40px auto', padding: '0 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e3a5f' }}>
          {allOk ? '🟢' : '🔴'} Voice Demo — Health Status
        </h1>
        <form action="/api/status/logout" method="POST">
          <button type="submit" style={{ fontSize: 13, color: '#666', background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
            Logout
          </button>
        </form>
      </div>
      <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 32 }}>
        Último check: {lastChecked} (Europe/Lisbon)
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {['Serviço', 'Estado', 'Latência', 'Erro', 'Últimos 30 dias'].map((h) => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {latest.map((row) => {
            const h = historyMap.get(row.service);
            const pct = h ? Math.round((h.ok / h.total) * 100) : null;
            return (
              <tr key={row.service} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 14px', fontWeight: 500 }}>{row.service}</td>
                <td style={{ padding: '10px 14px', color: COLOUR[row.status] }}>
                  {ICON[row.status]} {row.status}
                </td>
                <td style={{ padding: '10px 14px', color: '#6b7280' }}>
                  {row.latency_ms != null ? `${row.latency_ms}ms` : '—'}
                </td>
                <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 12 }}>
                  {row.error_msg ?? '—'}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  {pct != null ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct > 90 ? '#16a34a' : pct > 70 ? '#d97706' : '#dc2626', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{pct}% ({h!.total}d)</span>
                    </div>
                  ) : '—'}
                </td>
              </tr>
            );
          })}
          {latest.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: '24px 14px', textAlign: 'center', color: '#9ca3af' }}>
                Sem dados — corre o cron pela primeira vez.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 2: Verificar em dev**

```bash
npm run dev
# Navegar para http://localhost:3000/status/login → login com ADMIN_SECRET
# Confirmar que dashboard carrega (com "Sem dados" se cron ainda não correu)
```

- [ ] **Step 3: Commit**

```bash
git add app/status/page.tsx
git commit -m "feat(health): add admin status dashboard"
```

---

## Task 7: Health endpoint no `twilio-agent` (Fly.io)

**Files:**
- Modify: `twilio-agent/server.js`

**Interfaces:**
- Produces: `GET /health` → `{"status":"ok","uptime":<seconds>}` na mesma porta 8080

- [ ] **Step 1: Verificar server.js actual**

```bash
cat /Users/raphaelbruno/voice-demo/twilio-agent/server.js
```

Confirmar que usa `WebSocketServer({ port: PORT })`.

- [ ] **Step 2: Ler o ficheiro antes de editar**

Ler `twilio-agent/server.js` via Read tool antes de qualquer edição.

- [ ] **Step 3: Substituir criação do WebSocketServer por HTTP + WS partilhados**

Localizar a linha:
```javascript
const wss = new WebSocketServer({ port: PORT });
```

Substituir por:
```javascript
import { createServer } from 'node:http';

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });
server.listen(PORT, () => {
  console.log(`[twilio-agent] HTTP+WS listening on :${PORT}`);
});
```

Remover o log antigo `console.log(\`[twilio-agent] ConversationRelay WS listening on :${PORT}\`)` se existir logo a seguir ao `new WebSocketServer`.

- [ ] **Step 4: Testar localmente**

```bash
cd twilio-agent && GEMINI_API_KEY=test node server.js &
curl http://localhost:8080/health
# Expected: {"status":"ok","uptime":<number>}
kill %1
```

- [ ] **Step 5: Deploy para Fly.io**

```bash
cd twilio-agent && flyctl deploy
```

Expected: deploy bem-sucedido. Confirmar com:
```bash
curl https://voice-demo-twilio-agent.fly.dev/health
```

- [ ] **Step 6: Commit**

```bash
git add twilio-agent/server.js
git commit -m "feat(health): add GET /health to twilio-agent"
```

---

## Task 8: Health endpoint no `livekit-agent` (Railway)

**Files:**
- Modify: `livekit-agent/agent.py`

**Interfaces:**
- Produces: `GET /health` na porta 8081 (porta separada da LiveKit) → `{"status":"ok"}`

- [ ] **Step 1: Ler `agent.py` antes de editar**

Ler `livekit-agent/agent.py` para encontrar o ponto de entrada `if __name__ == '__main__':` ou o bloco `cli.run_app(...)`.

- [ ] **Step 2: Adicionar servidor HTTP em daemon thread**

Localizar o bloco final do ficheiro (normalmente `cli.run_app(WorkerOptions(...))`).

Inserir antes desse bloco:

```python
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # silenciar logs de acesso


def _start_health_server(port: int = 8081) -> None:
    srv = HTTPServer(('', port), _HealthHandler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    logger.info(f"Health server listening on :{port}")
```

E na linha imediatamente antes de `cli.run_app(...)`:

```python
_start_health_server()
```

- [ ] **Step 3: Confirmar que `requirements.txt` não precisa de alterações**

O módulo `http.server` é da stdlib Python — não requer deps adicionais.

- [ ] **Step 4: Testar localmente**

```bash
cd livekit-agent
# Com vars mínimas (o agent vai falhar ao ligar ao LiveKit, mas o health server sobe)
LIVEKIT_URL=wss://test LIVEKIT_API_KEY=k LIVEKIT_API_SECRET=s GEMINI_API_KEY=g \
CALENDAR_ENDPOINT=http://localhost/api/book-meeting WEBHOOK_SECRET=s \
python agent.py start &
sleep 3
curl http://localhost:8081/health
# Expected: {"status":"ok"}
kill %1
```

- [ ] **Step 5: Deploy Railway**

```bash
git push origin main
# Railway faz deploy automático após push para main
```

Após deploy, confirmar no painel Railway que o serviço está activo.

- [ ] **Step 6: Adicionar env var `LIVEKIT_AGENT_HEALTH_URL` no Vercel**

No dashboard Vercel → Settings → Environment Variables:
```
LIVEKIT_AGENT_HEALTH_URL = https://<url-do-servico-railway>.up.railway.app
```

Nota: o URL exacto está em Railway → serviço `voice-demo` → Settings → Networking → Public URL.

- [ ] **Step 7: Commit**

```bash
git add livekit-agent/agent.py
git commit -m "feat(health): add GET /health daemon server to livekit-agent"
```

---

## Task 9: Adicionar env vars no Vercel + teste end-to-end

**Files:** (sem alterações de código)

- [ ] **Step 1: Adicionar env vars no Vercel**

No dashboard Vercel → Settings → Environment Variables, adicionar:

| Key | Value |
|---|---|
| `RESEND_API_KEY` | Chave do painel Resend (re-key → API Keys) |
| `ADMIN_SECRET` | String aleatória (ex: `openssl rand -hex 32`) |
| `HEALTH_EMAIL_FROM` | `health@raphaelbruno.dev` |
| `TWILIO_AGENT_HEALTH_URL` | `https://voice-demo-twilio-agent.fly.dev` |
| `LIVEKIT_AGENT_HEALTH_URL` | URL público do Railway (ver Task 8 Step 6) |

- [ ] **Step 2: Fazer push para `main` e aguardar deploy**

```bash
git push origin main
```

- [ ] **Step 3: Testar cron manualmente**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://voice-demo-navy.vercel.app/api/cron/health-check
```

Expected: JSON com `ok: true`, lista de 10 serviços, email recebido em `raphaelbruno.dev@gmail.com`.

- [ ] **Step 4: Verificar dashboard**

Navegar para `https://voice-demo-navy.vercel.app/status` → login → confirmar tabela com 10 serviços e barras de histórico.

- [ ] **Step 5: Commit final de verificação (se não houver alterações)**

```bash
git tag health-check-v1.0
```

---

## Checklist de cobertura da spec

- [x] Tabela `health_checks` com RLS — Task 1
- [x] 10 serviços verificados em paralelo — Task 3 (`runAllChecks`)
- [x] Thresholds ok/degraded/fail — Task 3 (`classify`)
- [x] Persistência 30 dias — Task 4 (insert + delete)
- [x] Email diário sempre — Task 4
- [x] Email alerta se fail — Task 4
- [x] Resend via domínio próprio — Task 2
- [x] Dashboard `/status` com tabela e barras — Task 6
- [x] Auth por cookie — Task 5
- [x] Login `/status/login` — Task 5
- [x] Logout — Task 5
- [x] Health endpoint Railway — Task 8
- [x] Health endpoint Fly.io — Task 7
- [x] Novas env vars documentadas — Tasks 2, 5, 9
- [x] `vercel.json` actualizado — Task 4
