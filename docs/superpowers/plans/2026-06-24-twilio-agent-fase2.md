# twilio-agent fase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar `book_meeting` tool calling ao twilio-agent com Gemini 2.5 Flash streaming nativo, nova route `/api/twilio/book-meeting`, e validação `X-Twilio-Signature` no TwiML endpoint.

**Architecture:** O twilio-agent (Node.js, Fly.io) usa `streamGenerateContent` SSE com Gemini 2.5 Flash. Quando o Gemini emite um chunk `functionCall`, o agent envia uma frase de transição ao ConversationRelay, executa o booking via POST ao Next.js, e retoma o stream com a confirmação. O Next.js expõe uma route `/api/twilio/book-meeting` autenticada por secret partilhado.

**Tech Stack:** Node.js ESM, Gemini 2.5 Flash SSE, Next.js App Router (TypeScript), `lib/book-meeting.ts`, `twilio` npm package para validateRequest.

## Global Constraints

- `twilio-agent/` usa ESM (`"type": "module"`) — todos os imports com `import`, não `require`
- Gemini endpoint: `streamGenerateContent?alt=sse` (mantém SSE)
- `TWILIO_AGENT_SECRET`: `<TWILIO_AGENT_SECRET>`
- `CALENDAR_ENDPOINT`: `https://voice-demo-navy.vercel.app/ai-agent-voice/api/twilio/book-meeting`
- Branch de trabalho: criar `feat/twilio-agent-fase2` antes de qualquer alteração
- Sempre PR para `main` — nunca commitar directamente

---

### Task 1: Nova route `/api/twilio/book-meeting`

**Files:**
- Create: `app/api/twilio/book-meeting/route.ts`

**Interfaces:**
- Consumes: `bookMeeting({ callerName, callerPhone, startTime })` de `@/lib/book-meeting` — retorna `{ success: boolean, meetingTime?: string }`
- Produces: `POST /ai-agent-voice/api/twilio/book-meeting` → `{ result: string }`

- [ ] **Step 1: Criar branch de trabalho**

```bash
cd /Users/raphaelbruno/voice-demo
git checkout -b feat/twilio-agent-fase2
```

- [ ] **Step 2: Criar a route**

Criar `app/api/twilio/book-meeting/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { bookMeeting } from '@/lib/book-meeting';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-twilio-agent-secret');
  if (!secret || secret !== process.env.TWILIO_AGENT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { callerName?: string; callerPhone?: string; startTime?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { callerName, callerPhone, startTime } = body;
  if (!callerName || !callerPhone || !startTime) {
    return NextResponse.json(
      { result: 'Faltam dados para marcar. Pede nome, telefone e hora.' },
      { status: 200 }
    );
  }

  const r = await bookMeeting({ callerName, callerPhone, startTime });
  return NextResponse.json({
    result: r.success
      ? `Ficou marcado para ${r.meetingTime}. O Raphael fala contigo em breve.`
      : 'Não consegui criar o evento agora. O Raphael contacta-te directamente.',
  });
}
```

- [ ] **Step 3: Adicionar `TWILIO_AGENT_SECRET` ao `.env.local`**

Abrir `/Users/raphaelbruno/voice-demo/.env.local` e adicionar no final:

```
TWILIO_AGENT_SECRET=<TWILIO_AGENT_SECRET>
```

- [ ] **Step 4: Testar a route localmente**

```bash
cd /Users/raphaelbruno/voice-demo
npm run dev &
sleep 5

# Sem secret → 401
curl -s -X POST http://localhost:3000/ai-agent-voice/api/twilio/book-meeting \
  -H "Content-Type: application/json" \
  -d '{"callerName":"Test","callerPhone":"+351912345678","startTime":"2026-06-26T10:00:00"}' | python3 -m json.tool
# Esperado: {"error":"Unauthorized"}

# Com secret → 200
curl -s -X POST http://localhost:3000/ai-agent-voice/api/twilio/book-meeting \
  -H "Content-Type: application/json" \
  -H "x-twilio-agent-secret: <TWILIO_AGENT_SECRET>" \
  -d '{"callerName":"Test","callerPhone":"+351912345678","startTime":"2026-06-26T10:00:00"}' | python3 -m json.tool
# Esperado: {"result":"Ficou marcado para ..."}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/twilio/book-meeting/route.ts
git commit -m "feat(twilio): add /api/twilio/book-meeting route with secret auth"
```

---

### Task 2: Validação X-Twilio-Signature no TwiML endpoint

**Files:**
- Modify: `app/api/twilio/twiml/route.ts`

**Interfaces:**
- Consumes: `twilio.validateRequest(authToken, signature, url, params)` → `boolean`
- Produces: POST `/ai-agent-voice/api/twilio/twiml` rejeita 403 se assinatura inválida

- [ ] **Step 1: Actualizar `app/api/twilio/twiml/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const TWIML_URL = 'https://voice-demo-navy.vercel.app/ai-agent-voice/api/twilio/twiml';

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const signature = req.headers.get('x-twilio-signature') ?? '';
    const valid = twilio.validateRequest(authToken, signature, TWIML_URL, {});
    if (!valid) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const relay = process.env.TWILIO_AGENT_WSS_URL;
  if (!relay) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="pt-PT">A demonstração ainda não está disponível. Volta em breve.</Say></Response>`,
      { headers: { 'content-type': 'text/xml' } }
    );
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><ConversationRelay url="${relay}" ttsProvider="amazon" voice="Polly.Ines-Neural" language="pt-PT" /></Connect></Response>`;
  return new NextResponse(xml, { headers: { 'content-type': 'text/xml' } });
}
```

Nota: a validação é ignorada se `TWILIO_AUTH_TOKEN` não estiver definido — permite testar localmente sem Twilio.

- [ ] **Step 2: Testar localmente**

```bash
# Sem assinatura (local sem TWILIO_AUTH_TOKEN → passa normalmente)
curl -s -X POST http://localhost:3000/ai-agent-voice/api/twilio/twiml
# Esperado: XML com ConversationRelay
```

- [ ] **Step 3: Commit**

```bash
git add app/api/twilio/twiml/route.ts
git commit -m "feat(twilio): validate X-Twilio-Signature on twiml endpoint"
```

---

### Task 3: twilio-agent — Gemini 2.5 Flash + tool calling

**Files:**
- Modify: `twilio-agent/server.js`

**Interfaces:**
- Consumes: `CALENDAR_ENDPOINT` env var (URL da route Next.js), `TWILIO_AGENT_SECRET` env var
- Produces: WebSocket envia `{type:"text", token, last}` ao ConversationRelay; chama `book_meeting` quando Gemini emite functionCall

- [ ] **Step 1: Substituir `twilio-agent/server.js` completo**

```javascript
import { WebSocketServer } from "ws";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT = readFileSync(join(__dirname, "system-prompt.txt"), "utf8");
const PORT = process.env.PORT || 8080;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`;
const CALENDAR_ENDPOINT = process.env.CALENDAR_ENDPOINT;
const TWILIO_AGENT_SECRET = process.env.TWILIO_AGENT_SECRET;

const TOOLS = [{
  functionDeclarations: [{
    name: "book_meeting",
    description: "Marca uma reunião com o Raphael Bruno no Google Calendar e envia confirmação por WhatsApp.",
    parameters: {
      type: "OBJECT",
      properties: {
        callerName:  { type: "STRING", description: "Nome completo do utilizador" },
        callerPhone: { type: "STRING", description: "Número de telefone com indicativo, ex: +351912345678" },
        startTime:   { type: "STRING", description: "Data e hora em ISO 8601, ex: 2026-06-26T10:00:00" },
      },
      required: ["callerName", "callerPhone", "startTime"],
    },
  }],
}];

const wss = new WebSocketServer({ port: PORT });
console.log(`[twilio-agent] ConversationRelay WS listening on :${PORT}`);

function safeSend(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

async function callBookMeeting(args) {
  if (!CALENDAR_ENDPOINT || !TWILIO_AGENT_SECRET) {
    return "Não consegui criar o evento agora. O Raphael contacta-te directamente.";
  }
  try {
    const res = await fetch(CALENDAR_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-twilio-agent-secret": TWILIO_AGENT_SECRET,
      },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    return data.result ?? "Não consegui criar o evento agora. O Raphael contacta-te directamente.";
  } catch (e) {
    console.error("[twilio-agent] book_meeting error:", e);
    return "Não consegui criar o evento agora. O Raphael contacta-te directamente.";
  }
}

async function streamGemini(history, ws) {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: history,
      tools: TOOLS,
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      generationConfig: { temperature: 0.2, maxOutputTokens: 200 },
    }),
  });

  let full = "";
  let functionCall = null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json || json === "[DONE]") continue;
      try {
        const chunk = JSON.parse(json);
        const part = chunk.candidates?.[0]?.content?.parts?.[0];
        if (!part) continue;

        if (part.functionCall) {
          functionCall = part.functionCall;
        } else if (part.text) {
          full += part.text;
          safeSend(ws, { type: "text", token: part.text, last: false });
        }
      } catch {}
    }
  }

  return { full, functionCall };
}

wss.on("connection", (ws) => {
  const history = [];

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "setup") {
      safeSend(ws, {
        type: "text",
        token: "Olá! Sou um agente de voz com inteligência artificial, uma demonstração ao vivo criada pelo Raphael Bruno. Como posso ajudar?",
        last: true,
      });
      return;
    }

    if (msg.type === "prompt") {
      const userText = msg.voicePrompt ?? "";
      if (!userText) return;
      history.push({ role: "user", parts: [{ text: userText }] });

      try {
        const { full, functionCall } = await streamGemini(history, ws);

        if (functionCall) {
          // Fechar o turno de texto antes do tool call
          if (full) {
            safeSend(ws, { type: "text", token: "", last: true });
          } else {
            safeSend(ws, { type: "text", token: "Um momento, vou marcar já.", last: true });
          }

          // Adicionar functionCall ao histórico
          history.push({ role: "model", parts: [{ functionCall }] });

          // Executar o booking
          const result = await callBookMeeting(functionCall.args ?? {});

          // Adicionar functionResponse ao histórico
          history.push({
            role: "user",
            parts: [{ functionResponse: { name: functionCall.name, response: { result } } }],
          });

          // Obter confirmação do Gemini
          const { full: confirmFull } = await streamGemini(history, ws);
          history.push({ role: "model", parts: [{ text: confirmFull }] });
          safeSend(ws, { type: "text", token: "", last: true });
        } else {
          safeSend(ws, { type: "text", token: "", last: true });
          history.push({ role: "model", parts: [{ text: full }] });
        }
      } catch (e) {
        console.error("[twilio-agent] LLM error:", e);
        safeSend(ws, { type: "text", token: "Desculpa, tive um problema técnico.", last: true });
      }
    }
  });

  ws.on("error", (err) => console.error("[twilio-agent] ws error:", err));
  ws.on("close", () => console.log("[twilio-agent] connection closed"));
});
```

- [ ] **Step 2: Testar arranque local**

```bash
cd /Users/raphaelbruno/voice-demo/twilio-agent
GEMINI_API_KEY=<your-gemini-api-key> \
CALENDAR_ENDPOINT=https://voice-demo-navy.vercel.app/ai-agent-voice/api/twilio/book-meeting \
TWILIO_AGENT_SECRET=<TWILIO_AGENT_SECRET> \
node server.js
# Esperado: [twilio-agent] ConversationRelay WS listening on :8080
# Sem erros de syntax ou import
```

- [ ] **Step 3: Commit**

```bash
git add twilio-agent/server.js
git commit -m "feat(twilio-agent): gemini-2.5-flash + book_meeting tool calling via SSE"
```

---

### Task 4: Env vars — Vercel + Fly.io

**Files:**
- No files — configuração externa

- [ ] **Step 1: Adicionar `TWILIO_AGENT_SECRET` ao Vercel via CLI**

```bash
cd /Users/raphaelbruno/voice-demo
npx vercel env add TWILIO_AGENT_SECRET production
# Quando pedir o valor: <TWILIO_AGENT_SECRET>
```

- [ ] **Step 2: Adicionar secrets ao Fly.io**

```bash
cd /Users/raphaelbruno/voice-demo/twilio-agent
flyctl secrets set \
  TWILIO_AGENT_SECRET=<TWILIO_AGENT_SECRET> \
  CALENDAR_ENDPOINT=https://voice-demo-navy.vercel.app/ai-agent-voice/api/twilio/book-meeting
```

- [ ] **Step 3: Commit env var documentação no CLAUDE.md**

Abrir `/Users/raphaelbruno/voice-demo/CLAUDE.md`, localizar secção `### Twilio ConversationRelay` e adicionar:

```
| `TWILIO_AGENT_SECRET` | `/api/twilio/book-meeting` + twilio-agent Fly.io (x-twilio-agent-secret) |
| `TWILIO_AGENT_WSS_URL` | `/api/twilio/twiml` — wss://voice-demo-twilio-agent.fly.dev |
```

```bash
git add CLAUDE.md
git commit -m "docs(claude): add TWILIO_AGENT_SECRET env var"
```

---

### Task 5: Deploy + verificação end-to-end

**Files:**
- No files — deploy e teste

- [ ] **Step 1: Push branch e criar PR**

```bash
git push origin feat/twilio-agent-fase2
gh pr create \
  --title "feat(twilio): book_meeting tool calling + TwiML signature validation" \
  --body "Gemini 2.5 Flash com tool calling nativo via SSE. Nova route /api/twilio/book-meeting. Validação X-Twilio-Signature no twiml endpoint."
```

- [ ] **Step 2: Merge PR e aguardar Vercel deploy**

Após merge para `main`, aguardar Vercel deploy (~2 min).

- [ ] **Step 3: Deploy twilio-agent ao Fly.io**

```bash
cd /Users/raphaelbruno/voice-demo/twilio-agent
flyctl deploy
```

Aguardar: `==> Release v* created` e `✓ Machine ... [started]`

- [ ] **Step 4: Verificar route em produção**

```bash
# Sem secret → 401
curl -s -X POST https://voice-demo-navy.vercel.app/ai-agent-voice/api/twilio/book-meeting \
  -H "Content-Type: application/json" \
  -d '{"callerName":"Test","callerPhone":"+351912345678","startTime":"2026-06-26T10:00:00"}'
# Esperado: {"error":"Unauthorized"}

# Com secret → 200
curl -s -X POST https://voice-demo-navy.vercel.app/ai-agent-voice/api/twilio/book-meeting \
  -H "Content-Type: application/json" \
  -H "x-twilio-agent-secret: <TWILIO_AGENT_SECRET>" \
  -d '{"callerName":"Test","callerPhone":"+351912345678","startTime":"2026-06-26T10:00:00"}'
# Esperado: {"result":"Ficou marcado para ..."}
```

- [ ] **Step 5: Teste de voz via raphaelbruno.dev/ai-agent-voice/twilio/**

Abrir browser → `raphaelbruno.dev/ai-agent-voice/twilio/` → iniciar chamada → qualificar até agendamento → confirmar que o Gemini chama `book_meeting` e devolve confirmação audível.
