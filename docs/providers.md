# Providers — referência operacional

## Hume EVI

- **Config ID:** `7fd9f653-21d8-42db-b3df-c287d5899ec2` (v50) — `app.hume.ai/evi/configs/...`
- **Runtime:** EVI 4-mini (`evi_version: "4-mini"`)
- **Voz:** "A Viajante de Alma" (`7e4077d4-3f17-4012-bab2-18fd53b0c173`, Octave HUME_AI shared)
- **LLM:** Claude Sonnet 4 (`claude-sonnet-4-20250514`), temperature 0.2
- **turn_detection:** silence 500ms, threshold 0.5, prefix_padding 300ms
- **Custom tool:** `book_meeting` (ID `b8427229-73d6-42d5-bf40-cf4cfbaac73a`) → `/ai-agent-voice/api/book-meeting` (client-side invocation via HumeWidget)

**API é PUT-style** — `POST /v0/evi/configs/{id}` substitui campos não enviados. Sempre enviar payload completo (voice, language_model, prompt, event_messages, turn_detection, builtin_tools). Campos `interruption` e `speech_detection_threshold` só editáveis pela UI.

**Voice clone vs Octave shared:** ao criar clone, Hume devolve `generation_id` (temporário) — o `voice_id` estável aparece na listagem do dashboard. Nunca usar `generation_id` no config.

**Prompts de voz:** LLM gera texto, Octave faz pronúncia. Instruções fonéticas são inúteis e prejudiciais — mencionar "brasileiro" activa sotaque BR no contexto. Só framing positivo: "falas como em Lisboa", lista de palavras a usar, `[VOICE DIRECTION: ...]` para pacing.

---

## Gemini Live (LiveKit)

- **Modelo:** `gemini-2.5-flash-native-audio-latest` (bidiGenerateContent)
- **API Key:** service-account-bound, projecto `gen-lang-client-0657432502`
- **Voz:** `Aoede`
- **Não definir `language=`** — o modelo rejeita `"pt-PT"` e `"pt"` com APIError 1007. Usar só system prompt.
- **Speech detection:** `EndSensitivity.END_SENSITIVITY_HIGH`, silence 300ms, prefix padding 100ms
- **Worker:** `livekit-agent/agent.py`, Python 3.12 (3.14 não suportado pelo livekit-agents)
- **LiveKit project:** `voice-agent-hfi9y0b7.livekit.cloud` (EU West B)
- **Agent name:** `ana-agent` (não mudar — quebra `WorkerOptions`/`createDispatch`)

**Worker zombie:** após queda de rede pode registar-se 2× e parar de atender jobs. `pkill -9 -f agent.py` + restart.

**Modelos válidos** (consultados Maio 2026): `gemini-2.5-flash-native-audio-latest`, `gemini-2.5-flash-native-audio-preview-12-2025`, `gemini-3.1-flash-live-preview`.

### Warm transfer (`transfer_to_human`)

- **Com `OUTBOUND_TRUNK_ID`:** attended transfer via `lkapi.sip.create_sip_participant(wait_until_answered=True, ringing_timeout=TRANSFER_RING_TIMEOUT_S)`. Se não atender → fallback WhatsApp.
- **Sem `OUTBOUND_TRUNK_ID`:** blind SIP REFER (`ctx.transfer_sip_participant`), sem deteção de voicemail.
- **Browser (sem SIP):** tool devolve mensagem, agente continua sem mencionar tentativa.

### Contexto dinâmico de lead (Arcus CRM)

`arcus_lookup.py` — `lookup_by_phone(phone)` / `lookup_by_company_name(name)` → `build_lead_context` → bloco `=== CONTEXTO DO LEAD ===` injectado no system prompt por chamada. Todas as chamadas em `try/except` — falha = modo genérico, nunca bloqueia.

Em chamada SIP usa `sip.phoneNumber`; em browser lê `room.metadata` (`{"leadPhone": "+351..."}`). Tool `lookup_lead_by_name(business_name)` como fallback; `wrap_up_call(intent, summary)` regista outcome no Arcus.

---

## SIP Trunk DIDWW +351

**Status:** infra pronta, aguarda compra do número.

- **Script:** `livekit-agent/setup_sip.py`
- **Número a comprar:** `351-30` (não `351-707` — número de valor acrescentado, tarifário extra para quem liga)
- **KYC:** Registration Required na DIDWW — prova de morada/empresa PT obrigatória
- **SIP destination (DIDWW dashboard):** `voice-agent-hfi9y0b7.sip.livekit.cloud:5060`
- **IPs DIDWW para allowlist:** `46.19.209.14/32`, `46.19.210.14/32`, `46.19.212.14/32`, `46.19.213.14/32`, `46.19.214.14/32`, `46.19.215.14/32`, `185.238.173.14/32`

```bash
PHONE_NUMBER=+351XXXXXXXXX
SIP_USER=<didww-sip-username>
SIP_PASS=<didww-sip-password>
DIDWW_OUTBOUND_ADDRESS=<host>   # opcional — activa outbound trunk (warm transfer)
LIVEKIT_URL=wss://voice-agent-hfi9y0b7.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
python livekit-agent/setup_sip.py
```

Resultado: `SIPInboundTrunk` + `SIPDispatchRule` (→ `ana-agent`) + opcional `SIPOutboundTrunk` (sid vai para `OUTBOUND_TRUNK_ID`).

---

## Vapi

- **Assistant ID:** `629e76a1-3565-48b8-a7e9-e94f67953bc1` (reconfigurado de "Riley")
- **LLM:** Gemini 2.5 Flash via credential `google` (sem `ANTHROPIC_API_KEY`)
- **Voz:** `11labs/sarah` (premade EN — Free plan bloqueia Library voices para API calls)
- **Tool:** `book_meeting` (`d84cbba2-11b7-4e84-89d3-5e55f9fda680`) → `/ai-agent-voice/api/vapi/book-meeting`

`NEXT_PUBLIC_VAPI_*` só ficam inline num build novo via Git push → `main`. Nunca usar `vercel --prod` de branch `feat/*`.

---

## Retell AI

- **Agent ID:** `agent_f732433c304ff6ea52185e3c7c`
- **LLM:** Gemini 3.0 Flash (Retell auto-upgraded de gemini-2.0-flash)
- **Voz:** Cartesia `cleo` (EN) — ElevenLabs Free plan bloqueia Library voices
- **Tool webhook payload:** `body.args` (não `toolCallList` como Vapi)
- **Auth:** `x-retell-secret` header == `RETELL_WEBHOOK_SECRET`

---

## Twilio ConversationRelay

- **TwiML App Voice URL:** `https://voice-demo-navy.vercel.app/ai-agent-voice/api/twilio/twiml`
- **Agent:** `wss://vivacious-expression-production-02d1.up.railway.app` (Railway — projecto `balanced-appreciation`, serviço `vivacious-expression`)
- **LLM:** Gemini 2.5 Flash via `fetch` nativo SSE (sem SDK)
- **TTS:** `ttsProvider="amazon" voice="Polly.Ines-Neural" language="pt-PT"` (ElevenLabs Free = 402)
- **Tool calling:** `book_meeting` → `/api/twilio/book-meeting` (auth via `x-twilio-agent-secret`)
- **Validação:** `twilio.validateRequest()` com body `formData` no `/api/twilio/twiml`
- **Re-deploy:** push para `main` activa Railway auto-deploy

ElevenLabs Free plan bloqueia vozes da Voice Library (`paid_plan_required`) — afecta Vapi (BYOK) e Twilio `ttsProvider="ElevenLabs"`. Não afecta ElevenLabs ConvAI (usa o próprio acesso 11labs) nem Retell (idem).
