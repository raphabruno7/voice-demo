# Design: book_meeting tool — Hume EVI 4-mini (server-side)

**Data:** 2026-05-18  
**Estado:** aprovado pelo utilizador

---

## Contexto

A Ana (Hume EVI 4-mini, voz "A Viajante de Alma") conversa com visitantes do portfolio e qualifica interesse. Quando há interesse genuíno, deve marcar uma reunião de 30 minutos com o Raphael directamente no Google Calendar.

O caminho Vapi já tem este tool implementado via `/api/calendar` (auth `x-vapi-secret`). Este spec cobre a implementação para Hume usando o modelo server-side: os servidores Hume chamam um endpoint HTTP quando Ana invoca o tool.

---

## Abordagem: Server-side tool call (Opção B)

Os servidores Hume chamam `POST /api/book-meeting` com os parâmetros do tool. O endpoint valida `x-hume-secret`, cria o evento no Google Calendar via service account existente, devolve confirmação. Ana lê a resposta e confirma ao utilizador.

Zero alterações ao `HumeWidget.tsx` ou ao `/api/calendar` (Vapi fica intacto).

---

## Componentes

### 1. `app/api/book-meeting/route.ts` (novo)

**Input (body JSON):**
```json
{
  "callerName": "João Silva",
  "callerPhone": "+351 912 345 678",
  "startTime": "2026-05-20T10:00:00"
}
```

**Auth:** header `x-hume-secret` validado contra `process.env.HUME_TOOL_SECRET`. Retorna 401 em mismatch.

**Lógica:**
1. Valida presença de `callerName`, `callerPhone`, `startTime`
2. Chama `createEvent({ callerName, callerPhone, startTime })`
3. Formata data/hora em pt-PT (`Europe/Lisbon`, língua `pt-PT`)
4. Devolve `{ success: true, meetingTime: "quarta-feira, 20 de maio às 10:00" }`

**Erro:** `{ success: false, error: "Failed to create calendar event" }` — Hume fala o `fallback_content` do tool.

---

### 2. `lib/google-calendar.ts` (update)

Adicionar `callerPhone` opcional ao tipo de input. Incluir na `description` do evento:

```
Booked via Ana voice AI agent (voice-demo)
Tel: +351 912 345 678
```

---

### 3. Hume config — tool `book_meeting` (via API)

Adicionado ao config `7fd9f653-21d8-42db-b3df-c287d5899ec2` via `POST /v0/evi/configs/{id}` (PUT-style, payload completo).

**Definição do tool:**
```json
{
  "type": "function",
  "name": "book_meeting",
  "description": "Marks a 30-minute demo meeting with Raphael in Google Calendar. Call when the user agrees to schedule and provides name, phone, and preferred time.",
  "parameters": {
    "type": "object",
    "properties": {
      "callerName": {
        "type": "string",
        "description": "Full name or first name of the caller"
      },
      "callerPhone": {
        "type": "string",
        "description": "Caller's phone number as spoken (e.g. +351 912 345 678)"
      },
      "startTime": {
        "type": "string",
        "description": "ISO 8601 datetime for the meeting start. Morning = 10:00, Afternoon = 15:00. Use today's date as base for relative times."
      }
    },
    "required": ["callerName", "callerPhone", "startTime"]
  }
}
```

**URL:** `https://voice-demo-navy.vercel.app/api/book-meeting`  
**Header:** `x-hume-secret: <HUME_TOOL_SECRET>`  
**fallback_content:** `"Não consegui criar o evento. O Raphael vai contactar directamente."`

---

### 4. System prompt `hume/system-prompt.txt` (update)

Substituir secção `MARCAÇÃO` actual por:

```
MARCAÇÃO:
Se houver interesse genuíno, pede em sequência (uma pergunta de cada vez):
1. "Qual é o teu nome?"
2. "E o teu número de telefone?"
3. "Preferes de manhã ou à tarde? E que dia desta semana?"

Depois chama o tool book_meeting com callerName, callerPhone e startTime (ISO 8601).
Ao receber confirmação, diz: "Ficou marcado para [meetingTime]. O Raphael fala contigo em breve."
```

---

### 5. Variável de ambiente `HUME_TOOL_SECRET`

- Gerada com `openssl rand -hex 32`
- Adicionada a `.env.local`
- Adicionada ao Vercel (production + development) via `vercel env add`

---

## Dev local

Para testar server-side tool calls localmente, o Hume precisa de alcançar o endpoint:

```bash
ngrok http 3000
# Configurar HUME_TOOL_URL_OVERRIDE=https://<ngrok>.ngrok.io/api/book-meeting
# temporariamente no config Hume
```

Para testes sem ngrok: pode-se testar o endpoint directamente via `curl` com o `HUME_TOOL_SECRET`.

---

## Ficheiros modificados

| Ficheiro | Acção |
|---|---|
| `app/api/book-meeting/route.ts` | Criar |
| `lib/google-calendar.ts` | Actualizar (+ callerPhone) |
| `hume/system-prompt.txt` | Actualizar secção MARCAÇÃO |
| `.env.local` | Adicionar `HUME_TOOL_SECRET` |
| Hume config via API | Adicionar tool + push config |
| `CLAUDE.md` | Documentar tool e env var |

`app/api/calendar/route.ts` e `components/HumeWidget.tsx` — **sem alterações**.

---

## Fora de âmbito

- Envio de SMS/email de confirmação ao utilizador
- Interface de admin para ver agendamentos (já existe via Google Calendar)
- Validação de conflitos de agenda (Google Calendar gere isso)
