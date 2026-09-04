@AGENTS.md

# voice-demo

> **Estado:** 🟢 Vivo — referência principal do projecto, sempre actualizada.
> **Actualizado:** 2026-09-04
> **Âmbito:** arquitectura, provedores, env vars, padrões e regras do repo.
> **Handoff da última sessão:** [docs/handoff-2026-09-04.md](docs/handoff-2026-09-04.md)

Portfolio demo de Raphael Bruno — voice AI agent multilíngue com 6 provedores em paralelo para comparação de pipelines. Branding público: «24/7 Voice Agent» / «Agente de Voz 24/7» (white-label). Stack: Next.js 16 (App Router, Turbopack) + Vercel; Python livekit-agent (Railway — projecto `balanced-appreciation`, serviço **`voice-demo`** — nome enganador, não é o site Next.js); Node twilio-agent (Railway — mesmo projecto, serviço `vivacious-expression`).

## Provedores

| Provedor | Estado | Pipeline | Voz | Página |
|---|---|---|---|---|
| **Hume EVI 4-mini** | ✅ Activo | End-to-end pt-PT, prosódia adaptativa | "A Viajante de Alma" (Octave) | `/` |
| **LiveKit + Gemini Live** | ✅ Activo | `gemini-2.5-flash-native-audio-latest` | Aoede | `/livekit` |
| **ElevenLabs ConvAI** | ✅ Activo | STT + LLM + TTS pipeline | Marta (pt-PT) | `/elevenlabs` |
| **Vapi** | ✅ Activo | Orquestrador browser — Gemini 2.5 Flash | Sarah (EN) | `/vapi` |
| **Retell AI** | ✅ Activo | Orquestrador browser — Gemini 3.0 Flash | Cartesia Cleo (EN) | `/retell` |
| **Twilio ConversationRelay** | ✅ Activo (WebRTC) | ConversationRelay + Railway — Gemini 2.0 Flash | Polly.Ines-Neural (pt-PT) | `/twilio` |

Config detalhado de cada provedor: [docs/providers.md](docs/providers.md)

## Booking tool (partilhado)

`lib/book-meeting.ts` → `bookMeeting({callerName, callerPhone, startTime})` — cria evento no Google Calendar e envia WhatsApp. Cada provedor tem a sua route com auth/parse próprios:

| Route | Auth header | Env var |
|---|---|---|
| `/api/book-meeting` | `x-hume-secret` | `HUME_TOOL_SECRET` |
| `/api/vapi/book-meeting` | `x-vapi-secret` | `VAPI_WEBHOOK_SECRET` |
| `/api/retell/book-meeting` | `x-retell-secret` | `RETELL_WEBHOOK_SECRET` |

Retell envia o payload em `body.args` (Vapi envia em `toolCallList[0].function.arguments`).

## twilio-agent (Railway)

Standalone WebSocket server, **não** corre na Vercel. Deploy permanente em `wss://vivacious-expression-production-02d1.up.railway.app` (Railway — projecto `balanced-appreciation`, serviço `vivacious-expression`).

Protocolo: `{type:"setup"}` → saudação; `{type:"prompt", voicePrompt}` → stream Gemini 2.0 Flash via `fetch` SSE → `{type:"text", token, last}`.

**Re-deploy:** push para `main` activa Railway auto-deploy

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
    livekit/metrics/route.ts        # Latência por turno (e2e_latency) → turn_metrics
    elevenlabs/signed-url/route.ts  # ElevenLabs signed URL
    vapi/book-meeting/route.ts      # Tool Vapi
    retell/web-call/route.ts        # Retell access token
    retell/book-meeting/route.ts    # Tool Retell
    twilio/token/route.ts           # Twilio Voice JWT
    twilio/twiml/route.ts           # TwiML App Voice URL
    appointments/*/route.ts         # Tools outbound (confirm/reschedule/cancel/opt-out)
    cron/outbound-calls/route.ts    # Vercel Cron diário 09:30 UTC
    cron/health-check/route.ts      # Vercel Cron diário 07:00 UTC — health check
    status/logout/route.ts          # Logout admin (limpa cookie)
    transfer-fallback/route.ts      # WhatsApp fallback em transfer falhado
components/
  AgentNav.tsx                      # Nav top-right entre provedores
  *Widget.tsx                       # Um por provedor
lib/
  book-meeting.ts                   # Core bookMeeting()
  google-calendar.ts                # createEvent / listUpcomingEvents / updateEventTime / cancelEvent
  whatsapp.ts                       # sendWhatsApp (OpenClaw + fallback Twilio)
  supabase.ts                       # Lazy singletons (anon + service_role)
  health-checks.ts                  # 10 check functions + runAllChecks() — Hume/LiveKit/ElevenLabs/Vapi/Retell/Twilio/GCal/Supabase/Railway/Fly
  resend.ts                         # sendHealthEmail() — daily + alert, via Resend API
  base-path.ts                      # BASE_PATH = '/ai-agent-voice' — já em main
  i18n/dictionaries.ts              # Strings PT + EN (38)
app/
  status/page.tsx                   # Dashboard admin — estado actual + histórico 30 dias (protegido por cookie)
  status/login/page.tsx             # Login admin com Server Action
middleware.ts                       # Protege /status/* → redireciona para /status/login sem cookie admin_token
livekit-agent/                      # Python, Gemini Live — Railway (`balanced-appreciation`, serviço `voice-demo`)
  agent.py                          # AgentSession + RealtimeModel, inbound + outbound branch
  arcus_lookup.py                   # Arcus CRM — lookup lead por telefone/nome, log outcome
  system-prompt.txt                 # Inbound demo (pt-PT Lisboa)
  system-prompt-confirmation.txt    # Outbound confirmação (pt-PT, divulgação AI Act)
  setup_sip.py                      # Configura LiveKit SIP trunks para DIDWW +351
twilio-agent/                       # Node.js, ConversationRelay — Railway
  server.js                         # WebSocket server, Gemini 2.0 Flash SSE
  Dockerfile                        # Deploy Railway (auto-deploy em push para main)
```

## Key patterns

**Supabase** — lazy singletons em `lib/supabase.ts`. Nunca instanciar a module-level (quebra build).

**Hume config** — API PUT-style: sempre enviar payload completo. `interruption` e `speech_detection_threshold` só editáveis pela UI. Ver [docs/providers.md](docs/providers.md).

**Gemini Live** — não definir `language=` no `RealtimeModel` (rejeita `"pt-PT"` com APIError 1007). Confiar no system prompt.

**Nunca o alias `-latest`** — `gemini-*-latest` troca de modelo por baixo sem aviso; comportamento, prosódia e latência mudam sem um commit que o explique. O modelo é uma versão fixa em `GEMINI_REALTIME_MODEL`. `livekit-agent/test_config.py` falha se o alias voltar.

**Latência por turno** — mais de metade da espera percebida era `silence_duration_ms`, não o modelo: é silêncio exigido *antes* de o modelo saber que é a sua vez. Afina-se com `VAD_SILENCE_MS` contra os p50/p95 reais em `turn_metrics` (`/status`), sem deploy de código. Compromisso directo: descer demais volta a cortar frases a meio (foi o que o PR #15 corrigiu).

**Vapi NEXT_PUBLIC vars** — `NEXT_PUBLIC_VAPI_*` só ficam inline num build via Git push para `main`. `vercel --prod` CLI de branch `feat/*` quebra rotas raiz — nunca usar.

**WEBHOOK_SECRET** — mesmo valor que `HUME_TOOL_SECRET`. Reutilizado em `/api/transfer-fallback` e `/api/appointments/*` (header `x-vapi-secret`).

**ElevenLabs Free plan** — bloqueia vozes da Voice Library via API (HTTP 402 `paid_plan_required`). Afecta Vapi BYOK e `ttsProvider="ElevenLabs"` no Twilio. Não afecta ElevenLabs ConvAI nem Retell (usam acesso interno próprio).

**Static prerendering** — `export const dynamic = "force-dynamic"` nas pages. `CallStats` guarda com `if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null`.

**basePath `/ai-agent-voice` está em `main`** — o site real é `www.raphaelbruno.dev/ai-agent-voice/`, servido por rewrite do portfolio. Toda a navegação e todos os `fetch` internos passam por `BASE_PATH` (`lib/base-path.ts`). A branch `feat/ai-agent-voice-basepath` é histórica; o aviso antigo de "não fazer merge" já não se aplica.

**`assetPrefix` só em produção** — `next.config.ts` condiciona-o a `NODE_ENV === "production"`. Se voltar a ficar fixo, o dev local e os previews de PR pedem CSS/JS ao domínio de produção, os hashes de chunk não batem certo e a página **não hidrata** (sintoma: página sem estilos, botões inertes). Já aconteceu uma vez.

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
| `GEMINI_API_KEY` | Python agent (Railway `voice-demo`) + twilio-agent (Railway `vivacious-expression`) + Vercel (`checkGemini` health check) + `.env.local` / `livekit-agent/.env` |
| `TRANSFER_TO_NUMBER` / `TRANSFER_FALLBACK_ENDPOINT` | Python agent |
| `OUTBOUND_TRUNK_ID` / `TRANSFER_RING_TIMEOUT_S` / `TRANSFER_CALLER_ID_NAME` | Python agent — attended SIP transfer |
| `ARCUS_SUPABASE_URL` / `ARCUS_SUPABASE_KEY` / `ARCUS_ORG_ID` | Python agent — Arcus CRM |
| `METRICS_ENDPOINT` | Python agent — POST de latência por turno para `/api/livekit/metrics` (reutiliza `WEBHOOK_SECRET` como `x-metrics-secret`) |
| `GEMINI_REALTIME_MODEL` | Python agent — modelo realtime. Default `gemini-2.5-flash-native-audio-preview-12-2025` (versão fixa). Para avaliar o 3.1: `gemini-3.1-flash-live-preview` |
| `VAD_SILENCE_MS` | Python agent — silêncio para declarar fim de fala. Default `400`. Entra em **todos** os turnos: subir reduz cortes a meio da frase, descer reduz latência percebida |

> ⚠️ **`GEMINI_API_KEY` vive em 4 sítios** (ver acima) — se rodares a key (ex: projecto GCP suspenso por billing), actualiza todos ou o `/livekit` fica com áudio em silêncio mesmo que o health check dê `ok`. O serviço Railway `voice-demo` (dentro do projecto `balanced-appreciation`) só aplica a variável nova depois de um **Deploy manual** — mudar o valor não reinicia o processo sozinho.

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
| `TWILIO_AGENT_WSS_URL` | `/api/twilio/twiml` — `wss://vivacious-expression-production-02d1.up.railway.app` |
| `TWILIO_AGENT_SECRET` | `/api/twilio/book-meeting` (x-twilio-agent-secret) + Railway twilio-agent (TWILIO_AGENT_SECRET) |
| `CALENDAR_ENDPOINT` | Railway twilio-agent → `https://voice-demo-navy.vercel.app/ai-agent-voice/api/twilio/book-meeting` |
| `TWILIO_TWIML_WEBHOOK_URL` | `/api/twilio/twiml` — override URL para validação HMAC (opcional; default: URL produção) |
| `GEMINI_API_KEY` | Railway twilio-agent `vivacious-expression` — obrigatório (processo sai se ausente) |

### Outbound calls (cron)
| Var | Default |
|---|---|
| `CRON_SECRET` | ✅ Vercel Production |
| `MAX_OUTBOUND_CALLS_PER_RUN` / `MAX_REMINDER_ATTEMPTS` | `3` / `1` |
| `CALL_HOURS_START` / `CALL_HOURS_END` | `9` / `19` (Europe/Lisbon) |

Ver fluxo completo: [docs/outbound-calls.md](docs/outbound-calls.md)

> ⚠️ **Crons no `vercel.json` TÊM de terminar em `/`** — `next.config.ts` tem `trailingSlash: true`, por isso um path sem barra dá 308 e o Vercel Cron (que não segue redirects) nunca corre o handler. Ao adicionar um cron novo, mete a barra final.

### Health Check & Admin
| Var | Onde |
|---|---|
| `RESEND_API_KEY` | `/api/cron/health-check` — envio de emails via Resend |
| `ADMIN_SECRET` | `middleware.ts` + `/status/login` — password do dashboard `/status` |
| `HEALTH_EMAIL_FROM` | Remetente: `health@raphaelbruno.dev` (domínio verificado via Cloudflare) |
| `LIVEKIT_AGENT_HEALTH_URL` | URL público Railway — `GET /health` na porta 8081 |
| `TWILIO_AGENT_HEALTH_URL` | `https://vivacious-expression-production-02d1.up.railway.app` |

## Database

> ⚠️ **O projecto Supabase de produção é `snczwotnbasmetvuthic`** e **não é acessível** pela conta que está autenticada no Supabase CLI (`raphaelbruno.dev@gmail.com`, org "Raphael Bruno") — `supabase link` devolve *"account does not have the necessary privileges"*. O `supabase/.temp/project-ref` local aponta para **outro** projecto (`jgvyooztatfgnxtqbluy`). Antes de aplicar qualquer migração, confirma o ref no painel: correr DDL no projecto errado cria tabelas que a app nunca lê.
>
> ⚠️ **`SUPABASE_SERVICE_ROLE_KEY` está vazia em Vercel Production** (verificado 2026-09-04). `getSupabaseAdmin()` depende dela, logo tudo o que escreve por service_role falha: métricas de latência, cron de health checks e as leituras do `/status`. Sintoma coerente: a última linha em `calls` é de 2026-05-01.

- **`calls`** — RLS, public SELECT, writes via service_role. `supabase/migrations/001_calls.sql`
- **`outbound_appointments`** — RLS, **sem** public SELECT (PII). `003_outbound_appointments.sql`. Estados: `pending → called → confirmed / rescheduled / cancelled / no_answer / failed / opted_out`
- **`health_checks`** — RLS, service_role only. `004_health_checks.sql`. Colunas: `id, checked_at, service, status (ok|degraded|fail), latency_ms, error_msg`. Retenção 30 dias (limpo pelo cron). ✅ Migração aplicada. Cron a correr — 10/10 serviços ok.
- **`turn_metrics`** — RLS, service_role only. `005_turn_metrics.sql`. Colunas: `id, call_id, e2e_latency_ms, created_at`. Latência por turno do LiveKit (fim-da-fala-do-utilizador → 1ª resposta do agente), enviada pelo `livekit-agent/agent.py` via `POST /api/livekit/metrics`. p50/p95 dos últimos 7 dias no `/status`. ⚠️ **Migração NÃO aplicada** (verificado 2026-09-04: a API devolve `PGRST205 Could not find the table`). Nunca se registou um turno; o POST falha em silêncio.

## Deploy

Push `main` → Vercel auto-deploy. Production: `https://voice-demo-navy.vercel.app`

```bash
# Python agent (Gemini Live) — local
cd livekit-agent
LIVEKIT_URL=... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... GEMINI_API_KEY=... python -u agent.py dev

# Node agent (Twilio) — Railway (auto-deploy em push para main)
```

## Git

```
Remote: https://github.com/raphabruno7/voice-demo.git
Branch: main — sempre branch + PR, nunca commit directo em main
Commit style: feat(livekit): ... / fix(retell): ... / docs(claude): ...
```

## Pendentes

| # | Item | Estado | Bloqueado em |
|---|---|---|---|
| 1 | **PSTN real** | 🟡 Código pronto | Número Twilio ou DIDWW +351 para LiveKit SIP. WebRTC browser funciona sem número. Ver [docs/providers.md](docs/providers.md) |
| 2 | **Gap #2 — harness de avaliação de conversa** | 🔴 Por começar | Nada. Ver [docs/gaps-analysis-2026-07-16.md](docs/gaps-analysis-2026-07-16.md) |
| 3 | **Gap #4 — observabilidade profunda** | 🔴 Por começar | Nada |
| 4 | **Marketing** | 🟡 Em curso | Vídeos "The Portfolio", "The Multilingual Customer", "Features showcase". Veo 3.1 via `GEMINI_API_KEY` validado |
| 5 | **`AgentNav` transborda** em ecrãs estreitos | 🔴 Por corrigir | Nada. Pré-existente, afecta as 6 páginas |

Gap #1 (latência real por turno) fechado no PR #16. Palco `/livekit` fechado no PR #17.
