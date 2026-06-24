@AGENTS.md

# voice-demo

Portfolio demo de Raphael Bruno — voice AI agent multilíngue com 6 provedores em paralelo para comparação de pipelines. Branding público: «24/7 Voice Agent» / «Agente de Voz 24/7» (white-label). Stack: Next.js 16 (App Router, Turbopack) + Vercel; Python livekit-agent (Railway — projecto `balanced-appreciation`); Node twilio-agent (Fly.io).

## Provedores

| Provedor | Estado | Pipeline | Voz | Página |
|---|---|---|---|---|
| **Hume EVI 4-mini** | ✅ Activo | End-to-end pt-PT, prosódia adaptativa | "A Viajante de Alma" (Octave) | `/` |
| **LiveKit + Gemini Live** | ✅ Activo | `gemini-2.5-flash-native-audio-latest` | Aoede | `/livekit` |
| **ElevenLabs ConvAI** | ✅ Activo | STT + LLM + TTS pipeline | Marta (pt-PT) | `/elevenlabs` |
| **Vapi** | ✅ Activo | Orquestrador browser — Gemini 2.5 Flash | Sarah (EN) | `/vapi` |
| **Retell AI** | ✅ Activo | Orquestrador browser — Gemini 3.0 Flash | Cartesia Cleo (EN) | `/retell` |
| **Twilio ConversationRelay** | ✅ Activo (WebRTC) | ConversationRelay + Fly.io — Gemini 2.0 Flash | Polly.Ines-Neural (pt-PT) | `/twilio` |

Config detalhado de cada provedor: [docs/providers.md](docs/providers.md)

## Booking tool (partilhado)

`lib/book-meeting.ts` → `bookMeeting({callerName, callerPhone, startTime})` — cria evento no Google Calendar e envia WhatsApp. Cada provedor tem a sua route com auth/parse próprios:

| Route | Auth header | Env var |
|---|---|---|
| `/api/book-meeting` | `x-hume-secret` | `HUME_TOOL_SECRET` |
| `/api/vapi/book-meeting` | `x-vapi-secret` | `VAPI_WEBHOOK_SECRET` |
| `/api/retell/book-meeting` | `x-retell-secret` | `RETELL_WEBHOOK_SECRET` |

Retell envia o payload em `body.args` (Vapi envia em `toolCallList[0].function.arguments`).

## twilio-agent (Fly.io)

Standalone WebSocket server, **não** corre na Vercel. Deploy permanente em `wss://voice-demo-twilio-agent.fly.dev` (app `voice-demo-twilio-agent`, região `cdg`, 256MB, `auto_stop=off`, `min_machines_running=1`).

Protocolo: `{type:"setup"}` → saudação; `{type:"prompt", voicePrompt}` → stream Gemini 2.0 Flash via `fetch` SSE → `{type:"text", token, last}`.

**Re-deploy:** `cd twilio-agent && flyctl deploy`

## Estrutura

```
app/
  page.tsx                          # / → Hume EVI
  livekit/page.tsx                  # /livekit → Gemini Live
  elevenlabs/page.tsx               # /elevenlabs → ElevenLabs ConvAI
  vapi/page.tsx                     # /vapi → Vapi
  retell/page.tsx                   # /retell → Retell AI
  twilio/page.tsx                   # /twilio → Twilio
  api/
    hume/access-token/route.ts      # OAuth Hume
    book-meeting/route.ts           # Tool Hume + LiveKit
    livekit/token/route.ts          # LiveKit JWT
    livekit/webhook/route.ts        # Room events → Supabase
    elevenlabs/signed-url/route.ts  # ElevenLabs signed URL
    vapi/book-meeting/route.ts      # Tool Vapi
    retell/web-call/route.ts        # Retell access token
    retell/book-meeting/route.ts    # Tool Retell
    twilio/token/route.ts           # Twilio Voice JWT
    twilio/twiml/route.ts           # TwiML App Voice URL
    appointments/*/route.ts         # Tools outbound (confirm/reschedule/cancel/opt-out)
    cron/outbound-calls/route.ts    # Vercel Cron diário 09:30 UTC
    transfer-fallback/route.ts      # WhatsApp fallback em transfer falhado
components/
  AgentNav.tsx                      # Nav top-right entre provedores
  *Widget.tsx                       # Um por provedor
lib/
  book-meeting.ts                   # Core bookMeeting()
  google-calendar.ts                # createEvent / listUpcomingEvents / updateEventTime / cancelEvent
  whatsapp.ts                       # sendWhatsApp (OpenClaw + fallback Twilio)
  supabase.ts                       # Lazy singletons (anon + service_role)
  base-path.ts                      # BASE_PATH = '/ai-agent-voice' (branch feat/ai-agent-voice-basepath)
  i18n/dictionaries.ts              # Strings PT + EN (38)
livekit-agent/                      # Python, Gemini Live — Railway (`balanced-appreciation`)
  agent.py                          # AgentSession + RealtimeModel, inbound + outbound branch
  arcus_lookup.py                   # Arcus CRM — lookup lead por telefone/nome, log outcome
  system-prompt.txt                 # Inbound demo (pt-PT Lisboa)
  system-prompt-confirmation.txt    # Outbound confirmação (pt-PT, divulgação AI Act)
  setup_sip.py                      # Configura LiveKit SIP trunks para DIDWW +351
twilio-agent/                       # Node.js, ConversationRelay — Fly.io
  server.js                         # WebSocket server, Gemini 2.0 Flash SSE
  Dockerfile / fly.toml             # Deploy Fly.io
```

## Key patterns

**Supabase** — lazy singletons em `lib/supabase.ts`. Nunca instanciar a module-level (quebra build).

**Hume config** — API PUT-style: sempre enviar payload completo. `interruption` e `speech_detection_threshold` só editáveis pela UI. Ver [docs/providers.md](docs/providers.md).

**Gemini Live** — não definir `language=` no `RealtimeModel` (`gemini-2.5-flash-native-audio-latest` rejeita `"pt-PT"` com APIError 1007). Confiar no system prompt.

**Vapi NEXT_PUBLIC vars** — `NEXT_PUBLIC_VAPI_*` só ficam inline num build via Git push para `main`. `vercel --prod` CLI de branch `feat/*` quebra rotas raiz — nunca usar.

**WEBHOOK_SECRET** — mesmo valor que `HUME_TOOL_SECRET`. Reutilizado em `/api/transfer-fallback` e `/api/appointments/*` (header `x-vapi-secret`).

**ElevenLabs Free plan** — bloqueia vozes da Voice Library via API (HTTP 402 `paid_plan_required`). Afecta Vapi BYOK e `ttsProvider="ElevenLabs"` no Twilio. Não afecta ElevenLabs ConvAI nem Retell (usam acesso interno próprio).

**Static prerendering** — `export const dynamic = "force-dynamic"` nas pages. `CallStats` guarda com `if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null`.

**branch feat/ai-agent-voice-basepath** — `basePath: '/ai-agent-voice'`, `assetPrefix: 'https://voice-demo-navy.vercel.app/ai-agent-voice'`. Não merge para `main` sem portfolio site com rewrite. Nunca `vercel --prod` desta branch.

## Environment variables

### Hume + Calendar + WhatsApp
| Var | Onde |
|---|---|
| `HUME_API_KEY` / `HUME_SECRET_KEY` | OAuth `/api/hume/access-token` |
| `NEXT_PUBLIC_HUME_CONFIG_ID` | `HumeWidget` — `connect({configId})` |
| `HUME_TOOL_SECRET` | `/api/book-meeting` — `x-hume-secret` |
| `WEBHOOK_SECRET` | `/api/transfer-fallback` + `/api/appointments/*` (mesmo valor que `HUME_TOOL_SECRET`) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` / `GOOGLE_CALENDAR_ID` | Google Calendar |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_TO` | WhatsApp sandbox + token Twilio |

### LiveKit + Gemini Live
| Var | Onde |
|---|---|
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Token route + Python agent |
| `GEMINI_API_KEY` | Python agent + twilio-agent Fly.io (`flyctl secrets set`) |
| `TRANSFER_TO_NUMBER` / `TRANSFER_FALLBACK_ENDPOINT` | Python agent |
| `OUTBOUND_TRUNK_ID` / `TRANSFER_RING_TIMEOUT_S` / `TRANSFER_CALLER_ID_NAME` | Python agent — attended SIP transfer |
| `ARCUS_SUPABASE_URL` / `ARCUS_SUPABASE_KEY` / `ARCUS_ORG_ID` | Python agent — Arcus CRM |

### ElevenLabs
| Var | Onde |
|---|---|
| `ELEVENLABS_API_KEY` / `ELEVENLABS_AGENT_ID` | `/api/elevenlabs/signed-url` |

### Vapi
| Var | Onde |
|---|---|
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY` / `NEXT_PUBLIC_VAPI_ASSISTANT_ID` | `VapiWidget` — build-time inline |
| `VAPI_WEBHOOK_SECRET` | `/api/vapi/book-meeting` — `x-vapi-secret` |

### Retell
| Var | Onde |
|---|---|
| `RETELL_API_KEY` / `RETELL_AGENT_ID` | `/api/retell/web-call` |
| `RETELL_WEBHOOK_SECRET` | `/api/retell/book-meeting` — `x-retell-secret` |

### Twilio ConversationRelay
| Var | Onde |
|---|---|
| `TWILIO_API_KEY` / `TWILIO_API_SECRET` | `/api/twilio/token` — AccessToken (reutiliza `TWILIO_ACCOUNT_SID`) |
| `TWILIO_TWIML_APP_SID` | `/api/twilio/token` — VoiceGrant outgoing app |
| `TWILIO_AGENT_WSS_URL` | `/api/twilio/twiml` — `wss://voice-demo-twilio-agent.fly.dev` |

### Outbound calls (cron)
| Var | Default |
|---|---|
| `CRON_SECRET` | ✅ Vercel Production |
| `MAX_OUTBOUND_CALLS_PER_RUN` / `MAX_REMINDER_ATTEMPTS` | `3` / `1` |
| `CALL_HOURS_START` / `CALL_HOURS_END` | `9` / `19` (Europe/Lisbon) |

Ver fluxo completo: [docs/outbound-calls.md](docs/outbound-calls.md)

## Database

- **`calls`** — RLS, public SELECT, writes via service_role. `supabase/migrations/001_calls.sql`
- **`outbound_appointments`** — RLS, **sem** public SELECT (PII). `003_outbound_appointments.sql`. Estados: `pending → called → confirmed / rescheduled / cancelled / no_answer / failed / opted_out`

## Deploy

Push `main` → Vercel auto-deploy. Production: `https://voice-demo-navy.vercel.app`

```bash
# Python agent (Gemini Live) — local
cd livekit-agent
LIVEKIT_URL=... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... GEMINI_API_KEY=... python -u agent.py dev

# Node agent (Twilio) — Fly.io
cd twilio-agent && flyctl deploy
```

## Git

```
Remote: https://github.com/raphabruno7/voice-demo.git
Branch: main — push directo, sem PRs
Commit style: feat(livekit): ... / fix(retell): ... / docs(claude): ...
```

## Pendentes

- **PSTN real** — número Twilio ou DIDWW +351 para LiveKit SIP. WebRTC browser funciona sem número. Ver [docs/providers.md](docs/providers.md).
- **twilio-agent fase 2** — tool-calling `book_meeting` + validação assinatura Twilio em `/api/twilio/twiml`.
- **Marketing** — vídeos "The Portfolio", "The Multilingual Customer", "Features showcase". Veo 3.1 via `GEMINI_API_KEY` validado.
- **livekit-agent Railway** — projecto `balanced-appreciation`, serviço `voice-demo` (ID `66c72a9d-1ae0-4485-942a-4e776e64d49c`). Root directory `/livekit-agent`. Vars configuradas via API. Deploy automático em push para `main`.
