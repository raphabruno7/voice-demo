# Outbound — confirmação/remarcação/cancelamento de marcações

**Estado:** código completo, `CRON_SECRET` em Vercel Production. À espera de número +351 + `OUTBOUND_TRUNK_ID` para activação real.

## Fluxo

1. **Cron** (`/api/cron/outbound-calls`, `vercel.json` → `30 9 * * *`, Hobby = 1×/dia):
   - Auth: `Authorization: Bearer ${CRON_SECRET}`
   - Verifica janela `CALL_HOURS_START`–`CALL_HOURS_END` (default 9–19 Europe/Lisbon)
   - `listUpcomingEvents` no janela `[agora + REMINDER_WINDOW_START_H, agora + REMINDER_WINDOW_END_H]` (default 20–28h = "amanhã")
   - `upsert` em `outbound_appointments` por `calendar_event_id` (idempotente)
   - Selecciona candidatos: `reminder_status='pending'`, `attempts < MAX_REMINDER_ATTEMPTS`, com telefone — máx `MAX_OUTBOUND_CALLS_PER_RUN` (default 3)
   - `triggerOutboundCall` → success: `reminder_status='called'`; falha: `'no_answer'` + WhatsApp

2. **`triggerOutboundCall`** (`lib/livekit-outbound.ts`):
   - Cria room `outbound-{appointmentId}`
   - `AgentDispatchClient.createDispatch(roomName, 'ana-agent', { metadata: JSON.stringify({ callType: 'confirmation', appointmentId, ... }) })`
   - `SipClient.createSipParticipant(OUTBOUND_TRUNK_ID, clientPhone, roomName, { waitUntilAnswered: true, ringingTimeout: TRANSFER_RING_TIMEOUT_S })`

3. **Python agent** (`livekit-agent/agent.py`) — se `callType == "confirmation"`:
   - Usa `system-prompt-confirmation.txt` com `{client_name}`, `{appointment_time}`, `{business_type}`
   - Divulgação obrigatória na saudação (EU AI Act Art. 50): "fala o agente de voz, assistente virtual... chamada automática..."
   - Tools: `confirm_appointment`, `reschedule_appointment(new_start_time)`, `cancel_appointment(reason?)`, `opt_out`

4. **Endpoints** (`/api/appointments/*`, auth `x-vapi-secret == WEBHOOK_SECRET`, sempre retornam 200):
   - `confirm` → `reminder_status='confirmed'` + WhatsApp
   - `reschedule` → `updateEventTime` Calendar + `'rescheduled'` + WhatsApp
   - `cancel` → `cancelEvent` Calendar + `'cancelled'` + WhatsApp
   - `opt-out` → `'opted_out'` + WhatsApp (cron nunca volta a tentar)

## Compliance

- **EU AI Act Art. 50** — divulgação na primeira frase (`system-prompt-confirmation.txt`)
- **GDPR** — só clientes existentes sobre a sua própria marcação (legitimate interest). Base legal/consentimento é responsabilidade de cada cliente final (clínica/imobiliária) — não resolvido pelo código
- **Opt-out** — `opted_out` é respeitado indefinidamente pelo cron
- **PII** — `outbound_appointments` sem RLS pública

## Env vars específicas

| Var | Default |
|---|---|
| `CRON_SECRET` | ✅ Vercel Production |
| `MAX_OUTBOUND_CALLS_PER_RUN` | `3` |
| `MAX_REMINDER_ATTEMPTS` | `1` |
| `REMINDER_WINDOW_START_H` / `REMINDER_WINDOW_END_H` | `20` / `28` |
| `CALL_HOURS_START` / `CALL_HOURS_END` | `9` / `19` |

Reutiliza: `OUTBOUND_TRUNK_ID`, `TRANSFER_RING_TIMEOUT_S`, `TRANSFER_CALLER_ID_NAME`, `WEBHOOK_SECRET`.
