# 24/7 Voice Agent — Voice AI Demo

Portfolio demo de Raphael Bruno. Voice AI agent multilíngue com 6 provedores em paralelo para comparação de pipelines de voz. Acessível em [raphaelbruno.dev/ai-agent-voice](https://raphaelbruno.dev/ai-agent-voice).

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + React 19 |
| Deploy Next.js | Vercel — `voice-demo-navy.vercel.app` |
| Python agent (LiveKit) | Railway — projecto `balanced-appreciation` |
| Node agent (Twilio) | Fly.io — `voice-demo-twilio-agent` |
| Database | Supabase (PostgreSQL + RLS) |
| Calendar | Google Calendar service account |
| Notificações | Twilio WhatsApp |

## Provedores

| Provedor | Pipeline | Página |
|---|---|---|
| **Hume EVI 4-mini** | End-to-end pt-PT, prosódia adaptativa | `/` |
| **LiveKit + Gemini Live** | `gemini-2.5-flash-native-audio-latest` | `/livekit` |
| **ElevenLabs ConvAI** | STT + LLM + TTS, voz Marta pt-PT | `/elevenlabs` |
| **Vapi** | Orquestrador browser — Gemini 2.5 Flash | `/vapi` |
| **Retell AI** | Orquestrador browser — Gemini 3.0 Flash | `/retell` |
| **Twilio ConversationRelay** | WebRTC browser + PSTN — Gemini 2.0 Flash | `/twilio` |

## Arquitectura

```
raphaelbruno.dev/ai-agent-voice  ──proxy──▶  voice-demo-navy.vercel.app
                                              (Next.js, multi-zone)
                                                    │
                                    ┌───────────────┼───────────────┐
                                    ▼               ▼               ▼
                             Railway               Fly.io        Supabase
                          (livekit-agent)    (twilio-agent)    (calls DB)
                           Python/Gemini      Node/Gemini
```

O portfolio em `raphaelbruno.dev` faz proxy via `beforeFiles` rewrites do Next.js para `voice-demo-navy.vercel.app`, que tem `basePath: '/ai-agent-voice'`.

## Booking Tool

Todos os provedores partilham o mesmo sistema de agendamento (`lib/book-meeting.ts`) — cria evento no Google Calendar e envia WhatsApp de confirmação.

| Route | Provedor |
|---|---|
| `/api/book-meeting` | Hume + LiveKit |
| `/api/vapi/book-meeting` | Vapi |
| `/api/retell/book-meeting` | Retell |

## Desenvolvimento local

```bash
npm install
npm run dev
```

Requer ficheiro `.env.local` com as variáveis listadas em [CLAUDE.md](CLAUDE.md#environment-variables).

### Python agent (LiveKit)

```bash
cd livekit-agent
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
set -a && source .env && set +a
python -u agent.py dev
```

### Node agent (Twilio)

```bash
cd twilio-agent
npm install
node server.js
```

## Deploy

- **Next.js**: push para `main` → Vercel auto-deploy
- **livekit-agent**: push para `main` → Railway auto-deploy (root `/livekit-agent`)
- **twilio-agent**: `cd twilio-agent && flyctl deploy`

## Documentação

- [CLAUDE.md](CLAUDE.md) — referência operacional completa (stack, env vars, padrões)
- [docs/providers.md](docs/providers.md) — configuração detalhada de cada provedor
- [docs/outbound-calls.md](docs/outbound-calls.md) — fluxo de chamadas outbound (cron diário)
