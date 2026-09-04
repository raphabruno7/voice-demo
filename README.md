# voice-demo — 24/7 Voice Agent

> **Estado:** 🟢 Vivo — 6 provedores activos em produção.
> **Actualizado:** 2026-09-04 · **Produção:** https://www.raphaelbruno.dev/ai-agent-voice/
> **Âmbito:** visão geral e arranque local. Referência completa: [CLAUDE.md](CLAUDE.md) · Handoff corrente: [docs/handoff-2026-09-04.md](docs/handoff-2026-09-04.md)

Demo de portfolio: o **mesmo** agente de voz multilíngue implementado em paralelo sobre seis
pipelines diferentes, para os comparar lado a lado — latência, qualidade de voz, prosódia e
comportamento de interrupção. Todos marcam reuniões a sério, no Google Calendar, com
confirmação por WhatsApp.

Branding público: «24/7 Voice Agent» / «Agente de Voz 24/7» (white-label).

## Provedores

| Provedor | Pipeline | Voz | Página |
|---|---|---|---|
| Hume EVI 4-mini | end-to-end pt-PT, prosódia adaptativa | "A Viajante de Alma" | `/` |
| LiveKit + Gemini Live | `gemini-2.5-flash-native-audio-latest` | Aoede | `/livekit` |
| ElevenLabs ConvAI | STT + LLM + TTS | Marta (pt-PT) | `/elevenlabs` |
| Vapi | orquestrador browser — Gemini 2.5 Flash | Sarah (EN) | `/vapi` |
| Retell AI | orquestrador browser — Gemini 3.0 Flash | Cartesia Cleo (EN) | `/retell` |
| Twilio ConversationRelay | ConversationRelay + Gemini 2.0 Flash | Polly.Ines-Neural (pt-PT) | `/twilio` |

Config operacional de cada um: [docs/providers.md](docs/providers.md).

## Arquitectura

```
Next.js 16 (App Router, Turbopack) ──► Vercel        o site e todas as API routes
livekit-agent/   Python, Gemini Live ──► Railway     agente de voz do /livekit (+ SIP)
twilio-agent/    Node, ConversationRelay ──► Railway servidor WebSocket do /twilio
Supabase                                             calls, marcações, health checks, latência
```

`lib/book-meeting.ts` é o núcleo partilhado: cria o evento no Google Calendar e envia o
WhatsApp. Cada provedor tem a sua route com autenticação e parsing próprios.

## Arranque local

```bash
npm install
npm run dev     # http://localhost:3000/ai-agent-voice/
```

O `basePath` é `/ai-agent-voice` — o URL local leva-o, e o `trailingSlash` importa.

```bash
# agente Python do /livekit
cd livekit-agent
LIVEKIT_URL=… LIVEKIT_API_KEY=… LIVEKIT_API_SECRET=… GEMINI_API_KEY=… python -u agent.py dev
```

Variáveis de ambiente: a tabela completa está em [CLAUDE.md](CLAUDE.md#environment-variables).
Atenção ao `GEMINI_API_KEY`, que vive em quatro sítios.

## Operação

- **`/status`** — dashboard admin: estado actual dos 10 serviços, histórico de 30 dias e
  latência p50/p95 por turno. Protegido por cookie.
- **Health check diário** às 07:00 UTC, com email via Resend.
- **Outbound diário** às 09:30 UTC — confirmação de marcações
  ([docs/outbound-calls.md](docs/outbound-calls.md), por activar).

## Contribuir

Sempre branch + PR, nunca commit directo em `main`. Push para `main` faz deploy automático na
Vercel e no Railway.

Estilo de commit: `feat(livekit): …` / `fix(retell): …` / `docs(claude): …`
