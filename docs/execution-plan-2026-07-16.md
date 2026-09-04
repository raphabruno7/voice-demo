# Plano de execução — corrigir os gaps do voice-demo

> **Estado:** 🟢 Vivo — plano de execução dos gaps. Gap #1 executado (PR #16); passos #2-#4 por fazer.
> **Actualizado:** 2026-09-04 · **Âmbito:** o *como*, verificado contra o código. O *porquê* está em [gaps-analysis-2026-07-16.md](gaps-analysis-2026-07-16.md).

> **Para o agente que vai executar:** este é o *como*, verificado contra o código e a SDK instalada.
> Companheiro de `docs/gaps-analysis-2026-07-16.md` (o *o quê* e *porquê*). Faz **um gap por PR**,
> pela sequência recomendada no fim. Lê "Regras do repo" antes de tocar em código.

## Factos verificados (base do plano — não adivinhado)

- **`livekit-agents` 1.5.12** (venv em `livekit-agent/venv`).
- Evento **`metrics_collected`** emitido ao nível da sessão; `MetricsCollectedEvent.metrics`.
- **`RealtimeModelMetrics`** (Gemini native audio via `RealtimeModel`): `request_id, timestamp,
  duration, ttft, input_tokens, output_tokens, speech_id`. `ttft` = tempo até 1º token/áudio (default -1).
- **`EOUMetrics`**: `timestamp, end_of_utterance_delay, transcription_delay, speech_id`.
  `end_of_utterance_delay` = tempo do fim da fala do utilizador até a deteção de fim-de-turno.
- **Latência real por turno** ≈ `EOUMetrics.end_of_utterance_delay + RealtimeModelMetrics.ttft`
  (juntar pelo `speech_id`).
- A tabela **`calls`** é escrita em `app/api/livekit/webhook/route.ts` via `supabaseAdmin` (o agente
  Python é fino; faz POST a rotas Next — padrão `CALENDAR_ENDPOINT` em `livekit-agent/agent.py`).
- Migrations em `supabase/migrations/` (RLS; `calls` = public read, `health_checks` = service_role only).

---

## Gap #1 — Latência por turno *(prioridade; fazer primeiro)*

**Objectivo:** registar **fim-da-fala → 1º áudio do agente** por turno e mostrar **p50/p95** no dashboard.
É o número real que hoje não existe — fecha toda a discussão de latência.

### Passo 1 — Migration `supabase/migrations/005_turn_metrics.sql`
```sql
create table turn_metrics (
  id           uuid primary key default gen_random_uuid(),
  call_id      text not null,
  speech_id    text,
  eou_delay_ms integer,   -- EOUMetrics.end_of_utterance_delay * 1000
  ttft_ms      integer,   -- RealtimeModelMetrics.ttft * 1000
  created_at   timestamptz default now()
);
alter table turn_metrics enable row level security;
-- Operacional interno — service_role only, sem public select (como health_checks)
create index turn_metrics_call_id on turn_metrics (call_id, created_at desc);
```

### Passo 2 — Rota `app/api/livekit/metrics/route.ts`
- `POST { callId: string, turns: {speechId, eouDelayMs, ttftMs}[] }`.
- Auth por header `x-metrics-secret` = `process.env.WEBHOOK_SECRET` (reutilizar; já usado noutras rotas).
- Escrever em lote: `await supabaseAdmin.from("turn_metrics").insert(turns.map(t => ({ call_id: callId,
  speech_id: t.speechId, eou_delay_ms: t.eouDelayMs, ttft_ms: t.ttftMs })))`.
- `supabaseAdmin` vem de `lib/supabase.ts` (lazy singleton service_role).
- **Teste:** `app/api/livekit/metrics/route.test.ts`, espelhando o estilo de
  `app/api/livekit/webhook/route.test.ts` (mock do Supabase, auth 401 sem header, 200 com).

### Passo 3 — Agente `livekit-agent/agent.py`
Depois de `session = AgentSession(llm=model)` e antes de `session.start(...)`:
```python
from livekit.agents import metrics as lk_metrics  # tipos: EOUMetrics, RealtimeModelMetrics
_turns: dict[str, dict] = {}   # speech_id -> {"eou_delay_ms":..., "ttft_ms":...}

@session.on("metrics_collected")
def _on_metrics(ev):
    m = ev.metrics
    sid = getattr(m, "speech_id", None)
    if isinstance(m, lk_metrics.EOUMetrics) and sid:
        _turns.setdefault(sid, {})["eou_delay_ms"] = round(m.end_of_utterance_delay * 1000)
    elif isinstance(m, lk_metrics.RealtimeModelMetrics) and sid and m.ttft >= 0:
        _turns.setdefault(sid, {})["ttft_ms"] = round(m.ttft * 1000)
```
Flush no fim (fire-and-forget, padrão `httpx` já no ficheiro):
```python
async def _flush_metrics():
    if not _turns or not METRICS_ENDPOINT:
        return
    payload = {"callId": ctx.room.name,
               "turns": [{"speechId": sid, **vals} for sid, vals in _turns.items()]}
    try:
        async with httpx.AsyncClient() as client:
            await client.post(METRICS_ENDPOINT, json=payload,
                              headers={"x-metrics-secret": CALENDAR_SECRET}, timeout=10)
    except Exception:
        logger.exception("metrics flush failed")
ctx.add_shutdown_callback(_flush_metrics)
```
- Nova env `METRICS_ENDPOINT` (à imagem de `CALENDAR_ENDPOINT`, ex:
  `https://voice-demo-navy.vercel.app/api/livekit/metrics`). `CALENDAR_SECRET` já existe (= `WEBHOOK_SECRET`).
- ⚠️ Confirmar na SDK 1.5.12 o **import exacto** dos tipos (`from livekit.agents import metrics` e
  `metrics.EOUMetrics` / `metrics.RealtimeModelMetrics`) e a assinatura de `MetricsCollectedEvent`
  antes de correr — está tudo em `livekit-agent/venv/.../livekit/agents/metrics/base.py`.

### Passo 4 — Dashboard `app/status/page.tsx`
- Query server-side (service_role) a `turn_metrics` dos últimos N dias.
- Calcular **p50/p95** de `eou_delay_ms + ttft_ms` e mostrar ao lado dos health checks.

### Verificação do Gap #1
- **Unit:** `route.test.ts` passa; teste Python curto que o handler bufferiza/agrega por `speech_id`
  (estilo `livekit-agent/test_arcus_lookup.py`).
- **Ao vivo:** `cd livekit-agent && LIVEKIT_URL=... GEMINI_API_KEY=... METRICS_ENDPOINT=... python -u
  agent.py dev`; conversa no `/livekit`; confirmar linhas em `turn_metrics` com ms plausíveis e o
  p50/p95 no dashboard.

---

## Gap #2 — Harness de avaliação de conversa

**Objectivo:** correr cenários e pontuar tool-calling + transcrição + regressões (o diferenciador demo→produto).

1. `livekit-agent/eval/scenarios.json` — cenários: `user_turns[]`, `expected_tool`, `expected_slots`,
   `expected_intent`.
2. `livekit-agent/eval/run_eval.py` — conduz o modelo por cada cenário. **Fase 1: texto-only**
   (determinístico e barato — valida a camada de tool-calling), capturar as tool calls e comparar com
   o esperado; pontuar. **Fase 2:** áudio (TTS→STT) para medir transcrição.
3. Relatório JSON por execução + resumo; opcional persistir em Supabase p/ comparar versões.

**Verificação:** `run_eval.py` imprime pass/fail; um prompt deliberadamente partido mostra uma regressão.
*(Método de juízo à escolha do executante; isto é o esqueleto.)*

---

## Gap #3 — PSTN real *(bloqueado em provisioning — fazer depois)*

**Dependência externa:** provisionar número (+351 DIDWW ou Twilio) — decisão de billing, não só código.
**Passos:** provisionar número → configurar inbound SIP trunk (`livekit-agent/setup_sip.py` já faz
scaffolding) → encaminhar inbound para o `ana-agent` → testar chamada real inbound + transferência
atendida (já codada em `agent.py: transfer_to_human`, `OUTBOUND_TRUNK_ID`).
**Verificação:** chamada real chega ao agente; a transferência liga para fora.

---

## Gap #4 — Observabilidade profunda + escala *(por cima do #1)*

Agregar `turn_metrics` + taxa de sucesso das tools + custo por chamada no dashboard. Escala (autoscale)
só quando houver volume real — **não antecipar** (`num_idle_processes=2` chega para agora).

---

## Regras do repo (obrigatório)

- **Git:** branch + PR, **nunca commit directo em `main`**. Commit `feat(livekit): ...` / `fix(...)`.
- **Gemini Live:** **não** definir `language="pt-PT"` no `RealtimeModel` (rejeita APIError 1007) —
  confiar no system prompt.
- `GEMINI_API_KEY` vive em **4 sítios** (ver `CLAUDE.md`); o serviço Railway `voice-demo` só aplica env
  novas após **Deploy manual**. Adicionar `METRICS_ENDPOINT` no Railway + `.env.local` + `livekit-agent/.env`.
- Migrations sempre com **RLS**; writes via `service_role` (`supabaseAdmin`).
- Consultar `CLAUDE.md` (raiz) e `docs/providers.md` para contexto completo.

## Sequência recomendada
**#1** (latência — alto valor, baixo esforço, totalmente verificado) → **#2** (avaliação) →
**#4** (por cima do #1) → **#3** (quando o número estiver provisionado).

---
*Gerado em 2026-07-16. Companheiro de `docs/gaps-analysis-2026-07-16.md`.*
