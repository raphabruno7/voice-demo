# Design — 4ª demo `/vapi` (Vapi + Claude + ElevenLabs)

Data: 2026-06-13
Estado: aprovado para implementação

## Objectivo

Adicionar uma quarta demo de voice AI ao portfolio, paralela a `/hume`, `/livekit` e `/elevenlabs`, usando o **Vapi** como orquestrador de pipeline (STT + LLM + TTS) no browser. Mostra a abordagem "pipeline modular" como contraponto às demos end-to-end (Hume, Gemini Live) e à pipeline gerida da ElevenLabs.

Não-objectivos (decididos no brainstorming):
- Twilio **não** entra nesta página. Vapi Web SDK liga via WebRTC, sem número de telefone. O Twilio mantém-se só para WhatsApp (notificações) e fica reservado para o futuro +351 PSTN.
- Sem form outbound "Ana liga-te" nesta página (scope: só widget de voz no browser + `book_meeting`).

## Stack da demo

| Camada | Escolha | Notas |
|---|---|---|
| Orquestrador | Vapi (Web SDK, WebRTC) | `@vapi-ai/web` já em `package.json` |
| LLM | Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`), temp 0.2 | Igual ao Hume |
| Voz (TTS) | ElevenLabs voiceId `bBNhdwrIjl4fcVYiRbT2` ("Marta", pt-PT) | Já validada em `/elevenlabs` |
| STT | Deepgram (default Vapi) — `language: pt` se suportado | A confirmar pt-PT na config; fallback para multilingue |
| Tool | `book_meeting` | Mesma lógica das outras demos, novo endpoint para o formato Vapi |

Trade-off conhecido (documentar na página, registo técnico): pipeline STT+LLM+TTS tem mais latência e perde prosódia adaptativa vs end-to-end (Hume/Gemini). Mesmo caveat já descrito no `CLAUDE.md`.

## Componentes

### 1. Página `app/vapi/page.tsx`
- Espelha a estrutura de `app/elevenlabs/page.tsx`: `force-dynamic`, bilingue (lang detect + dict), `AgentNav`, footer comum (`← Portfolio · work@raphaelbruno.dev · Upwork · LinkedIn`, mesma ordem normalizada).
- Badge: "Pipeline · STT + LLM + TTS". Título/descrição/powered via dicionário.
- Renderiza `<VapiWidget dict={...} />`.

### 2. `components/VapiWidget.tsx` (reescrito)
- Estado actual do ficheiro é um stub não usado (cor emerald, label hardcoded em inglês, sem transcrição). Reescrever para:
  - i18n via `dict` prop (padrão `ElevenLabsWidget`).
  - Tema **sky/blue** (`bg-sky-500` / `text-sky-300`) — distinto de emerald (Hume `/`), violeta (LiveKit), amber (ElevenLabs).
  - Transcrição em tempo real: `vapi.on("message", ...)` filtrando `msg.type === "transcript" && msg.transcriptType === "final"`, mapeando `msg.role` (`user`/`assistant`) para entradas, UI igual às outras (caixa scroll, max-h-64).
  - Estados `idle | connecting | active | ending` (igual ao stub), `vapi.on("call-start"/"call-end"/"speech-start"/"speech-end")`.
  - Arranque: `vapi.start(NEXT_PUBLIC_VAPI_ASSISTANT_ID)` com `NEXT_PUBLIC_VAPI_PUBLIC_KEY`.
  - Sem modo texto (Vapi Web SDK é voz-first; ElevenLabs tinha texto, aqui omitimos — YAGNI).

### 3. Navegação e i18n
- `components/AgentNav.tsx`: adicionar `{ label: dict.vapi, href: "/vapi" }` ao array `agents`.
- `lib/i18n/dictionaries.ts`: nova chave `nav.vapi` (pt: "Vapi", en: "Vapi"); nova secção `widgets.vapi` (badge, title, description, powered, callButton, ending, listening); nova entrada `gallery.stacks.vapi` (title, description, powered, badge) — a galeria `/` lista 3 stacks (`app/page.tsx:39`), passa a 4.
- `lib/i18n/dictionaries.ts` tipo `Dict`: estender interface com `vapi` (nav + widgets.vapi + gallery.stacks.vapi).
- `app/page.tsx`: adicionar `{ href: "/vapi", color: "sky", ...dict.gallery.stacks.vapi }` ao array `stacks` (linha 39-43); adicionar a cor `sky` ao mapa `colorClasses` (linha 8); mudar o grid de `sm:grid-cols-3` para `sm:grid-cols-2 lg:grid-cols-4` (linha 73) para acomodar 4 cards sem ficar desalinhado.

### 4. `lib/book-meeting.ts` (extracção)
- Extrair de `app/api/book-meeting/route.ts` a lógica partilhada:
  ```ts
  export async function bookMeeting(args: { callerName: string; callerPhone: string; startTime: string }):
    Promise<{ success: boolean; meetingTime?: string; error?: string }>
  ```
  Faz `createEvent` + formata `meetingTime` pt-PT + `sendWhatsApp` (best-effort, try/catch como hoje).
- `app/api/book-meeting/route.ts` passa a chamar `bookMeeting(...)` — comportamento idêntico, só refactor. Mantém a auth `x-hume-secret` e a convenção "200 com success:false" para o Hume.

### 5. `app/api/vapi/book-meeting/route.ts` (novo)
- Auth: header `x-vapi-secret === process.env.VAPI_WEBHOOK_SECRET` (mesmo padrão de `app/api/vapi/webhook/route.ts`).
- Vapi envia tool calls no formato `message.toolCalls[]` (ou `message.toolCallList[]`, conforme versão) com `{ id, function: { name, arguments } }`. O handler:
  1. Lê `message.toolCalls` / `toolCallList`.
  2. Para cada call `book_meeting`, faz parse de `arguments` (string JSON ou objecto), chama `bookMeeting(...)`.
  3. Responde no formato Vapi: `{ results: [{ toolCallId, result: <string> }] }` — `result` é a frase de confirmação pt-PT ou erro.
- Sempre 200 (Vapi trata não-200 como erro).

### 6. `vapi-agent/system-prompt.txt` (novo, versionado)
- Cópia do registo pt-PT das outras (mesmo léxico Lisboa, "sem perguntas sociais recíprocas", uma pergunta por turno, qualificação, objecções, marcação via `book_meeting`).
- Ficheiro é **referência versionada** — o prompt live vive na config do assistant Vapi (configurado via API/dashboard), tal como Hume/ElevenLabs. Documentar isto.

### 7. Configuração do assistant Vapi (via API, fora do build)
- Script ad-hoc (não versionado com secrets) ou passos manuais documentados para:
  - `model`: `{ provider: "anthropic", model: "claude-sonnet-4-20250514", temperature: 0.2 }`.
  - `voice`: `{ provider: "11labs", voiceId: "bBNhdwrIjl4fcVYiRbT2" }`.
  - `transcriber`: `{ provider: "deepgram", language: "pt" }` (validar; senão multilingue).
  - `firstMessage`: saudação pt-PT.
  - `tools`: function `book_meeting` (mesmo schema das outras: callerName, callerPhone, startTime ISO) com `server.url` → `https://voice-demo-navy.vercel.app/api/vapi/book-meeting` e `server.secret` = `VAPI_WEBHOOK_SECRET`.
  - `systemPrompt` = conteúdo de `vapi-agent/system-prompt.txt`.
- A `ELEVENLABS_API_KEY` tem de estar registada como **provider key** no dashboard Vapi (não basta `.env.local`). Confirmar com o Raphael.

## Variáveis de ambiente

| Var | Onde | Estado |
|---|---|---|
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY` | `VapiWidget` (browser) | A preencher (Raphael tem conta) |
| `NEXT_PUBLIC_VAPI_ASSISTANT_ID` | `VapiWidget` (browser) | A preencher / criar assistant |
| `VAPI_API_KEY` | Config do assistant via API (server) | A preencher |
| `VAPI_WEBHOOK_SECRET` | `/api/vapi/book-meeting` + webhook existente | A preencher (gerar) |

Adicionar as preenchidas a `.env.local` **e** a Vercel (Production + Development), padrão do projecto.

## Fluxo de dados

```
Browser (/vapi)
  └─ VapiWidget.start(assistantId, publicKey)  ── WebRTC ──>  Vapi cloud
         │                                                      │
         │  <── transcript events (user/assistant) ────────────┤
         │                                                      ├─ STT Deepgram
         │                                                      ├─ LLM Claude Sonnet 4
         │                                                      ├─ TTS ElevenLabs (Marta)
         │                                                      └─ tool call book_meeting
         │                                                              │
         │                          POST /api/vapi/book-meeting <───────┘
         │                                  └─ bookMeeting() → Google Calendar + WhatsApp
         │                                  └─ { results:[{toolCallId, result}] } ──> Vapi ──> Ana confirma por voz
```

## Erros e edge cases
- Sem keys Vapi: `VapiWidget` falha no `start` → estado volta a `idle` (já tratado), e a página deve mostrar a demo na mesma (não quebrar build). Guard: se `NEXT_PUBLIC_VAPI_PUBLIC_KEY` ausente, botão fica desabilitado com texto "Indisponível" em vez de crashar.
- `book_meeting` falha (Calendar down): `bookMeeting` devolve `{success:false}`, endpoint responde 200 com `result` = frase de fallback ("Não consegui criar o evento, o Raphael contacta-te"). Vapi nunca recebe não-200.
- Transcrição truncada/estranha: tratado no system prompt (regra já existente nas outras demos).

## Testes / verificação
- `npm run build` passa sem env vars Vapi (guards).
- Página `/vapi` rende com `AgentNav` mostrando 4 demos, footer correcto, bilingue (toggle pt/en).
- Refactor `book-meeting`: confirmar que `/api/book-meeting` (Hume) continua a responder igual — teste manual com payload conhecido.
- Com keys reais: abrir `/vapi`, falar com a Ana, confirmar voz pt-PT (Marta), transcrição em tempo real, e marcação end-to-end (evento no Calendar + WhatsApp).
- Verificação final manual pelo Raphael (voz real, microfone) — como nas outras demos.

## Fora de scope (YAGNI)
- Twilio / número de telefone.
- Form outbound "Ana liga-te".
- Modo texto no widget.
- Persistência de chamadas Vapi em Supabase `calls` (o webhook `/api/vapi/webhook` já existe para isso se um dia se quiser; não se mexe agora).
