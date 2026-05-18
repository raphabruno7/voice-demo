# book_meeting Tool — Hume EVI 4-mini Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o tool `book_meeting` server-side para Hume EVI 4-mini, permitindo à Ana marcar reuniões de 30 minutos directamente no Google Calendar via voz.

**Architecture:** Os servidores Hume chamam `POST /api/book-meeting` quando Ana invoca `book_meeting`. O endpoint valida `x-hume-secret`, chama `createEvent` (já existe em `lib/google-calendar.ts`), devolve `{ success, meetingTime }` em pt-PT. Ana lê a resposta e confirma ao utilizador. Sem alterações ao `HumeWidget.tsx` nem ao `/api/calendar` (Vapi fica intacto).

**Tech Stack:** Next.js App Router (route handler), googleapis, Hume EVI API, vitest

---

## File Map

| Ficheiro | Acção |
|---|---|
| `lib/google-calendar.ts` | Modificar — adicionar `callerPhone` opcional |
| `lib/google-calendar.test.ts` | Modificar — adicionar testes para `callerPhone` |
| `app/api/book-meeting/route.ts` | Criar — endpoint Hume com auth `x-hume-secret` |
| `app/api/book-meeting/route.test.ts` | Criar — testes do endpoint |
| `hume/system-prompt.txt` | Modificar — actualizar secção MARCAÇÃO |
| `.env.local` | Modificar — adicionar `HUME_TOOL_SECRET` |
| `CLAUDE.md` | Modificar — documentar tool e env var |

`app/api/calendar/route.ts` e `components/HumeWidget.tsx` — **sem alterações**.

---

## Task 1: Actualizar `lib/google-calendar.ts` para aceitar `callerPhone`

**Files:**
- Modify: `lib/google-calendar.ts`
- Modify: `lib/google-calendar.test.ts`

- [ ] **Step 1.1: Adicionar testes para `callerPhone` em `lib/google-calendar.test.ts`**

Acrescentar dois `it` dentro do `describe('createEvent', ...)` existente:

```typescript
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
```

- [ ] **Step 1.2: Correr testes para confirmar que falham**

```bash
npm test
```

Esperado: 2 FAIL — `callerPhone` não existe na assinatura.

- [ ] **Step 1.3: Actualizar `lib/google-calendar.ts`**

Substituir o conteúdo completo:

```typescript
import { google } from 'googleapis';

export async function createEvent({
  callerName,
  callerPhone,
  startTime,
}: {
  callerName: string;
  callerPhone?: string;
  startTime: string;
}) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  const calendar = google.calendar({ version: 'v3', auth });
  const start = new Date(startTime);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const descriptionParts = ['Booked via Ana voice AI agent (voice-demo)'];
  if (callerPhone) descriptionParts.push(`Tel: ${callerPhone}`);

  const res = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID!,
    requestBody: {
      summary: `Demo — ${callerName}`,
      description: descriptionParts.join('\n'),
      start: { dateTime: start.toISOString(), timeZone: 'Europe/Lisbon' },
      end: { dateTime: end.toISOString(), timeZone: 'Europe/Lisbon' },
    },
  });

  return {
    eventId: res.data.id!,
    htmlLink: res.data.htmlLink!,
    startTime: res.data.start?.dateTime ?? startTime,
  };
}
```

- [ ] **Step 1.4: Correr testes para confirmar que passam**

```bash
npm test
```

Esperado: todos os testes PASS.

- [ ] **Step 1.5: Commit**

```bash
git add lib/google-calendar.ts lib/google-calendar.test.ts
git commit -m "feat(calendar): add optional callerPhone to createEvent"
```

---

## Task 2: Criar `app/api/book-meeting/route.ts` com testes

**Files:**
- Create: `app/api/book-meeting/route.ts`
- Create: `app/api/book-meeting/route.test.ts`

- [ ] **Step 2.1: Criar `app/api/book-meeting/route.test.ts`**

```typescript
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
```

- [ ] **Step 2.2: Correr testes para confirmar que falham**

```bash
npm test
```

Esperado: FAIL — `app/api/book-meeting/route.ts` não existe.

- [ ] **Step 2.3: Criar `app/api/book-meeting/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createEvent } from '@/lib/google-calendar';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-hume-secret');
  if (!secret || secret !== process.env.HUME_TOOL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { callerName, callerPhone, startTime } = body as {
    callerName?: string;
    callerPhone?: string;
    startTime?: string;
  };

  if (!callerName || !callerPhone || !startTime) {
    return NextResponse.json(
      { error: 'callerName, callerPhone and startTime are required' },
      { status: 400 }
    );
  }

  try {
    await createEvent({ callerName, callerPhone, startTime });
    const meetingTime = new Date(startTime).toLocaleString('pt-PT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Lisbon',
    });
    return NextResponse.json({ success: true, meetingTime });
  } catch (err) {
    console.error('[/api/book-meeting] createEvent failed:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to create calendar event' },
      { status: 200 }
    );
  }
}
```

> Nota: o erro devolve HTTP 200 (não 500) porque Hume trata qualquer não-200 como falha de rede. O `success: false` é suficiente para a Ana usar o `fallback_content`.

- [ ] **Step 2.4: Correr testes**

```bash
npm test
```

Esperado: todos os testes PASS.

- [ ] **Step 2.5: Commit**

```bash
git add app/api/book-meeting/
git commit -m "feat(api): add /api/book-meeting route for Hume server-side tool"
```

---

## Task 3: Gerar `HUME_TOOL_SECRET` e adicionar ao env

**Files:**
- Modify: `.env.local`
- Vercel: production + development

- [ ] **Step 3.1: Gerar secret**

```bash
openssl rand -hex 32
```

Copia o output — será usado nos próximos passos. Exemplo (não usar este):
`a3f8c2e1d4b7a9f0e2c5d8b1a4f7e0c3d6b9a2f5e8c1d4b7a0f3e6c9d2b5a8f1`

- [ ] **Step 3.2: Adicionar ao `.env.local`**

Acrescentar ao `.env.local` (não substituir o conteúdo — só adicionar a linha):

```
HUME_TOOL_SECRET=<valor-gerado-no-step-3.1>
```

- [ ] **Step 3.3: Adicionar ao Vercel (production e development)**

```bash
vercel env add HUME_TOOL_SECRET production --value "<valor>" --yes
vercel env add HUME_TOOL_SECRET development --value "<valor>" --yes
```

Verificar:
```bash
vercel env ls production | grep HUME_TOOL
```

Esperado: `HUME_TOOL_SECRET   Encrypted   Production`.

---

## Task 4: Criar tool no Hume e actualizar config

**Files:**
- Hume API: criar tool resource, actualizar config

- [ ] **Step 4.1: Criar tool resource no Hume**

```bash
curl -s -X POST "https://api.hume.ai/v0/evi/tools" \
  -H "X-Hume-Api-Key: $HUME_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "book_meeting",
    "description": "Books a 30-minute demo meeting with Raphael in Google Calendar. Call when the user agrees to schedule and provides name, phone, and preferred time.",
    "parameters": "{\"type\":\"object\",\"properties\":{\"callerName\":{\"type\":\"string\",\"description\":\"Full name or first name of the caller\"},\"callerPhone\":{\"type\":\"string\",\"description\":\"Caller phone number as spoken, e.g. +351 912 345 678\"},\"startTime\":{\"type\":\"string\",\"description\":\"ISO 8601 datetime for meeting start. Morning = 10:00, Afternoon = 15:00. Use today as base for relative dates.\"}},\"required\":[\"callerName\",\"callerPhone\",\"startTime\"]}",
    "fallback_content": "Não consegui criar o evento. O Raphael vai contactar directamente.",
    "webhook_url": "https://voice-demo-navy.vercel.app/api/book-meeting",
    "webhook_secret": "<HUME_TOOL_SECRET gerado no Task 3>"
  }' | python3 -m json.tool
```

Copiar o `id` devolvido — exemplo: `"id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`.

- [ ] **Step 4.2: Actualizar config Hume com o tool**

Substituir `<TOOL_ID>` pelo ID obtido no Step 4.1:

```bash
python3 -c "
import json

prompt = open('hume/system-prompt.txt').read()

payload = {
  'evi_version': '4-mini',
  'name': 'Ana - Agent Voice',
  'voice': {'provider': 'HUME_AI', 'id': '7e4077d4-3f17-4012-bab2-18fd53b0c173'},
  'language_model': {
    'model_provider': 'ANTHROPIC',
    'model_resource': 'claude-sonnet-4-20250514',
    'temperature': 0.2
  },
  'prompt': {'text': prompt},
  'tools': [{'tool_type': 'TOOL', 'id': '<TOOL_ID>'}],
  'event_messages': {
    'on_new_chat': {'enabled': True, 'text': 'Olá! Sou a Ana, uma demonstração ao vivo de um agente de IA criado pelo Raphael Bruno. Como posso ajudar?'},
    'on_resume_chat': {'enabled': False, 'text': None},
    'on_inactivity_timeout': {'enabled': False, 'text': None},
    'on_max_duration_timeout': {'enabled': False, 'text': None}
  },
  'turn_detection': {'end_of_turn_silence_ms': 500, 'prefix_padding_ms': 300},
  'builtin_tools': [{'tool_type': 'BUILTIN', 'name': 'hang_up', 'fallback_content': None}]
}
print(json.dumps(payload))
" | curl -s -X POST "https://api.hume.ai/v0/evi/configs/7fd9f653-21d8-42db-b3df-c287d5899ec2" \
  -H "X-Hume-Api-Key: $HUME_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- | python3 -c "import json,sys; d=json.load(sys.stdin); print('version:', d.get('version')); print('tools:', d.get('tools')); print('error:', d.get('error','none'))"
```

Esperado: `version: 23`, `tools: [{'id': '<TOOL_ID>', ...}]`.

---

## Task 5: Actualizar system prompt com instruções de booking

**Files:**
- Modify: `hume/system-prompt.txt`

- [ ] **Step 5.1: Substituir a secção MARCAÇÃO em `hume/system-prompt.txt`**

Localizar:
```
MARCAÇÃO:
Se houver interesse genuíno: "Posso marcar quinze minutos com o Raphael agora. Diz-me o seu nome e prefere de manhã ou à tarde?"
```

Substituir por:
```
MARCAÇÃO:
Se houver interesse genuíno, pede em sequência (uma pergunta de cada vez):
1. "Qual é o teu nome?"
2. "E o teu número de telefone?"
3. "Preferes de manhã ou à tarde? E que dia desta semana?"

Depois chama o tool book_meeting com callerName, callerPhone e startTime em ISO 8601.
Ao receber confirmação, diz: "Ficou marcado para [meetingTime]. O Raphael fala contigo em breve."
```

- [ ] **Step 5.2: Push do prompt actualizado ao Hume**

```bash
python3 -c "
import json

prompt = open('hume/system-prompt.txt').read()

payload = {
  'evi_version': '4-mini',
  'name': 'Ana - Agent Voice',
  'voice': {'provider': 'HUME_AI', 'id': '7e4077d4-3f17-4012-bab2-18fd53b0c173'},
  'language_model': {
    'model_provider': 'ANTHROPIC',
    'model_resource': 'claude-sonnet-4-20250514',
    'temperature': 0.2
  },
  'prompt': {'text': prompt},
  'tools': [{'tool_type': 'TOOL', 'id': '<TOOL_ID-do-Task-4>'}],
  'event_messages': {
    'on_new_chat': {'enabled': True, 'text': 'Olá! Sou a Ana, uma demonstração ao vivo de um agente de IA criado pelo Raphael Bruno. Como posso ajudar?'},
    'on_resume_chat': {'enabled': False, 'text': None},
    'on_inactivity_timeout': {'enabled': False, 'text': None},
    'on_max_duration_timeout': {'enabled': False, 'text': None}
  },
  'turn_detection': {'end_of_turn_silence_ms': 500, 'prefix_padding_ms': 300},
  'builtin_tools': [{'tool_type': 'BUILTIN', 'name': 'hang_up', 'fallback_content': None}]
}
print(json.dumps(payload))
" | curl -s -X POST "https://api.hume.ai/v0/evi/configs/7fd9f653-21d8-42db-b3df-c287d5899ec2" \
  -H "X-Hume-Api-Key: $HUME_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- | python3 -c "import json,sys; d=json.load(sys.stdin); print('version:', d.get('version')); print('error:', d.get('error','none'))"
```

- [ ] **Step 5.3: Commit**

```bash
git add hume/system-prompt.txt
git commit -m "feat(prompt): add book_meeting instructions with phone collection flow"
```

---

## Task 6: Actualizar CLAUDE.md e commit final

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 6.1: Adicionar `HUME_TOOL_SECRET` à tabela de env vars activas no CLAUDE.md**

Na secção `### Activas (Hume + Supabase + Calendar)`, adicionar linha:

```
| `HUME_TOOL_SECRET` | Auth header `x-hume-secret` em `/api/book-meeting` |
```

- [ ] **Step 6.2: Actualizar a nota sobre `book_meeting` nos Pendentes**

Substituir:
```
- **`book_meeting` tool** — não implementado. Falta: (a) criar custom tool...
```

Por:
```
- **`book_meeting` tool** — ✅ implementado via server-side Hume tool. Tool ID: `<ID-do-Task-4.1>`. Endpoint: `/api/book-meeting`. Auth: `HUME_TOOL_SECRET`.
```

- [ ] **Step 6.3: Commit e push**

```bash
git add CLAUDE.md app/api/book-meeting/ lib/google-calendar.ts lib/google-calendar.test.ts hume/system-prompt.txt
git commit -m "feat(ana): implement book_meeting tool — Hume server-side, Google Calendar"
git push origin main
```

---

## Teste manual pós-deploy

Após Vercel redeployar:

```bash
# Testar directamente o endpoint com curl
curl -s -X POST "https://voice-demo-navy.vercel.app/api/book-meeting" \
  -H "Content-Type: application/json" \
  -H "x-hume-secret: <HUME_TOOL_SECRET>" \
  -d '{
    "callerName": "Teste Manual",
    "callerPhone": "+351 912 000 000",
    "startTime": "2026-05-21T10:00:00"
  }'
```

Esperado: `{"success":true,"meetingTime":"quinta-feira, 21 de maio às 10:00"}` + evento no Google Calendar.

Em seguida, testar com a Ana via `voice-demo-navy.vercel.app` — dizer interesse genuíno, fornecer nome e telefone.
