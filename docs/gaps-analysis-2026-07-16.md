# Análise de gaps — voice-demo (2026-07-16)

> **Estado:** 🟢 Vivo — mapa de gaps do projecto. Gap #1 fechado (PR #16); #2, #3, #4 abertos.
> **Actualizado:** 2026-09-04 · **Âmbito:** o *quê* e o *porquê*. O *como* está em [execution-plan-2026-07-16.md](execution-plan-2026-07-16.md).

> **Para o agente que vai executar:** este documento é um handoff accionável. Cada gap tem
> estado, **evidência** (ficheiros reais), uma **abordagem sugerida** e esforço estimado. Lê a
> secção "Regras do repo" no fim antes de tocar em código. Escolhe **um** gap, não tentes todos.

## Porque este documento existe (decisão estratégica)

Numa sessão de análise comparativa entre o `azure-voice-study` (estudo Azure, par educacional) e
este `voice-demo`, chegou-se a uma conclusão fundamentada e **confirmada empiricamente pelo dono do
projecto** (ouviu os 6 provedores):

- **O LiveKit + Gemini Live (`gemini-2.5-flash-native-audio-latest`) é o melhor pt-PT em tempo real
  de todos os provedores** — voz nativa perfeita em português europeu **e** latência de native audio
  (não-reasoning). Quebra o trade-off "pt-PT autêntico vs. latência baixa" que afecta as outras vias.
- A Azure Voice Live (do projecto irmão) **não** é competitiva aqui: a sua única vantagem restante é
  residência de dados na UE + observabilidade cascaded, não voz nem latência. Além disso, tornar a
  Azure rápida esbarra em quota (modelos rápidos descontinuados ou a 0).
- **Decisão:** investir neste `voice-demo` (caminho Gemini). O `azure-voice-study` fica concluído.
  Nada a portar de um para o outro.

Este documento lista o que **falta** no voice-demo para o levar de "demo excelente" a "produto".

## TL;DR — prioridade recomendada

1. **🔴 Gap #1 — Medir latência por turno** (baixo esforço, alto valor). Fecha o fio de toda a
   discussão sobre latência: hoje **não há número real**. Fazer primeiro.
2. **🔴 Gap #2 — Harness de avaliação de conversa** (esforço médio-alto). O diferenciador demo→produto.
3. **🟡 Gap #3 — PSTN real** (esforço alto, dependências externas). Maior salto de alcance.
4. **🟠 Gap #4 — Observabilidade profunda + escala** (esforço médio).

---

## 🔴 Gap #1 — Sem medição de latência real por turno

**Estado:** ausente (verificado por grep). A única "latência" que existe é o *ping de saúde* dos
serviços (`lib/resend.ts` → `latency_ms`, e `lib/health-checks.ts`), que mede "o serviço está de pé",
**não** a latência da conversa.

**O que falta:** o número que interessa — **fim da fala do utilizador → primeira sílaba da resposta**
do agente (e, idealmente, decomposto: tempo até o modelo começar, tempo até o áudio sair).

**Evidência:**
- `livekit-agent/agent.py` — o `AgentSession(llm=model)` e o `RealtimeModel` não registam timings.
- `lib/resend.ts:7` — `latency_ms` é do health check, não da conversa.

**Abordagem sugerida:**
- O LiveKit Agents (1.5.x) **emite métricas** de sessão (ex: eventos de métricas com TTFT/uso). Investigar
  o hook de métricas do `AgentSession` (ex: um handler `metrics_collected`) e, em complemento, cronometrar
  manualmente **end-of-user-speech → primeiro frame de áudio do agente**.
- Persistir por turno numa tabela Supabase nova (ex: `turn_metrics`: `call_id, turn_index, ttf_audio_ms,
  model_ttft_ms, created_at`) ou como coluna agregada em `calls`. Migrations em `supabase/migrations/`.
- Expor no dashboard admin (`app/status/page.tsx`) uma métrica p50/p95 de latência por turno.

**Esforço:** baixo-médio. **Valor:** alto — passas a **optimizar com dados** em vez de teoria.

---

## 🔴 Gap #2 — Sem harness de avaliação de conversa

**Estado:** ausente. **Há** testes unitários das tools/rotas (bom: `lib/book-meeting.test.ts`,
`lib/google-calendar.test.ts`, `app/api/**/route.test.ts`, `livekit-agent/test_arcus_lookup.py`),
mas **nada avalia a conversa em si**.

**O que falta:** um runner que corra cenários de conversa e meça:
- Precisão da transcrição (STT) contra referências.
- Se a **tool certa** é chamada com os argumentos certos ao longo de uma conversa real (ex: agendar
  com nome/data corretos, transferir só quando deve).
- **Regressões** quando trocas modelo, prompt ou voz (o item que te protege ao iterar).

**Abordagem sugerida:**
- Definir um conjunto de cenários (áudio pré-gravado ou texto→TTS) com expectativas (tool esperada,
  slots esperados, intenção). Correr contra o agente e pontuar. Pode começar por texto (sem áudio)
  para validar a camada de tool-calling, depois subir para áudio.
- Guardar resultados por execução para comparar entre versões (mesma tabela/relatório do dashboard).

**Esforço:** médio-alto. **Valor:** alto — é o que separa "demo" de "produto fiável".

---

## 🟡 Gap #3 — PSTN real incompleto

**Estado:** a meio. O browser (WebRTC) funciona. Falta o **número de telefone vivo** para
receber/fazer chamadas reais (o caso de uso enterprise nº1).

**Evidência:** `CLAUDE.md` → "Pendentes: PSTN real — número Twilio ou DIDWW +351 para LiveKit SIP".
`livekit-agent/setup_sip.py` configura os trunks SIP; `agent.py` já trata `_find_sip_participant` e
transferência SIP atendida (`transfer_to_human`, `OUTBOUND_TRUNK_ID`).

**Abordagem sugerida:** provisionar o número (+351 DIDWW ou Twilio), ligar o inbound trunk ao
`ana-agent`, testar chamada real inbound + a transferência atendida. Muito do código já existe.

**Esforço:** alto (provisioning + dependências externas + custo). **Valor:** alto (produto real).

---

## 🟠 Gap #4 — Observabilidade rasa + escala

**Estado:** observabilidade é binária (serviço up/down) + email diário (`lib/health-checks.ts`,
`app/api/cron/health-check`, dashboard `/status`). Escala: `livekit-agent/agent.py` usa
`num_idle_processes=2, load_threshold=0.75` — chega para demo, não para volume.

**O que falta:** telemetria profunda — latência por turno (ver #1), **taxa de sucesso das tools**,
**custo por chamada**, pontos de desistência; e uma estratégia de escala real (autoscale por carga,
métricas de fila).

**Abordagem sugerida:** construir sobre o #1 (métricas por turno) e agregar por chamada/dia. Escala
fica para quando houver volume real (não antecipar).

**Esforço:** médio. **Valor:** médio (cresce com o uso).

---

## ✅ O que NÃO é gap (maduro — não mexer)

Tools **reais** (`lib/book-meeting.ts`, `lib/google-calendar.ts`, `lib/whatsapp.ts`), **memória**
(Supabase: `calls`, `outbound_appointments`, `health_checks`), health checks + dashboard admin
protegido, scaffolding de telefonia (Twilio ConversationRelay activo; LiveKit SIP configurado), CRM
(`livekit-agent/arcus_lookup.py`), transferência atendida, i18n PT/EN, e **testes das tools**. Foi
esta maturidade que levou à decisão de não portar nada do azure-voice-study para cá.

Boas práticas já presentes no `agent.py` que vale manter (e replicar noutros provedores se aplicável):
afinação do VAD (`AutomaticActivityDetection`, `silence_duration_ms=600`, sensibilidade LOW — com
comentário a explicar porquê), mute do input até a saudação terminar (com `finally` que garante a
reactivação), e `update_instructions` dinâmico após lookup de CRM.

---

## Regras do repo voice-demo (ler antes de codificar)

- **Git:** sempre **branch + PR**, **nunca commit directo em `main`**. Remote:
  `github.com/raphabruno7/voice-demo`. Commit style: `feat(livekit): ...` / `fix(...)` / `docs(...)`.
- **Stack:** Next.js 16 (App Router, Turbopack) + Vercel; Python `livekit-agent/` (Railway, projecto
  `balanced-appreciation`, serviço `voice-demo`); Node `twilio-agent/` (Railway).
- **Ficheiro-chave do agente em tempo real:** `livekit-agent/agent.py`.
- **Deploy:** push `main` → Vercel auto-deploy. O agente Python só aplica env vars novas após **Deploy
  manual** no Railway (mudar valor não reinicia o processo).
- **Gemini Live:** não definir `language="pt-PT"` no `RealtimeModel` (rejeita com APIError 1007);
  confiar no system prompt. `GEMINI_API_KEY` vive em 4 sítios — ver `CLAUDE.md`.
- Migrations Supabase em `supabase/migrations/` (RLS; writes via service_role).
- Consultar `CLAUDE.md` (raiz) e `docs/providers.md` para contexto completo antes de mexer.

---

*Gerado em 2026-07-16 por análise de engenharia. Deliverable: escolher um gap (recomendado o #1) e
executar numa branch + PR.*
