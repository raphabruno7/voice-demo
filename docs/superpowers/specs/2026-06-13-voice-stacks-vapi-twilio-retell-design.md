# Design — 3 novas demos de voz: Vapi, Twilio, Retell

Data: 2026-06-13
Estado: em revisão

## Objectivo

Adicionar **três** novas demos de voice AI ao portfolio, paralelas a `/hume`, `/livekit`, `/elevenlabs`:

- `/vapi` — orquestrador Vapi (browser, WebRTC)
- `/retell` — orquestrador Retell AI (browser, WebRTC)
- `/twilio` — telefonia Twilio + ConversationRelay (telefone real + botão no browser)

A galeria `/` passa de 3 para 6 cards. Cada demo é configurada no provider (padrão do projecto: o agente vive no dashboard/API do fornecedor, o repo só versiona o system prompt e o código de integração). Toda a estrutura é criada agora; as contas/keys reais são ligadas depois pelo Raphael ("pronto, à espera das credenciais", como o DIDWW).

### Decisões do brainstorming
- **Twilio**: ConversationRelay (stack nativa moderna), número real (Raphael vai comprar — provavelmente não-PT, mais barato/menos burocrático), e **ambos** os modos de interacção (telefone + botão no browser via Twilio Voice JS SDK).
- **Retell**: mesmo padrão do Vapi (browser, voz Marta, `book_meeting`); LLM **Gemini** por defeito (chave já existe), configurável.
- **Vapi**: Claude Sonnet 4 + voz ElevenLabs "Marta".

## Trade-off / posicionamento (mostrar em cada página, registo técnico)

| Demo | Tipo | Latência | Prosódia | Telefone |
|---|---|---|---|---|
| Hume `/` | end-to-end | baixa | adaptativa | futuro |
| Gemini Live `/livekit` | end-to-end | baixa | nativa | futuro (SIP) |
| ElevenLabs `/elevenlabs` | pipeline gerido | média | boa | não |
| **Vapi** `/vapi` | pipeline orquestrado | média | boa | via número importado |
| **Retell** `/retell` | pipeline orquestrado | média | boa | via número importado |
| **Twilio** `/twilio` | telefonia + ConversationRelay | média | TTS gerido | **sim (nativo)** |

## Infra — ponto crítico

- **Vapi e Retell**: browser puro (Web SDK, WebRTC). Sem servidor extra. Tudo no Vercel (rotas de tool) + browser.
- **Twilio ConversationRelay**: precisa de um **servidor WebSocket persistente** que o Vercel serverless não suporta. Vai numa pasta nova `twilio-agent/` (Node + `ws`), deployável em Railway/local — mesmo modelo do `livekit-agent/` (Python). O TwiML route (`/api/twilio/twiml`) fica no Vercel e aponta para o WSS do relay.

## Refactor partilhado: `lib/book-meeting.ts`

Extrair de `app/api/book-meeting/route.ts`:
```ts
export async function bookMeeting(args: { callerName: string; callerPhone: string; startTime: string }):
  Promise<{ success: boolean; meetingTime?: string; error?: string }>
```
Faz `createEvent` + formata `meetingTime` pt-PT + `sendWhatsApp` (best-effort). `app/api/book-meeting/route.ts` (Hume) passa a chamá-la — comportamento idêntico, só refactor. Os três novos provedores reutilizam esta função nos seus endpoints de tool.

## i18n + galeria (partilhado)

- `lib/i18n/dictionaries.ts`: adicionar `nav.{vapi,retell,twilio}`; `widgets.{vapi,retell,twilio}` (badge, title, description, powered, callButton, ending, listening); `gallery.stacks.{vapi,retell,twilio}` (title, description, powered, badge). Estender o tipo `Dict`. Tudo em pt + en.
- `components/AgentNav.tsx`: adicionar as 3 entradas ao array `agents`.
- `app/page.tsx`: adicionar 3 objectos ao array `stacks` (`app/page.tsx:39`) com cores novas; adicionar essas cores ao mapa `colorClasses` (`app/page.tsx:8`); mudar o grid `sm:grid-cols-3` → `sm:grid-cols-2 lg:grid-cols-3` (6 cards = 2 linhas de 3).
- Cores por demo (distintas das existentes emerald/violet/amber): **Vapi = sky**, **Retell = fuchsia**, **Twilio = rose**.

---

## Demo 1 — `/vapi`

### Página `app/vapi/page.tsx`
Espelha `app/elevenlabs/page.tsx`: `force-dynamic`, bilingue, `AgentNav`, footer comum, badge "Pipeline · Vapi". Renderiza `<VapiWidget dict={...} />`.

### `components/VapiWidget.tsx` (reescrever)
O stub actual não é usado (cor emerald, label hardcoded EN, sem transcrição). Reescrever:
- i18n via `dict`, tema **sky**.
- Estados `idle|connecting|active|ending` via `vapi.on("call-start"/"call-end"/"speech-start"/"speech-end")`.
- Transcrição: `vapi.on("message", m => m.type==="transcript" && m.transcriptType==="final")`, mapear `m.role` user/assistant. UI caixa scroll igual às outras.
- `vapi.start(NEXT_PUBLIC_VAPI_ASSISTANT_ID)` com `NEXT_PUBLIC_VAPI_PUBLIC_KEY`. Guard: se key ausente, botão "Indisponível", não crasha.

### `app/api/vapi/book-meeting/route.ts` (novo)
- Auth `x-vapi-secret === VAPI_WEBHOOK_SECRET`.
- Lê `message.toolCalls[]`/`toolCallList[]` (`{id, function:{name, arguments}}`), parse de `arguments`, chama `bookMeeting`.
- Responde `{ results: [{ toolCallId, result: <frase pt-PT> }] }`. Sempre 200.

### `vapi-agent/system-prompt.txt` (novo, versionado)
Registo pt-PT Lisboa, "sem perguntas sociais recíprocas", uma pergunta por turno, qualificação/objecções, marcação via `book_meeting`. Prompt live configurado na config do assistant Vapi.

### Config do assistant Vapi (via API/dashboard, fora do build)
`model`: anthropic `claude-sonnet-4-20250514` temp 0.2; `voice`: 11labs `bBNhdwrIjl4fcVYiRbT2`; `transcriber`: deepgram `pt` (validar); `firstMessage` pt-PT; tool `book_meeting` (schema callerName/callerPhone/startTime ISO) com `server.url`→`/api/vapi/book-meeting`, `server.secret`=`VAPI_WEBHOOK_SECRET`. `ELEVENLABS_API_KEY` registada como provider key no dashboard Vapi.

---

## Demo 2 — `/retell`

### Dependência
Adicionar `retell-client-js-sdk` ao `package.json`.

### Página `app/retell/page.tsx`
Espelha `/vapi`. Badge "Pipeline · Retell". Tema **fuchsia**. Renderiza `<RetellWidget dict={...} />`.

### `components/RetellWidget.tsx` (novo)
- `RetellWebClient` do `retell-client-js-sdk`: `startCall({ accessToken })`, eventos `call_started`/`call_ended`/`update` (transcrição), `agent_start_talking`/`agent_stop_talking`.
- Token de acesso obtido de `/api/retell/web-call` (server, cria web call e devolve `access_token`).
- Tema fuchsia, transcrição em tempo real, estados como os outros widgets. Guard de key ausente.

### `app/api/retell/web-call/route.ts` (novo)
- `POST https://api.retellai.com/v2/create-web-call` com `Authorization: Bearer RETELL_API_KEY`, body `{ agent_id: RETELL_AGENT_ID }`. Devolve `{ access_token }` ao browser.

### `app/api/retell/book-meeting/route.ts` (novo)
- Retell tool calls chegam via custom function webhook. Auth por header secreto (`x-retell-secret === RETELL_WEBHOOK_SECRET`).
- Parse do payload de function call do Retell, chama `bookMeeting`, devolve no formato esperado pelo Retell. Sempre 200.

### `retell-agent/system-prompt.txt` (novo, versionado)
Mesmo registo pt-PT das outras. Agente configurado no dashboard Retell.

### Config do agente Retell (dashboard/API)
LLM: **Gemini** (default; configurável — Retell via LLM nativo ou custom LLM, conforme suporte de Gemini na conta). Voz: ElevenLabs "Marta" `bBNhdwrIjl4fcVYiRbT2`. Tool `book_meeting`→`/api/retell/book-meeting`. **Escolha final do LLM fica em aberto** — estrutura não depende disso.

---

## Demo 3 — `/twilio`

### Dependências
Adicionar `@twilio/voice-sdk` (browser) e `twilio` (server, tokens/TwiML). O relay usa `ws` (na pasta `twilio-agent/`, package próprio).

### Página `app/twilio/page.tsx`
Badge "Telefonia · Twilio ConversationRelay". Tema **rose**. Mostra **dois** modos:
1. **Botão no browser** — `<TwilioWidget dict={...} />` (Voice JS SDK liga para o TwiML app).
2. **Número de telefone** — componente que mostra o número Twilio (placeholder/oculto até existir; reutilizar padrão de `components/PhoneNumber.tsx` se aplicável). Quando `NEXT_PUBLIC_TWILIO_NUMBER` ausente, mostra "Número em breve".

### `components/TwilioWidget.tsx` (novo)
- `Device` do `@twilio/voice-sdk`: obtém token de `/api/twilio/token`, `device.connect()` para iniciar chamada browser→TwiML.
- Estados como os outros; transcrição em tempo real **se** o relay reencaminhar eventos de transcript ao browser (ver nota); senão, mostra só estado da chamada. Tema rose. Guard de key/token ausente.

### `app/api/twilio/token/route.ts` (novo)
- Gera Twilio AccessToken (VoiceGrant) com `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`/`TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID`. Devolve `{ token }`.

### `app/api/twilio/twiml/route.ts` (novo)
- Endpoint que o TwiML App chama em cada chamada (browser ou PSTN). Devolve TwiML:
  ```xml
  <Response>
    <Connect>
      <ConversationRelay url="wss://<twilio-agent-host>/relay" ttsProvider="ElevenLabs" voice="bBNhdwrIjl4fcVYiRbT2" language="pt-PT" />
    </Connect>
  </Response>
  ```
- Validação de assinatura Twilio (`x-twilio-signature`) com `TWILIO_AUTH_TOKEN`.

### `twilio-agent/` (novo — servidor WebSocket separado, deploy Railway/local)
- `server.js` (Node + `ws`): aceita a ligação WebSocket do ConversationRelay.
  - Recebe eventos `setup`/`prompt` (texto transcrito pela Twilio).
  - Envia o texto ao LLM (Claude Sonnet 4 via Anthropic API), faz stream da resposta de volta como mensagens `text` (a Twilio sintetiza com ElevenLabs).
  - Tool `book_meeting`: quando o LLM a chama, faz `POST` a `/api/book-meeting` e devolve o resultado ao LLM.
- `system-prompt.txt` — mesmo registo pt-PT.
- `package.json` próprio (`ws`, `@anthropic-ai/sdk`), `Dockerfile` (modelo do `livekit-agent/Dockerfile`).
- **Nota transcrição no browser**: o ConversationRelay não fala directamente com o browser; o relay pode opcionalmente publicar transcript via um canal (ex: SSE/endpoint) para o `TwilioWidget` mostrar. **Fase 1**: widget mostra só estado (ligado/a falar); transcrição em tempo real no browser fica como melhoria opcional (YAGNI inicial).

### Config Twilio (dashboard, quando houver conta)
- Comprar número (não-PT aceitável). TwiML App apontando `Voice URL`→`/api/twilio/twiml`. Número atribuído ao TwiML App. ElevenLabs ligado como TTS provider do ConversationRelay (ou usar TTS nativo se ElevenLabs não estiver disponível no plano).

---

## Variáveis de ambiente (todas a preencher depois)

| Var | Demo | Onde |
|---|---|---|
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, `NEXT_PUBLIC_VAPI_ASSISTANT_ID` | Vapi | browser |
| `VAPI_API_KEY`, `VAPI_WEBHOOK_SECRET` | Vapi | server |
| `RETELL_API_KEY`, `RETELL_AGENT_ID`, `RETELL_WEBHOOK_SECRET` | Retell | server |
| `NEXT_PUBLIC_RETELL_AGENT_ID` (se necessário no browser) | Retell | browser |
| `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID` | Twilio | server (token) |
| `NEXT_PUBLIC_TWILIO_NUMBER` | Twilio | browser (mostrar número) |
| `TWILIO_AGENT_WSS_URL` | Twilio | TwiML route (URL do relay) |
| `ANTHROPIC_API_KEY` | Twilio relay | `twilio-agent/` |
| `GEMINI_API_KEY` (já existe) | Retell (se LLM Gemini) | dashboard Retell |

Reutiliza `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` (já existem para WhatsApp). Preencher em `.env.local` + Vercel (Production + Development) quando ligadas.

## Erros e edge cases
- Qualquer key ausente → widget mostra "Indisponível"/"Em breve", build não quebra (guards, padrão do `CallStats`).
- Tools de marcação falham → endpoint responde 200 com frase de fallback (Vapi/Retell tratam não-200 como erro).
- Twilio relay offline → chamada liga mas sem agente; TwiML pode ter `<Say>` de fallback. Fase 1 aceita isto (relay é deploy manual).

## Testes / verificação
- `npm run build` passa sem nenhuma key nova (guards).
- Refactor `book-meeting`: `/api/book-meeting` (Hume) responde igual a antes (teste com payload conhecido).
- Galeria `/` mostra 6 cards alinhados (grid 2×3), `AgentNav` 6 demos, bilingue.
- Com keys reais (depois): cada widget liga, voz pt-PT, transcrição (onde aplicável), marcação end-to-end (Calendar + WhatsApp).
- Twilio: chamada browser→relay→Claude→TTS, e chamada PSTN quando número existir.

## Faseamento sugerido da implementação
1. **Refactor `lib/book-meeting.ts`** + i18n/galeria/nav scaffolding (base partilhada).
2. **Vapi** (mais simples, SDK já instalado).
3. **Retell** (análogo, instalar SDK).
4. **Twilio** (TwiML + token + widget no Vercel; `twilio-agent/` WebSocket relay separado).

Cada fase pode ir live independentemente (cada card aparece quando a sua demo está pronta + key ligada).

## Fora de scope (YAGNI)
- Transcrição em tempo real no browser para Twilio (fase 1: só estado).
- Form outbound "Ana liga-te" nas novas páginas.
- Modo texto nos widgets.
- Persistência das chamadas novas em Supabase `calls` (webhooks existentes podem cobrir no futuro).
- Número PT no Twilio (Raphael usa número mais barato/não-PT por agora).
