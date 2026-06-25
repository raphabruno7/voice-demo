# Handoff — Marketing / Vídeos IA — voice-demo

Data: 2026-06-25. Para retomar numa nova conversa sem reler nada.

---

## Contexto rápido

Portfolio de Raphael Bruno em Upwork. Página pública: `https://voice-demo-navy.vercel.app`  
Branding: **«24/7 Voice Agent»** (white-label — cada cliente Upwork terá o seu agente com nome próprio).  
Idioma dos vídeos: **inglês** (audiência global Upwork — EU + US).  
Formato: **9:16 vertical** (~15–18s, 2 clips Veo de ~8s concatenados).

---

## Ferramenta de geração

**Veo 3.1 Fast** via `GEMINI_API_KEY` (já está nas env vars do projecto Railway `vivacious-expression`).

```
Endpoint: generativelanguage.googleapis.com/v1beta/models/veo-3.1-fast-generate-preview:predictLongRunning?key=$GEMINI_API_KEY
Body: {"instances":[{"prompt":"..."}],"parameters":{"aspectRatio":"9:16","negativePrompt":"..."}}
NÃO passar personGeneration (dá erro 400)
Clips até 8s → poll até done → download do uri com a key
```

**Regra fixa:** NUNCA pedir texto on-screen no prompt Veo — o modelo gera com erros ortográficos/gramaticais.  
Texto, legendas e end-cards: sempre em pós com **PIL + ffmpeg**.

**Custo estimado:** ~$1.80 por clip / ~$3.60 por vídeo completo (2 clips).

---

## Pós-produção (pipeline validado)

```
clip1.mp4 + clip2.mp4
  → ffmpeg concat → the-missed-call.mp4
  → PIL: lower1.png + lower2.png (legendas com fundo semitransparente, tipografia branca)
  → PIL: endcard.png ("24/7 VOICE AGENT" + URL)
  → ffmpeg overlay dos PNGs → the-missed-call-final.mp4
```

Referência: `marketing/the-missed-call/` — ver `script.md` para estrutura de brief.

---

## Decisões aprendidas (não repetir erros)

| Problema | Solução |
|---|---|
| Veo gera texto on-screen errado | Prompts visuais puros; texto só em pós |
| `personGeneration` no body → HTTP 400 | Remover esse campo do body |
| End-card com linha azul a cortar texto | Reposicionar linha como separador em 0.49H |
| Clip 2 com on-screen text indesejado | Regerar com "no text on screen" explícito no prompt |

---

## Vídeo completo — "The Missed Call" ✅

**Ficheiro final:** `marketing/the-missed-call/the-missed-call-final.mp4` (local, git-ignored)  
**Duração:** ~18.5s | **Formato:** 9:16 | **Idioma:** inglês

**Ângulo:** Dor universal do empresário — chamada perdida = cliente perdido.  
**Umbrella message:** *"Every missed call is a lost customer. A 24/7 voice agent answers and books — live."*

| Clip | Cena | Ficheiro |
|---|---|---|
| 1 — "A dor" | Restaurante fechado, chamada entra, ninguém atende, "Missed Call" no ecrã | `clip1.mp4` |
| 2 — "O alívio" | Mesmo restaurante, waveform azul, agente AI atende e agenda | `clip2.mp4` |

Assets versionados no git: `script.md`, `endcard.png`, `lower1.png`, `lower2.png`  
`.mp4` git-ignored (ver `marketing/.gitignore`).

---

## Slate pendente — 3 vídeos por criar

### 2. "The Portfolio"

**Ângulo:** "Vê o demo ao vivo, não um mockup."  
**Público:** Clientes tech que querem ver antes de contratar.  
**Ideia de cena:**
- Clip 1: pessoa no computador, abre o site voice-demo, vê os 6 cards dos provedores
- Clip 2: carrega em "Talk to the agent", waveform aparece, tem uma conversa real

**Copy sugerida:** *"Not a mockup. A live AI agent — 6 providers, pick yours."*

---

### 3. "The Multilingual Customer"

**Ângulo:** Agente muda de língua a meio da chamada.  
**Público:** Empresas EU com clientes em vários países (restaurantes, hotéis, clínicas turísticas).  
**Ideia de cena:**
- Clip 1: cliente começa em inglês, agente responde em inglês; cliente troca para espanhol/francês, agente acompanha sem hesitar
- Clip 2: close no ecrã, agendamento confirmado no calendário

**Copy sugerida:** *"Your customers speak every language. So does your agent."*

---

### 4. "Features Showcase"

**Ângulo:** Corte rápido de 3 capacidades em 15s.  
**Público:** Decisores que querem saber o que o agente faz antes de comprar.  
**Ideia de cena (3 × 5s):**
- Agente atende chamada às 3h da manhã — "Answers 24/7"
- Agendamento aparece no Google Calendar em tempo real — "Books instantly"
- Transfere para humano com contexto — "Escalates when needed"

**Copy sugerida:** *"Answers. Books. Escalates. 24/7."*

---

## Direção de copy por stack (para quando os vídeos forem específicos)

| Stack | Ângulo | Linha |
|---|---|---|
| Hume | Emotion | "Sounds human. Not a robot." |
| Gemini Live | Conversation | "Interrupt it. Switch language. It keeps up." |
| ElevenLabs | Native voice | "A local voice your customers trust." |
| Vapi | Control | "Your stack, your rules — swap any model." |
| Retell | Performance | "Benchmarked, low-latency pipeline." |
| Twilio | Real phone | "A real number. It picks up." |

---

## Como arrancar a próxima sessão

1. Ler este ficheiro
2. Escolher o próximo vídeo (sugestão: "The Multilingual Customer" — diferenciador forte)
3. Escrever o `script.md` na nova pasta `marketing/<nome-do-video>/`
4. Gerar clips com o endpoint Veo acima
5. Pós: PIL legendas + end-card → ffmpeg concat final

**GEMINI_API_KEY** está nas env vars Railway `vivacious-expression` e no `.env.local` do projecto.  
Não commitar a key — usar sempre via env var ou pedir ao Raphael.
