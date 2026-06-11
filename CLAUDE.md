@AGENTS.md

# voice-demo

Live voice AI agent (Ana) — portfolio demo de Raphael Bruno. Objectivo: state-of-the-art voice agent **multilíngue** com qualidade nativa por mercado. Stack contém **vários provedores em paralelo** — cada um optimizado para um caso de uso. Navegação entre agentes via `AgentNav` (top-right, todas as páginas).

## Stack actual (Maio 2026)

| Camada | Activo | Notas |
|---|---|---|
| Framework | Next.js 16.2.4 (Turbopack) + React 19 | App Router, force-dynamic |
| **Voice AI primário (pt-PT browser)** | **Hume EVI 4-mini** | Voz nativa pt-PT, prosódia adaptativa, end-to-end |
| **Voice AI alternativo (browser + telefone)** | **Gemini Live** | `gemini-2.5-flash-native-audio-latest`, melhor fluxo de conversa, multilíngue |
| LLM (via Hume) | Claude Sonnet 4 (`claude-sonnet-4-20250514`) | temperature 0.2 |
| LLM (via Gemini Live) | Gemini 2.5 Flash native audio | integrado no modelo, sem LLM separado |
| Auth Hume | `fetchAccessToken` do SDK `hume` | OAuth client credentials |
| **Booking tool** | `/api/book-meeting` | Server-side tool (Hume + LiveKit), cria evento + envia WhatsApp |
| Calendar | Google Calendar service account | `voice-demo-calendar@gen-lang-client-0657432502.iam.gserviceaccount.com` |
| Notificações | Twilio WhatsApp sandbox | Envia para +351 931 822 816 após cada agendamento |
| Database | Supabase (PostgreSQL + RLS) | Tabela `calls`, public read |
| Deploy | Vercel (Next.js) + local/Railway (Python agent) | `voice-demo-navy.vercel.app` |
| UI | Tailwind v4 + shadcn/ui (Base UI) | — |

### Provedores no stack (paralelo, multilíngue)

| Provedor | Estado | Melhor para | Página |
|---|---|---|---|
| **Hume EVI 4-mini** | ✅ Activo | pt-PT nativo, prosódia adaptativa | `/` |
| **LiveKit + Gemini Live** | ✅ Activo (browser) | Melhor fluxo de conversa, multilíngue, candidato a telefone | `/livekit` |
| **ElevenLabs ConvAI** | 🟡 Standby | pt-PT (voz Marta), EN, ES, FR, DE | (sem página dedicada) |
| **Vapi + Groq Llama** | 🟡 Standby | Outbound call (US number) | (form CallMe) |

**Decisão por mercado (Maio 2026):**
- 🇵🇹 pt-PT browser → Hume EVI 4-mini (sotaque + prosódia nativa)
- 🌍 Multilíngue / telefone → Gemini Live via LiveKit (`gemini-2.5-flash-native-audio-latest`)
- 📞 Outbound telefone US → Vapi (mantido até migrar para SIP +351)
- 📞 PSTN +351 (futuro) → LiveKit SIP + Gemini Live (quando 46elks aprovar conta)

### Histórico de iterações (resumo)

1. **Vapi + Groq Llama 3.3** (inicial) — sotaque pt-BR/americano não aceitável para audiência PT
2. **LiveKit + Grok Voice (xAI Realtime)** — end-to-end real mas sotaque pt-PT fraco
3. **ElevenLabs ConvAI + voz "Marta" (pt-PT)** — sotaque nativo OK, pipeline (não end-to-end)
4. **Hume EVI 3 + voz "A Viajante de Alma"** — migração para Hume
5. **Hume EVI 4-mini + "A Viajante de Alma" + book_meeting tool + WhatsApp** — activo em `/`
6. **LiveKit + Gemini 2.5 Flash native audio** — activo em `/livekit`; melhor fluxo de conversa; candidato a PSTN quando número +351 disponível

### Trade-off chave identificado

Em qualquer provedor, **TTS Playground (single-pass)** soa "estúdio" porque renderiza a frase inteira com tempo. **Conversational AI (streaming)** soa "telefone ao vivo" porque sintetiza em chunks sob pressão de latência. Não há lever de software para apagar essa diferença com a mesma voz — opções reais são (a) escolher voz com cadência base que aguente streaming, (b) voice clone bem treinado, (c) construir pipeline custom STT+LLM+TTS standalone (perde prosódia adaptativa do end-to-end).

## Estrutura do projecto

```
app/
  layout.tsx                            # RootLayout — inclui <AgentNav /> (top-right, todas as páginas)
  page.tsx                              # / → Hume EVI (inclui <AgentNav /> explicitamente)
  livekit/
    page.tsx                            # /livekit → Gemini Live via LiveKit
  api/
    hume/access-token/route.ts          # OAuth Hume — fetchAccessToken (server-side)
    book-meeting/route.ts               # ✅ Tool server-side (Hume + LiveKit) — Calendar + WhatsApp
    livekit/token/route.ts              # ✅ LiveKit room + dispatch — gera JWT para browser
    livekit/webhook/route.ts            # LiveKit room events → Supabase calls
    elevenlabs/signed-url/route.ts      # ElevenLabs ConvAI signed URL (standby)
    vapi/webhook/route.ts               # Vapi event handler (standby)
    call/route.ts                       # Outbound call via Vapi REST (standby)
    calendar/route.ts                   # Tool endpoint Vapi — Google Calendar (standby)
components/
  AgentNav.tsx                          # ✅ Nav top-right — links entre /  e /livekit (+ futuros)
  HumeWidget.tsx                        # ✅ Activo em / — usa @humeai/voice-react
  GeminiLiveWidget.tsx                  # ✅ Activo em /livekit — usa @livekit/components-react
  LiveKitWidget.tsx                     # Standby — apesar do nome, usa @elevenlabs/react (legacy)
  VapiWidget.tsx                        # Standby — Vapi web SDK
  CallStats.tsx                         # Async server component, revalidate 60s
  CallMeForm.tsx                        # Outbound call trigger
  PhoneNumber.tsx                       # Copy-to-clipboard
  QRCode.tsx                            # Async server component, SVG via dangerouslySetInnerHTML
lib/
  supabase.ts                           # Lazy singleton clients (anon + service_role)
  vapi.ts                               # VapiEvent types + detectLanguage()
  google-calendar.ts                    # Google Calendar service-account (createEvent)
livekit-agent/                          # Python agent — Gemini Live end-to-end
  agent.py                              # AgentSession + google.beta.realtime.RealtimeModel
  system-prompt.txt                     # Prompt Ana pt-PT (partilhado com Hume)
  requirements.txt                      # livekit-agents[google]>=0.12
  Dockerfile                            # Para Railway/deploy em produção
supabase/migrations/
  001_calls.sql                         # calls table + RLS public read policy
```

## Key patterns

**Supabase clients** — lazy singletons em `lib/supabase.ts`. Nunca instanciar a module-level (quebra build). `supabase` (anon) para reads em server components, `supabaseAdmin` (service_role) só em API routes que escrevem.

**Hume access token** — `fetchAccessToken({apiKey, secretKey})` server-side, devolve token de curta duração. Client (`HumeWidget`) usa-o para `connect({auth: {type: "accessToken", value: ...}, configId})`. A SDK `@humeai/voice-react` v2+ exige `<VoiceProvider>` wrapper.

**Hume config** — gerido externamente via API ou UI (`app.hume.ai/evi/configs/...`). Importante: a Hume API é PUT-style — cada `POST /v0/evi/configs/{id}` substitui campos não enviados. Sempre enviar payload completo (voice, language_model, prompt, event_messages, turn_detection, builtin_tools).

**Vapi webhook segurança** — `app/api/vapi/webhook/route.ts` valida `x-vapi-secret` contra `VAPI_WEBHOOK_SECRET`. Retorna 401 em mismatch. Vapi retry on non-200 → sempre 200 on success.

**Language detection** — `detectLanguage()` em `lib/vapi.ts` usa word-frequency regex (PT vs EN). Aplicado ao transcript no `end-of-call-report`.

**Static prerendering** — page tem `export const dynamic = "force-dynamic"`. `CallStats` guarda com `if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null` para build passar sem env vars.

**QR code** — server component, `qrcode` pkg gera SVG string (`type: "svg"`), injectado via `dangerouslySetInnerHTML`. Pontos brancos sobre fundo transparente (`dark: "#ffffff"`, `light: "#00000000"`).

## Environment variables

### Activas (Hume + Supabase + Calendar)
| Variable | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase anon client + CallStats guard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon client (reads) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin client (webhook writes) |
| `HUME_API_KEY` | OAuth client_id em `/api/hume/access-token` |
| `HUME_SECRET_KEY` | OAuth client_secret em `/api/hume/access-token` |
| `NEXT_PUBLIC_HUME_CONFIG_ID` | Passado em `connect({configId})` no `HumeWidget` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Calendar API auth (`/api/calendar`) |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Google Calendar API auth (`/api/calendar`) |
| `GOOGLE_CALENDAR_ID` | Target calendar |
| `HUME_TOOL_SECRET` | Auth header `x-hume-secret` em `/api/book-meeting` |
| `TWILIO_ACCOUNT_SID` | Auth Twilio REST API (`/api/book-meeting`) |
| `TWILIO_AUTH_TOKEN` | Auth Twilio REST API (`/api/book-meeting`) |
| `TWILIO_WHATSAPP_TO` | Número destino notificações (`whatsapp:+351931822816`) |

### Activas — Gemini Live (LiveKit)
| Variable | Where |
|---|---|
| `LIVEKIT_URL` | `/api/livekit/token` + Python agent |
| `LIVEKIT_API_KEY` | `/api/livekit/token` + Python agent |
| `LIVEKIT_API_SECRET` | `/api/livekit/token` + Python agent + webhook |
| `GEMINI_API_KEY` | Python agent (`livekit-agent/agent.py`) — service-account-bound key do Google Cloud |
| `TRANSFER_TO_NUMBER` | Python agent — destino do warm transfer SIP. Default `+351931822816` |
| `TRANSFER_FALLBACK_ENDPOINT` | Python agent — URL de `/api/transfer-fallback` (opcional; sem ela, falha de transfer só fica em log) |
| `WEBHOOK_SECRET` | Reutilizada por `/api/transfer-fallback` (header `x-vapi-secret`), além de `book_meeting` |
| `OUTBOUND_TRUNK_ID` | Python agent — trunk outbound LiveKit (criado por `setup_sip.py`). Sem ela, transfer cai para blind SIP REFER (sem deteção de voicemail) |
| `TRANSFER_RING_TIMEOUT_S` | Python agent — segundos a tocar antes de considerar voicemail/sem resposta. Default `20` |
| `TRANSFER_CALLER_ID_NAME` | Python agent — display name SIP mostrado ao Raphael na chamada de transfer. Default `Ana - Voice Demo` |

### Standby (outros provedores)
| Variable | Where |
|---|---|
| `ELEVENLABS_API_KEY` | `/api/elevenlabs/signed-url` |
| `ELEVENLABS_AGENT_ID` | `/api/elevenlabs/signed-url` |
| `ELEVENLABS_VOICE_ID` | (override de voz, opcional) |
| `VAPI_WEBHOOK_SECRET` | Webhook auth header |
| `VAPI_API_KEY` | Outbound call (`/api/call`) |
| `VAPI_ASSISTANT_ID` | Outbound call payload |
| `VAPI_PHONE_NUMBER_ID` | Outbound call payload |
| `NEXT_PUBLIC_PHONE_NUMBER` | Número no landing page |
| `XAI_API_KEY` | Grok Voice legacy (substituído por Gemini Live) |

**Vercel:** todas as vars activas estão em Production + Development. Twilio sandbox — para testar localmente enviar `join <palavra-chave>` para `+14155238886` no WhatsApp.

## Como trocar / adicionar provedor

Cada provedor tem a sua própria página. O `AgentNav` em `components/AgentNav.tsx` lista as páginas:

```tsx
const agents = [
  { label: "Hume EVI", href: "/" },
  { label: "Gemini Live", href: "/livekit" },
  // { label: "ElevenLabs", href: "/elevenlabs" },  // adicionar quando criar a página
];
```

Para correr o agente Gemini Live localmente:
```bash
cd livekit-agent
PYTHONUNBUFFERED=1 \
  LIVEKIT_URL=wss://voice-agent-hfi9y0b7.livekit.cloud \
  LIVEKIT_API_KEY=... \
  LIVEKIT_API_SECRET=... \
  GEMINI_API_KEY=... \
  CALENDAR_ENDPOINT=https://voice-demo-navy.vercel.app/api/book-meeting \
  WEBHOOK_SECRET=... \
  TRANSFER_FALLBACK_ENDPOINT=https://voice-demo-navy.vercel.app/api/transfer-fallback \
  OUTBOUND_TRUNK_ID=... \
  ./venv/bin/python -u agent.py dev
```

`OUTBOUND_TRUNK_ID` é opcional — sem ela, `transfer_to_human` usa blind SIP REFER (sem deteção de voicemail). `TRANSFER_RING_TIMEOUT_S` (default 20) e `TRANSFER_CALLER_ID_NAME` (default "Ana - Voice Demo") também são opcionais.

**Atenção — modo `dev`:** reinicia automaticamente em alterações de ficheiro na pasta `livekit-agent/`. Se o worker ficar em loop de reconexão (`failed to connect to livekit` + `unexpected message type: 258`), matar com `pkill -9 -f agent.py` e reiniciar. Em produção usar Railway/systemd com auto-restart.

## Telefone (futuro)

Quando avançar para PSTN com número PT:
- **Telnyx +351 30x** — melhor custo-benefício (~$1/mo + ~$0.003/min); address proof simples
- **Twilio +351 21/22/local fixo** — viável, address proof PT (~$1.15/mo + ~$0.013/min); Hume tem integração nativa Twilio (`app.hume.ai/developers` → Twilio card)
- **Twilio +351 9x mobile** — barreira regulatória pesada: empresa registada PT + representante local + documento ANACOM ($15–135/mo) — não viável para demo solo
- **Twilio toll-free +351 800** — disponível, empresa PT + ANACOM (~$3/mo + per-min)
- Recomendação para demo: Telnyx 30x (custo mínimo, setup simples); Twilio só se preferires ecossistema Twilio ou integração nativa Hume
- Vapi mantém-se para outbound US até migração PSTN

## Local dev

```bash
cp .env.local.example .env.local  # fill in vars
npm run dev
```

Webhook Vapi (se em uso) requer URL pública — `ngrok http 3000` e configurar Vapi Org Settings > Server URL para `https://<ngrok>/api/vapi/webhook`.

## Git

```
Remote: https://github.com/raphabruno7/voice-demo.git
Branch: main (single branch — push directly, no PRs needed for solo project)
```

Commit style usado neste repo:
```
feat(ana): migrate to ElevenLabs Conversational AI with native pt-PT voice
fix(recorder): start recording immediately on mic button click
style: reduce phone number size to fit inline with QR code
```

## Deploy

Push `main` → Vercel auto-deploy. `next build` default, sem build config.

Production URL: `voice-demo-navy.vercel.app`

## Database

Tabela única `calls`. Schema em `supabase/migrations/001_calls.sql`. RLS enabled — public SELECT, writes só via service_role key (webhook).

## Hume EVI config (referência operacional)

- **Config ID em produção:** `7fd9f653-21d8-42db-b3df-c287d5899ec2` (versão actual: 25)
- **Dashboard:** `app.hume.ai/evi/configs/7fd9f653-21d8-42db-b3df-c287d5899ec2`
- **EVI runtime:** **EVI 4-mini** (`evi_version: "4-mini"`) — lightweight multilingual, optimizado para velocidade e custo
- **Voz:** "A Viajante de Alma" (Octave HUME_AI shared, ID `7e4077d4-3f17-4012-bab2-18fd53b0c173`) — pt-PT nativa
- **Voz alternativa testada:** custom clone "Ana" (`ab262199-1b95-41e9-9132-eb3cd1f0bb8f`) — soa melhor em Playground, perde em streaming
- **LLM:** Claude Sonnet 4 (`claude-sonnet-4-20250514`), temperature 0.2
- **System prompt:** `hume/system-prompt.txt` (versionado no repo)
- **on_new_chat:** ON com saudação pt-PT
- **turn_detection:** end_of_turn_silence 500ms, threshold 0.5, prefix_padding 300ms
- **interruption:** ON, min interval 800ms
- **inactivity_nudges:** OFF (em demo web, pausa = pessoa a pensar)
- **inactivity_timeout:** ON, 120s
- **Built-in tools:** hang_up
- **Custom tool:** `book_meeting` (ID `b8427229-73d6-42d5-bf40-cf4cfbaac73a`) → webhook `https://voice-demo-navy.vercel.app/api/book-meeting`

**Edição via API:** sempre enviar payload completo (PUT-style). Voice field obrigatório em qualquer update. Campos `interruption` e `speech_detection_threshold` não aceites via API — editar pela UI.

**EVI 3 → EVI 4-mini:** trocar é apenas mudar `evi_version` no dropdown da UI e Save. Mantém LLM externo (Claude), mesma voz, mesmo prompt. Latência menor, custo menor.

**Armadilha voice clone IDs:** ao criar um clone, a Hume devolve um `generation_id` (e.g. `8fd2aeb6-...`) — temporário. O `voice_id` estável (e.g. `ab262199-...`) é o que aparece na listagem do dashboard e vai no config. Nunca usar generation_id no config.

**Prompts de voz — princípio chave:** o LLM gera texto, a voz Octave faz a pronúncia. Instruções fonéticas no prompt ("vogais fechadas", "sh final", "evita sotaque BR") são **inúteis e prejudiciais**: o LLM não controla fonemas, e negações primam o conceito (mencionar "brasileiro" activa pt-BR no contexto). Prompt deve só controlar léxico, sintaxe, registo e pacing (via `[VOICE DIRECTION: ...]` que o Octave lê). Listar palavras a evitar é o pior — injecta esse vocabulário no contexto. Framing positivo apenas: "falas como em Lisboa", lista de palavras a usar, nunca a evitar.

**Custos Hume:** Free tier esgota-se rapidamente. Para iterar: pay-as-you-go (~$0.20/min em EVI 3; mais barato em EVI 4-mini) ou Creator $99/mo. Verificar saldo antes de sessões longas.

## Pendentes / decisões abertas

- **Vercel env vars Hume** — ✅ adicionadas (HUME_API_KEY, HUME_SECRET_KEY, NEXT_PUBLIC_HUME_CONFIG_ID, HUME_TOOL_SECRET) em Production e Development.
- **`book_meeting` tool** — ✅ implementado via server-side Hume tool. Tool ID: `b8427229-73d6-42d5-bf40-cf4cfbaac73a`. Endpoint: `/api/book-meeting` (auth: `HUME_TOOL_SECRET`). Recolhe nome + telefone + data/hora, cria evento no Google Calendar, devolve `meetingTime` em pt-PT para a Ana confirmar.
- **Velocidade da voz** — ✅ resolvida via `[VOICE DIRECTION: ...]` no system prompt. "Very fast, clipped conversational pace". Não há lever runtime no SDK.
- **Voice clone vs Octave shared** — ✅ decisão tomada: Octave shared "A Viajante de Alma". Clone perde em streaming; shared aguenta melhor.
- **WhatsApp Twilio** — ✅ sandbox activo. Para produção real (sem sandbox) precisas de número Twilio com WhatsApp Business aprovado.
- **SIP Trunk DIDWW** — ✅ Pré-instalação feita em Junho 2026 (`setup_sip.py` criado, inclui inbound + outbound trunk). ⏳ **À espera de:** compra do número +351 na DIDWW. Quando número chegar, executar `setup_sip.py` com credenciais DIDWW + número (+ `DIDWW_OUTBOUND_ADDRESS` para activar outbound), e configurar SIP destination em DIDWW dashboard para `voice-agent-hfi9y0b7.sip.livekit.cloud:5060`.
- **Warm transfer (`transfer_to_human`)** — ✅ Implementado em `agent.py` (attended transfer com `wait_until_answered` + deteção de voicemail/no-answer via `ringing_timeout`, fallback blind REFER, fallback WhatsApp via `/api/transfer-fallback`). ⏳ **À espera de:** número +351 + `OUTBOUND_TRUNK_ID` (de `setup_sip.py`) para teste end-to-end real e confirmar comportamento da DIDWW com `create_sip_participant`/REFER.
- **Concorrência** — ✅ `WorkerOptions` afinado (`num_idle_processes=2`, `load_threshold=0.75`) para chamadas concorrentes sem latência de arranque.
- **Branded caller ID (CNAM)** — ✅ `setup_sip.py` aceita `DIDWW_OUTBOUND_ADDRESS` e cria outbound trunk; `TRANSFER_CALLER_ID_NAME` define o display name SIP. ⏳ **À espera de:** registo CNAM do número +351 no dashboard DIDWW (manual, após compra do número).

## Gemini Live — referência operacional

- **Modelo activo:** `gemini-2.5-flash-native-audio-latest` (bidiGenerateContent)
- **API Key:** service-account-bound key criada no projecto `gen-lang-client-0657432502` (Google Cloud)
- **Voz:** `Aoede` (configurável no `RealtimeModel`)
- **Linguagem:** `pt-PT` nativo (definido em `agent.py`)
- **Speech detection:** `realtime_input_config` com `EndSensitivity.END_SENSITIVITY_HIGH`, silence 300ms, prefix padding 100ms
- **System prompt:** `livekit-agent/system-prompt.txt` — reescrito em português europeu (Lisboa), inclui `[VOICE DIRECTION: ...]` para ritmo conversacional
- **Worker:** `livekit-agent/agent.py` — `google.beta.realtime.RealtimeModel`, Python 3.12, venv em `livekit-agent/venv/`
- **LiveKit project:** `voice-agent-hfi9y0b7.livekit.cloud` (EU West B)
- **Agent name:** `ana-agent` (deve coincidir entre `WorkerOptions` e `createDispatch`)
- **Modelos válidos** para bidiGenerateContent nesta key (consultados via API em Maio 2026):
  - `gemini-2.5-flash-native-audio-latest`
  - `gemini-2.5-flash-native-audio-preview-12-2025`
  - `gemini-3.1-flash-live-preview`
- **Armadilha Python 3.14:** livekit-agents não suporta Python 3.14. Usar Python 3.12 no venv.
- **Armadilha worker zombie:** após queda de rede, o worker pode registar-se 2× e deixar de atender jobs. `pkill -9 -f agent.py` + restart resolve.

### Warm transfer (`transfer_to_human`)

- **Tool:** `transfer_to_human(reason)` em `agent.py`, definida como closure dentro de `entrypoint` (precisa de `ctx`).
- **Modo attended (com `OUTBOUND_TRUNK_ID` definido) — recomendado:**
  - A Ana fica na chamada e disca para `TRANSFER_TO_NUMBER` via `lkapi.sip.create_sip_participant(..., wait_until_answered=True, ringing_timeout=TRANSFER_RING_TIMEOUT_S)`.
  - **Se o Raphael atender:** entra na mesma room que o chamador (ambos os SIP legs ouvem-se directamente via mix da room). A Ana diz uma frase breve de despedida e sai (`ctx.shutdown()`, com 4s de atraso para não cortar a fala).
  - **Se não atender (voicemail / timeout / ocupado):** `create_sip_participant` lança `TwirpError` — a Ana **nunca chega a tocar no leg do chamador**, cai directo no fallback WhatsApp.
  - **Caller ID:** `display_name=TRANSFER_CALLER_ID_NAME` (default "Ana - Voice Demo") no SIP `From`. Passthrough do nome depende do CNAM da DIDWW (ver secção SIP Trunk abaixo).
- **Modo blind (sem `OUTBOUND_TRUNK_ID`):** fallback para `ctx.transfer_sip_participant(participant, TRANSFER_TO_NUMBER, play_dialtone=True)` (SIP REFER directo, sem deteção de voicemail/no-answer).
- **Sessões de browser (sem SIP):** a tool devolve mensagem indicando que não é chamada telefónica; a Ana continua a conversa sem mencionar a tentativa.
- **Fallback WhatsApp:** em qualquer caso de falha (voicemail, erro técnico, REFER falhou), POST para `TRANSFER_FALLBACK_ENDPOINT` (`/api/transfer-fallback`) com `callerPhone` + `reason`.
- **Pendente de validação real:** todo o fluxo (attended + blind) só é testável com chamada SIP real, após a compra do número +351 (ver "Pendentes" abaixo).

### Concorrência (`WorkerOptions`)

- `num_idle_processes=2` — mantém 2 processos Python "quentes" (modelo Gemini Live já carregado) prontos a aceitar jobs, evitando latência de arranque em chamadas concorrentes.
- `load_threshold=0.75` — acima de 75% de carga média, o worker para de aceitar novos jobs (LiveKit redistribui para outro worker, se existir).
- Estado já era seguro para concorrência (sem globals partilhados — tudo dentro de `entrypoint`/closures por job); isto só afina alocação de recursos. Em Railway, cada processo idle consome memória com o modelo carregado — ajustar `num_idle_processes` conforme RAM disponível no plano.

### SIP Trunk setup (DIDWW +351)

**Status:** Pré-instalação feita (Junho 2026), aguarda número +351.

- **Script:** `livekit-agent/setup_sip.py` — configura LiveKit inbound SIP trunk + dispatch rule + (opcional) outbound trunk para warm transfer
- **Quando executar:** após compra do número +351 na DIDWW (currently pending)
- **Variáveis necessárias:**
  ```bash
  PHONE_NUMBER=+351XXXXXXXXX    # Número DIDWW a comprar
  SIP_USER=<didww-sip-username> # Credenciais DIDWW
  SIP_PASS=<didww-sip-password>
  DIDWW_OUTBOUND_ADDRESS=<didww-outbound-sip-host>  # opcional — activa outbound trunk (warm transfer)
  LIVEKIT_URL=wss://voice-agent-hfi9y0b7.livekit.cloud
  LIVEKIT_API_KEY=...
  LIVEKIT_API_SECRET=...
  ```
- **Resultado:** 
  - Cria `SIPInboundTrunk` (DIDWW +351) com allowlist de IPs DIDWW
  - Cria `SIPDispatchRule` que roteia chamadas para `ana-agent` em rooms com prefix `call-`
  - Se `DIDWW_OUTBOUND_ADDRESS` definido, cria `SIPOutboundTrunk` — o `sip_trunk_id` resultante vai para `OUTBOUND_TRUNK_ID` no deploy do agent (activa attended transfer)
- **DIDWW SIP destination** (configurar em DIDWW dashboard): `voice-agent-hfi9y0b7.sip.livekit.cloud:5060`
- **Permitida lista IPs DIDWW:** `46.19.209.14/32`, `46.19.210.14/32`, `46.19.212.14/32`, `46.19.213.14/32`, `46.19.214.14/32`, `46.19.215.14/32`, `185.238.173.14/32`
- **Branded caller ID (CNAM):** registar nome (ex: "Ana - Raphael Bruno") para o número +351 em DIDWW dashboard → Numbers → CNAM/Caller ID. Sem registo, `TRANSFER_CALLER_ID_NAME` pode não aparecer no telefone do Raphael (depende de passthrough da operadora).

## Provedores a acompanhar

**Thinking Machines Lab — "Interaction Models"** (anunciado 11/05/2026). Full-duplex nativo, 0.4s latência, multimodal por design. Hoje em research preview limitado. Candidato natural para substituir Hume quando abrir GA.

**DIDWW +351 30x (telefone)** — ✅ Pré-instalação SIP trunk feita em Junho 2026 (inbound + outbound + warm transfer com deteção de voicemail, todos prontos em código). ⏳ Aguarda compra do número. Uma vez comprado: executar `setup_sip.py` + configurar SIP destination em DIDWW → Gemini Live agent atende chamadas telefónicas pt-PT reais via LiveKit SIP inbound trunk, com transferência para humano quando necessário.
