# Portfolio bilingue pt-PT / EN

## Contexto

O portfolio (`/`, `/hume`, `/livekit`, `/elevenlabs`) serve dois públicos: clientes locais (zona de Leiria, pt-PT) e clientes Upwork (UK, Canada, Germany, EUA, etc., EN). Hoje todo o copy está em pt-PT, com a excepção de `/hume` que já tem uma mistura inconsistente de PT/EN (heading em EN, botão "Falar com a Ana" em PT, caixa "Prefer to receive the call?" em EN — resultado de uma iteração anterior).

Objectivo desta ronda: tornar as 4 páginas (galeria + 3 stacks) e os respectivos widgets totalmente bilingues, com deteção automática de idioma + toggle manual. Decisões sobre o lineup de stacks (Retell, Vapi, etc.) e sobre a voz/idioma do Hume ficam para uma ronda seguinte.

## Mecanismo de idioma

### `lib/i18n/lang.ts` (server-only)

- `getLang(): "pt" | "en"`:
  1. Lê o cookie `lang` via `cookies()`. Se for `"pt"` ou `"en"`, devolve-o.
  2. Caso contrário, lê `headers().get("accept-language")`. Se começar por `"pt"`, devolve `"pt"`; senão devolve `"en"` (default para tráfego internacional/Upwork).

Todas as páginas (`app/page.tsx`, `app/hume/page.tsx`, `app/livekit/page.tsx`, `app/elevenlabs/page.tsx`) e o `app/layout.tsx` chamam `getLang()` no topo — já são `force-dynamic`, sem custo extra de build.

### `lib/i18n/dictionaries.ts`

- Exporta `dictionaries: Record<"pt" | "en", Dict>`.
- `Dict` é um tipo TypeScript partilhado — `pt` e `en` têm de implementar exactamente as mesmas chaves (erro de compilação se faltar uma tradução).
- Namespaces: `nav`, `gallery` (incl. `gallery.stacks.{hume,livekit,elevenlabs}`), `hume`, `livekit`, `elevenlabs` (copy de cada página de stack), `widgets.{hume,livekit,elevenlabs,callMe,qrCode}` (copy dos componentes client).

### `components/LanguageToggle.tsx` (novo, client)

- Botão "PT / EN" estilo pill (consistente com os links do `AgentNav`).
- Ao clicar: `document.cookie = "lang=<novo>; path=/; max-age=31536000"` seguido de `router.refresh()`.
- Renderizado dentro do `AgentNav`.

### `app/layout.tsx`

- Continua server component. Chama `getLang()`, passa `lang` e `dict.nav` ao `AgentNav`.

## Padrão de uso

**Páginas** (server components) chamam `getLang()` + `dictionaries[lang]`, usam `dict.<page>.*` para o próprio texto, e passam a fatia relevante de `dict.widgets.*` como prop aos widgets client.

```tsx
const lang = getLang();
const dict = dictionaries[lang];

<Badge>{dict.elevenlabs.badge}</Badge>
<h1>{dict.elevenlabs.title} <span>{dict.elevenlabs.titleHighlight}</span></h1>
<p>{dict.elevenlabs.description}</p>
<ElevenLabsWidget dict={dict.widgets.elevenlabs} />
```

**Widgets** (client components) recebem `dict: Dict["widgets"]["<nome>"]` como prop e substituem todas as strings hardcoded hoje existentes:

- `ElevenLabsWidget`: `"Falar com a Ana — grátis, agora"`, `"A ligar…"`, `"Terminar chamada"`, `"A terminar…"`, `"A Ana está a ouvir…"`, `"Tu: "`, `"Ana: "`, placeholders do input, `"Enviar"`.
- `HumeWidget` / `GeminiLiveWidget`: equivalentes (botão de chamada, estados, labels).
- `CallMeForm` ("Prefer to receive the call?" box em `/hume`): heading, descrição, placeholder, botão.
- `QRCode`: legenda "Aponte a câmara…".

## Normalização do `/hume`

Todas as strings hoje mistas (heading EN "TALK TO AN AI AGENT LIVE, RIGHT NOW", botão PT "Falar com a Ana", caixa EN "Prefer to receive the call?", etc.) são reescritas em `dict.hume` / `dict.widgets.hume` / `dict.widgets.callMe`, com versões pt-PT e EN cada uma internamente coerente.

## Páginas afectadas

- **Novo:** `lib/i18n/lang.ts`, `lib/i18n/dictionaries.ts`, `components/LanguageToggle.tsx`
- **Editado:** `app/layout.tsx`, `app/page.tsx`, `app/hume/page.tsx`, `app/livekit/page.tsx`, `app/elevenlabs/page.tsx`, `components/AgentNav.tsx`, `components/HumeWidget.tsx`, `components/GeminiLiveWidget.tsx`, `components/ElevenLabsWidget.tsx`, `components/CallMeForm.tsx`, `components/QRCode.tsx`

## Fora de escopo (rondas seguintes)

- Lineup de stacks (adicionar Retell, reactivar Vapi, etc. — baseado na procura no Upwork).
- Voz/idioma do agente Hume (`/hume`) — o agente continua a falar pt-PT independentemente do idioma da UI.
- Tradução de conteúdo gerado pelos agentes (transcript em tempo real) — só a UI estática é traduzida.

## Verificação

1. `npx tsc --noEmit` — dicionário `Dict` tipado garante paridade pt/en.
2. `npm run build` — todas as rotas continuam a compilar.
3. Visual (Playwright): `/`, `/hume`, `/livekit`, `/elevenlabs` em pt (cookie/Accept-Language pt) e en — confirmar texto correcto e toggle a funcionar (clique troca idioma e persiste após refresh).
4. `/hume` deixa de ter mistura PT/EN em qualquer um dos dois idiomas.
