@AGENTS.md

# voice-demo

Live voice AI agent (Ana) — portfolio demo de Raphael Bruno. Objectivo: state-of-the-art voice agent **multilíngue** com qualidade nativa por mercado. Stack contém **vários provedores em paralelo** — cada um optimizado para um caso de uso. Em **pt-PT** o melhor actualmente é **Hume EVI 3**; outros provedores permanecem para outras línguas, telefonia e fallback.

## Stack actual (Maio 2026)

| Camada | Activo | Notas |
|---|---|---|
| Framework | Next.js 16.2.4 (Turbopack) + React 19 | App Router, force-dynamic |
| **Voice AI primário (pt-PT)** | **Hume EVI 3** | Voz nativa pt-PT, prosódia adaptativa, end-to-end |
| LLM (via Hume) | Claude Sonnet 4 (`claude-sonnet-4-20250514`) | temperature 0.2 |
| Auth Hume | `fetchAccessToken` do SDK `hume` | OAuth client credentials |
| Calendar tool | `/api/calendar` Google Calendar | Service account, inalterado entre provedores |
| Database | Supabase (PostgreSQL + RLS) | Tabela `calls`, public read |
| Deploy | Vercel | `voice-demo-navy.vercel.app` |
| UI | Tailwind v4 + shadcn/ui (Base UI) | — |

### Provedores no stack (paralelo, multilíngue)

Todos os caminhos estão **mantidos em código** para permitir A/B, fallback e melhor escolha por mercado:

| Provedor | Estado | Melhor para | Como activar |
|---|---|---|---|
| **Hume EVI 3** | ✅ Activo (pt-PT) | pt-PT nativo, prosódia adaptativa | `<HumeWidget />` em `app/page.tsx` |
| **ElevenLabs ConvAI** | 🟡 Standby | pt-PT (voz Marta), EN, ES, FR, DE | `<LiveKitWidget />` (nome legacy — usa ElevenLabs por baixo) |
| **LiveKit + Grok Voice (xAI)** | 🟡 Standby (Python) | Realtime end-to-end EN, multilingual experimental | `livekit-agent/agent.py` — deploy separado Railway |
| **Vapi + Groq Llama** | 🟡 Standby (telefone) | Outbound call (US number) | `/api/call/route.ts` + `/api/vapi/webhook` |

**Decisão por mercado:**
- 🇵🇹 pt-PT → Hume EVI 3 (sotaque + prosódia)
- 🇺🇸 🇬🇧 EN / outros → ElevenLabs ConvAI (catálogo de vozes maduras)
- 📞 Outbound telefone US (form "Call Me") → Vapi (mantido até migrar para Telnyx/Twilio SIP)
- 🧪 Experimentos end-to-end multilingual → LiveKit + Grok Voice

### Histórico de iterações (resumo)

1. **Vapi + Groq Llama 3.3** (inicial) — sotaque pt-BR/americano não aceitável para audiência PT
2. **LiveKit + Grok Voice (xAI Realtime)** — end-to-end real mas sotaque pt-PT fraco
3. **ElevenLabs ConvAI + voz "Marta" (pt-PT)** — sotaque nativo OK, pipeline (não end-to-end)
4. **Hume EVI 3 + voz "A Viajante de Alma" / clone custom** — **estado actual** para pt-PT

### Trade-off chave identificado

Em qualquer provedor, **TTS Playground (single-pass)** soa "estúdio" porque renderiza a frase inteira com tempo. **Conversational AI (streaming)** soa "telefone ao vivo" porque sintetiza em chunks sob pressão de latência. Não há lever de software para apagar essa diferença com a mesma voz — opções reais são (a) escolher voz com cadência base que aguente streaming, (b) voice clone bem treinado, (c) construir pipeline custom STT+LLM+TTS standalone (perde prosódia adaptativa do end-to-end).

## Estrutura do projecto

```
app/
  page.tsx                              # Landing page — força <HumeWidget />
  api/
    hume/access-token/route.ts          # OAuth Hume — fetchAccessToken (server-side)
    elevenlabs/signed-url/route.ts      # ElevenLabs ConvAI signed URL (standby)
    vapi/webhook/route.ts               # Vapi event handler (call lifecycle, end-of-call-report)
    call/route.ts                       # Outbound call via Vapi REST (US only)
    calendar/route.ts                   # Tool endpoint — Google Calendar createEvent
components/
  HumeWidget.tsx                        # ✅ Activo — usa @humeai/voice-react (VoiceProvider + useVoice)
  LiveKitWidget.tsx                     # Standby — apesar do nome, usa @elevenlabs/react (legacy naming)
  VapiWidget.tsx                        # Standby — Vapi web SDK
  CallStats.tsx                         # Async server component, revalidate 60s
  CallMeForm.tsx                        # Outbound call trigger
  PhoneNumber.tsx                       # Copy-to-clipboard
  QRCode.tsx                            # Async server component, SVG via dangerouslySetInnerHTML
lib/
  supabase.ts                           # Lazy singleton clients (anon + service_role)
  vapi.ts                               # VapiEvent types + detectLanguage()
  google-calendar.ts                    # Google Calendar service-account (createEvent)
livekit-agent/                          # Python agent server — fallback Grok Voice end-to-end
  agent.py                              # AgentSession + RealtimeModel (xAI base_url)
  system-prompt.txt                     # Prompt Ana pt-PT com regras fonéticas
  requirements.txt
  Dockerfile                            # Para Railway deploy se reactivar
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
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | LiveKit fallback path |
| `XAI_API_KEY` | Grok Voice via LiveKit (Python agent) |

**Vercel:** vars Supabase sincronizadas via Supabase native integration. **Hume vars precisam ser adicionadas manualmente** ao Vercel para o deploy produção funcionar com Hume (estado actual: produção ainda usa ElevenLabs até esta sync).

## Como trocar de provedor

```tsx
// app/page.tsx
import HumeWidget from "@/components/HumeWidget";        // pt-PT activo
// import LiveKitWidget from "@/components/LiveKitWidget"; // EN / outras línguas (ElevenLabs por baixo)
// import VapiWidget from "@/components/VapiWidget";       // Vapi legacy

// ...

<HumeWidget />
```

Para reactivar caminho **Grok Voice end-to-end** (Python LiveKit agent): deploy `livekit-agent/` via Railway com env vars `XAI_API_KEY`, `LIVEKIT_*`, `CALENDAR_ENDPOINT`, `WEBHOOK_SECRET`.

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

- **Config ID em produção:** `7fd9f653-21d8-42db-b3df-c287d5899ec2` (versão actual: 22)
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

**Edição via API:** sempre enviar payload completo (PUT-style). Voice field obrigatório em qualquer update. Campos `interruption` e `speech_detection_threshold` não aceites via API — editar pela UI.

**EVI 3 → EVI 4-mini:** trocar é apenas mudar `evi_version` no dropdown da UI e Save. Mantém LLM externo (Claude), mesma voz, mesmo prompt. Latência menor, custo menor.

**Armadilha voice clone IDs:** ao criar um clone, a Hume devolve um `generation_id` (e.g. `8fd2aeb6-...`) — temporário. O `voice_id` estável (e.g. `ab262199-...`) é o que aparece na listagem do dashboard e vai no config. Nunca usar generation_id no config.

**Prompts de voz — princípio chave:** o LLM gera texto, a voz Octave faz a pronúncia. Instruções fonéticas no prompt ("vogais fechadas", "sh final", "evita sotaque BR") são **inúteis e prejudiciais**: o LLM não controla fonemas, e negações primam o conceito (mencionar "brasileiro" activa pt-BR no contexto). Prompt deve só controlar léxico, sintaxe, registo e pacing (via `[VOICE DIRECTION: ...]` que o Octave lê). Listar palavras a evitar é o pior — injecta esse vocabulário no contexto. Framing positivo apenas: "falas como em Lisboa", lista de palavras a usar, nunca a evitar.

**Custos Hume:** Free tier esgota-se rapidamente. Para iterar: pay-as-you-go (~$0.20/min em EVI 3; mais barato em EVI 4-mini) ou Creator $99/mo. Verificar saldo antes de sessões longas.

## Pendentes / decisões abertas

- **Vercel env vars Hume** — ✅ adicionadas (HUME_API_KEY, HUME_SECRET_KEY, NEXT_PUBLIC_HUME_CONFIG_ID, HUME_TOOL_SECRET) em Production e Development.
- **`book_meeting` tool** — ✅ implementado via server-side Hume tool. Tool ID: `b8427229-73d6-42d5-bf40-cf4cfbaac73a`. Endpoint: `/api/book-meeting` (auth: `HUME_TOOL_SECRET`). Recolhe nome + telefone + data/hora, cria evento no Google Calendar, devolve `meetingTime` em pt-PT para a Ana confirmar.
- **Velocidade da voz** — controlada via `[VOICE DIRECTION: ...]` no system prompt (Octave lê o bloco). Iteração actual: "Ritmo rápido e directo de conversa de café — frases curtas, sem pausas longas". Funciona melhor que tentar via SDK (não há lever runtime).
- **Voice clone vs Octave shared** — decisão tomada: usar **Octave shared "A Viajante de Alma"** em vez do clone. Clone soa óptimo em Playground (single-pass) mas perde em streaming; Octave shared aguenta melhor o streaming real-time.

## Provedor a acompanhar

**Thinking Machines Lab — "Interaction Models"** (anunciado 11/05/2026). Full-duplex nativo, 0.4s latência, multimodal por design. Hoje em research preview limitado. Candidato natural para substituir Hume EVI 3 quando abrir GA, especialmente se trouxer pt-PT nativo.
