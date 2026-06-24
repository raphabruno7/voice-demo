# twilio-agent fase 2 — Design Spec

**Data:** 2026-06-24  
**Scope:** tool calling `book_meeting` + validação assinatura TwiML  
**Repos afectados:** `voice-demo` (Next.js + twilio-agent)

---

## Objectivo

Adicionar `book_meeting` tool calling ao twilio-agent (Node.js, Fly.io) usando Gemini 2.5 Flash com streaming nativo, e validar a assinatura Twilio em `/api/twilio/twiml`.

---

## Arquitectura

```
ConversationRelay (Twilio PSTN/WebRTC)
        │ WebSocket
        ▼
  twilio-agent (Fly.io, Node.js)
   gemini-2.5-flash streamGenerateContent SSE
        │
        ├─ text chunk    → {type:"text", token, last:false}
        ├─ functionCall  → enviar transição → executar booking → enviar confirmação
        └─ fim de stream → {type:"text", token:"", last:true}
                │
                └─ functionCall path:
                   1. {type:"text", token:"Um momento, vou marcar já.", last:true}
                   2. POST /api/twilio/book-meeting (x-twilio-agent-secret)
                   3. functionResponse → novo streamGenerateContent
                   4. stream tokens da confirmação → last:true
```

---

## Componentes

### 1. twilio-agent/server.js

**Mudanças:**
- Modelo: `gemini-2.0-flash` → `gemini-2.5-flash`
- URL: `streamGenerateContent` (mantém SSE)
- Adicionar `tools` ao body do pedido Gemini:

```json
{
  "tools": [{
    "functionDeclarations": [{
      "name": "book_meeting",
      "description": "Marca uma reunião com o Raphael Bruno",
      "parameters": {
        "type": "OBJECT",
        "properties": {
          "callerName":  { "type": "STRING" },
          "callerPhone": { "type": "STRING" },
          "startTime":   { "type": "STRING", "description": "ISO 8601" }
        },
        "required": ["callerName", "callerPhone", "startTime"]
      }
    }]
  }],
  "toolConfig": { "functionCallingConfig": { "mode": "AUTO" } }
}
```

**Parser SSE:**
- Detectar `candidates[0].content.parts[0].functionCall` nos chunks
- Quando detectado:
  1. `safeSend(ws, { type:"text", token:"Um momento, vou marcar já.", last:true })`
  2. `POST CALENDAR_ENDPOINT { callerName, callerPhone, startTime }` com header `x-twilio-agent-secret`
  3. Adicionar `functionCall` + `functionResponse` ao `history`
  4. Novo `streamGenerateContent` → stream tokens da confirmação → `last:true`

**Nova env var:** `CALENDAR_ENDPOINT` — URL da route Next.js (`https://voice-demo-navy.vercel.app/ai-agent-voice/api/twilio/book-meeting`)  
**Nova env var:** `TWILIO_AGENT_SECRET` — secret partilhado com Next.js

---

### 2. app/api/twilio/book-meeting/route.ts (novo)

```
POST /api/twilio/book-meeting
Header: x-twilio-agent-secret: <TWILIO_AGENT_SECRET>
Body: { callerName, callerPhone, startTime }
Response: { result: "Ficou marcado para <meetingTime>. O Raphael fala contigo em breve." }
         | { result: "Não consegui criar o evento. O Raphael contacta-te directamente." }
```

- Valida header `x-twilio-agent-secret` == `TWILIO_AGENT_SECRET`
- Chama `bookMeeting({ callerName, callerPhone, startTime })` de `lib/book-meeting.ts`
- Padrão idêntico a `app/api/vapi/book-meeting/route.ts`

---

### 3. app/api/twilio/twiml/route.ts (actualizar)

Adicionar validação `X-Twilio-Signature`:

```ts
import twilio from 'twilio';

const url = `https://voice-demo-navy.vercel.app/ai-agent-voice/api/twilio/twiml`;
const valid = twilio.validateRequest(
  process.env.TWILIO_AUTH_TOKEN!,
  req.headers.get('x-twilio-signature') ?? '',
  url,
  {}
);
if (!valid) return new NextResponse('Forbidden', { status: 403 });
```

---

## Environment Variables

| Var | Onde | Valor |
|---|---|---|
| `TWILIO_AGENT_SECRET` | Vercel + Fly.io secrets | novo secret (gerar uuid) |
| `CALENDAR_ENDPOINT` | Fly.io secrets | `https://voice-demo-navy.vercel.app/ai-agent-voice/api/twilio/book-meeting` |

---

## Fluxo completo (exemplo)

```
Utilizador: "Quero marcar uma reunião"
Agent: "Qual é o teu nome?" → "Pedro Costa"
Agent: "E o teu número?" → "+351 912 345 678"
Agent: "Que dia?" → "quinta-feira de manhã"

Gemini emite functionCall:
  book_meeting({ callerName:"Pedro Costa", callerPhone:"+351912345678", startTime:"2026-06-26T10:00:00" })

twilio-agent:
  → WS: {type:"text", token:"Um momento, vou marcar já.", last:true}
  → POST /api/twilio/book-meeting → bookMeeting() → Google Calendar + WhatsApp
  → Gemini stream com functionResponse
  → WS: {type:"text", token:"Ficou marcado para quinta-feira às dez da manhã.", last:true}
```

---

## Fora de scope

- Outbound calls via Twilio (fase 3)
- Transferência de chamada
- Multi-tool (só `book_meeting`)
