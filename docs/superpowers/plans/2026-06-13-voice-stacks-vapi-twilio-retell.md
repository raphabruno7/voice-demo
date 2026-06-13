# Voice Stacks (Vapi · Retell · Twilio) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new voice-AI demo pages (`/vapi`, `/retell`, `/twilio`) to the portfolio, mirroring the existing `/hume` · `/livekit` · `/elevenlabs` pattern, with all code scaffolded now and real provider credentials wired in later.

**Architecture:** Vapi and Retell are browser WebRTC orchestrators (Web SDK → page + widget + tool endpoint, all on Vercel). Twilio uses ConversationRelay: a TwiML route on Vercel points to a separate persistent WebSocket server in `twilio-agent/` (Node + `ws`, deployed on Railway like `livekit-agent/`). A shared `lib/book-meeting.ts` (extracted from the Hume route) backs all booking tools. Every widget degrades to an "unavailable" state when its keys are absent so `next build` always passes.

**Tech Stack:** Next.js 16 (App Router, force-dynamic), React 19, TypeScript, vitest, Tailwind v4, `@vapi-ai/web`, `retell-client-js-sdk`, `@twilio/voice-sdk`, `twilio`, `ws`, `@anthropic-ai/sdk`.

**Spec:** `docs/superpowers/specs/2026-06-13-voice-stacks-vapi-twilio-retell-design.md`

**Pre-reading for the engineer:**
- `AGENTS.md` — Next.js 16 has breaking changes vs training data; read `node_modules/next/dist/docs/` before writing route/page code.
- Existing patterns to mirror: `app/elevenlabs/page.tsx`, `components/ElevenLabsWidget.tsx`, `components/GeminiLiveWidget.tsx` (transcription), `app/api/book-meeting/route.ts` + `route.test.ts`, `lib/i18n/dictionaries.ts`, `app/page.tsx`, `components/AgentNav.tsx`.
- This plan is **phased**. Phases 0→4 each leave `npm run build` green and are independently shippable. Stop after any phase if needed.

---

## File Structure

**Shared (Phase 0):**
- Create `lib/book-meeting.ts` — `bookMeeting()` shared booking logic.
- Create `lib/book-meeting.test.ts` — unit tests.
- Modify `app/api/book-meeting/route.ts` — call `bookMeeting()`.
- Modify `lib/i18n/dictionaries.ts` — extend `Dict` type + `pt`/`en` with vapi/retell/twilio keys.

**Vapi (Phase 1):**
- Create `app/vapi/page.tsx`, rewrite `components/VapiWidget.tsx`.
- Create `app/api/vapi/book-meeting/route.ts` + `route.test.ts`.
- Create `vapi-agent/system-prompt.txt`.

**Retell (Phase 2):**
- Create `app/retell/page.tsx`, `components/RetellWidget.tsx`.
- Create `app/api/retell/web-call/route.ts`, `app/api/retell/book-meeting/route.ts` + `route.test.ts`.
- Create `retell-agent/system-prompt.txt`.

**Twilio (Phase 3):**
- Create `app/twilio/page.tsx`, `components/TwilioWidget.tsx`.
- Create `app/api/twilio/token/route.ts`, `app/api/twilio/twiml/route.ts`.
- Create `twilio-agent/` (`server.js`, `package.json`, `system-prompt.txt`, `Dockerfile`).

**Wire-up (Phase 4):**
- Modify `components/AgentNav.tsx`, `app/page.tsx`.
- Modify `CLAUDE.md`.

---

## Phase 0 — Shared base

### Task 0.1: Extract `lib/book-meeting.ts` (TDD)

**Files:**
- Create: `lib/book-meeting.ts`
- Test: `lib/book-meeting.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/book-meeting.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/google-calendar', () => ({
  createEvent: vi.fn().mockResolvedValue({
    eventId: 'evt-1', htmlLink: 'https://cal/event', startTime: '2026-05-20T10:00:00',
  }),
}));
vi.mock('@/lib/whatsapp', () => ({ sendWhatsApp: vi.fn().mockResolvedValue(undefined) }));

import { bookMeeting } from './book-meeting';
import { createEvent } from '@/lib/google-calendar';
import { sendWhatsApp } from '@/lib/whatsapp';

const args = { callerName: 'João', callerPhone: '+351 912 345 678', startTime: '2026-05-20T10:00:00' };

describe('bookMeeting', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates the event and returns pt-PT meetingTime', async () => {
    const r = await bookMeeting(args);
    expect(r.success).toBe(true);
    expect(r.meetingTime).toMatch(/\d{1,2}\s+de\s+\w+/);
    expect(vi.mocked(createEvent)).toHaveBeenCalledWith(expect.objectContaining({ callerPhone: '+351 912 345 678' }));
  });

  it('sends a WhatsApp notification', async () => {
    await bookMeeting(args);
    expect(vi.mocked(sendWhatsApp)).toHaveBeenCalledOnce();
  });

  it('still succeeds if WhatsApp fails', async () => {
    vi.mocked(sendWhatsApp).mockRejectedValueOnce(new Error('twilio down'));
    const r = await bookMeeting(args);
    expect(r.success).toBe(true);
  });

  it('returns success:false when createEvent throws', async () => {
    vi.mocked(createEvent).mockRejectedValueOnce(new Error('Calendar down'));
    const r = await bookMeeting(args);
    expect(r.success).toBe(false);
    expect(r.error).toBe('Failed to create calendar event');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run lib/book-meeting.test.ts`
Expected: FAIL — `bookMeeting` not exported / module not found.

- [ ] **Step 3: Write `lib/book-meeting.ts`**

```ts
// lib/book-meeting.ts
import { createEvent } from '@/lib/google-calendar';
import { sendWhatsApp } from '@/lib/whatsapp';

export type BookMeetingArgs = {
  callerName: string;
  callerPhone: string;
  startTime: string;
};

export type BookMeetingResult = {
  success: boolean;
  meetingTime?: string;
  error?: string;
};

export async function bookMeeting(args: BookMeetingArgs): Promise<BookMeetingResult> {
  try {
    await createEvent(args);
    const meetingTime = new Date(args.startTime).toLocaleString('pt-PT', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon',
    });

    // Await so the serverless fn doesn't terminate mid-flight; ~500ms cost.
    try {
      await sendWhatsApp(
        `📅 Novo agendamento via Ana\n\nNome: ${args.callerName}\nTelefone: ${args.callerPhone}\nHora: ${meetingTime}`
      );
    } catch (e) {
      console.error('[bookMeeting] WhatsApp failed:', e);
    }

    return { success: true, meetingTime };
  } catch (err) {
    console.error('[bookMeeting] createEvent failed:', err);
    return { success: false, error: 'Failed to create calendar event' };
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run lib/book-meeting.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/book-meeting.ts lib/book-meeting.test.ts
git commit -m "feat(book-meeting): extract shared bookMeeting() helper"
```

### Task 0.2: Make `/api/book-meeting` use `bookMeeting()`

**Files:**
- Modify: `app/api/book-meeting/route.ts`

- [ ] **Step 1: Run the existing route test (baseline, must stay green)**

Run: `npx vitest run app/api/book-meeting/route.test.ts`
Expected: PASS (8 tests). This is the regression guard.

- [ ] **Step 2: Rewrite the route body to delegate**

Replace the whole file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { bookMeeting } from '@/lib/book-meeting';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-hume-secret');
  if (!secret || secret !== process.env.HUME_TOOL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { callerName, callerPhone, startTime } = body as {
    callerName?: string; callerPhone?: string; startTime?: string;
  };

  if (!callerName || !callerPhone || !startTime) {
    return NextResponse.json(
      { error: 'callerName, callerPhone and startTime are required' },
      { status: 400 }
    );
  }

  const result = await bookMeeting({ callerName, callerPhone, startTime });
  // Return 200 even on failure: Hume treats non-200 as a network error and retries.
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Run the route test again, verify still green**

Run: `npx vitest run app/api/book-meeting/route.test.ts`
Expected: PASS (8 tests, unchanged behaviour).

- [ ] **Step 4: Commit**

```bash
git add app/api/book-meeting/route.ts
git commit -m "refactor(book-meeting): route delegates to shared bookMeeting()"
```

### Task 0.3: Extend the i18n `Dict` type + dictionaries

**Files:**
- Modify: `lib/i18n/dictionaries.ts`

> The widget dict shape is shared across the 3 new demos. Use one reusable inline type per demo widget. Read the file first (`lib/i18n/dictionaries.ts`) to see the exact `pt`/`en` object layout before editing.

- [ ] **Step 1: Extend the `Dict` type**

In `lib/i18n/dictionaries.ts`, add to `Dict.nav` (after `elevenlabs: string;`):

```ts
    vapi: string;
    retell: string;
    twilio: string;
```

Add to `Dict.gallery.stacks` (after the `elevenlabs` line):

```ts
      vapi: { badge: string; title: string; description: string; powered: string };
      retell: { badge: string; title: string; description: string; powered: string };
      twilio: { badge: string; title: string; description: string; powered: string };
```

Add three page-level blocks after the `elevenlabs: { ... }` block (same shape as `elevenlabs`):

```ts
  vapi: {
    badge: string; title: string; titleHighlight: string;
    descBefore: string; descBold: string; descAfter: string;
    powered: string; back: string;
  };
  retell: {
    badge: string; title: string; titleHighlight: string;
    descBefore: string; descBold: string; descAfter: string;
    powered: string; back: string;
  };
  twilio: {
    badge: string; title: string; titleHighlight: string;
    descBefore: string; descBold: string; descAfter: string;
    powered: string; back: string;
    phoneSoon: string; phoneLabel: string;
  };
```

Add to `Dict.widgets` (after the `elevenlabs` widget block):

```ts
    vapi: { callButton: string; ending: string; listening: string; unavailable: string };
    retell: { callButton: string; ending: string; listening: string; unavailable: string };
    twilio: { callButton: string; ending: string; listening: string; unavailable: string };
```

- [ ] **Step 2: Add the `pt` values**

In the `pt` object: `nav.vapi = "Vapi"`, `nav.retell = "Retell"`, `nav.twilio = "Twilio"`.

`gallery.stacks`:
```ts
      vapi: {
        badge: "Pipeline · Vapi",
        title: "Vapi",
        description: "Orquestrador de voz no browser — Claude a pensar, voz portuguesa da ElevenLabs a falar.",
        powered: "Vapi · Claude Sonnet 4 · ElevenLabs",
      },
      retell: {
        badge: "Pipeline · Retell",
        title: "Retell AI",
        description: "Outro orquestrador de pipeline no browser, para comparar fluxo e latência.",
        powered: "Retell · Gemini · ElevenLabs",
      },
      twilio: {
        badge: "Telefonia · Twilio",
        title: "Twilio",
        description: "ConversationRelay nativo — a Ana atende e liga por telefone a sério.",
        powered: "Twilio ConversationRelay · Claude · ElevenLabs",
      },
```

Page blocks (pt):
```ts
  vapi: {
    badge: "Pipeline · Vapi", title: "FALA COM A", titleHighlight: "ANA",
    descBefore: "Esta demo usa o", descBold: "Vapi", descAfter: "a orquestrar Claude e voz portuguesa em tempo real.",
    powered: "Vapi · Claude Sonnet 4 · ElevenLabs (voz Marta, pt-PT)", back: "← Portfólio",
  },
  retell: {
    badge: "Pipeline · Retell", title: "FALA COM A", titleHighlight: "ANA",
    descBefore: "Esta demo usa o", descBold: "Retell AI", descAfter: "para comparar outro orquestrador de pipeline.",
    powered: "Retell · Gemini · ElevenLabs (voz Marta, pt-PT)", back: "← Portfólio",
  },
  twilio: {
    badge: "Telefonia · Twilio", title: "LIGA À", titleHighlight: "ANA",
    descBefore: "Esta demo usa o", descBold: "Twilio ConversationRelay", descAfter: "para chamadas de telefone reais.",
    powered: "Twilio ConversationRelay · Claude · ElevenLabs", back: "← Portfólio",
    phoneSoon: "Número em breve", phoneLabel: "Ou liga para:",
  },
```

Widget blocks (pt), inside `widgets`:
```ts
    vapi: { callButton: "Falar com a Ana", ending: "A terminar…", listening: "A Ana está a ouvir…", unavailable: "Indisponível — em breve" },
    retell: { callButton: "Falar com a Ana", ending: "A terminar…", listening: "A Ana está a ouvir…", unavailable: "Indisponível — em breve" },
    twilio: { callButton: "Ligar à Ana", ending: "A terminar…", listening: "A Ana está a ouvir…", unavailable: "Indisponível — em breve" },
```

- [ ] **Step 3: Add the `en` values**

In the `en` object, mirror the same keys in English:

`nav`: `vapi: "Vapi"`, `retell: "Retell"`, `twilio: "Twilio"`.

```ts
      vapi: { badge: "Pipeline · Vapi", title: "Vapi", description: "Browser voice orchestrator — Claude thinking, ElevenLabs Portuguese voice speaking.", powered: "Vapi · Claude Sonnet 4 · ElevenLabs" },
      retell: { badge: "Pipeline · Retell", title: "Retell AI", description: "Another browser pipeline orchestrator, to compare flow and latency.", powered: "Retell · Gemini · ElevenLabs" },
      twilio: { badge: "Telephony · Twilio", title: "Twilio", description: "Native ConversationRelay — Ana answers and dials over a real phone line.", powered: "Twilio ConversationRelay · Claude · ElevenLabs" },
```
```ts
  vapi: { badge: "Pipeline · Vapi", title: "TALK TO", titleHighlight: "ANA", descBefore: "This demo uses", descBold: "Vapi", descAfter: "to orchestrate Claude and a Portuguese voice in real time.", powered: "Vapi · Claude Sonnet 4 · ElevenLabs (Marta voice, pt-PT)", back: "← Portfolio" },
  retell: { badge: "Pipeline · Retell", title: "TALK TO", titleHighlight: "ANA", descBefore: "This demo uses", descBold: "Retell AI", descAfter: "to compare another pipeline orchestrator.", powered: "Retell · Gemini · ElevenLabs (Marta voice, pt-PT)", back: "← Portfolio" },
  twilio: { badge: "Telephony · Twilio", title: "CALL", titleHighlight: "ANA", descBefore: "This demo uses", descBold: "Twilio ConversationRelay", descAfter: "for real phone calls.", powered: "Twilio ConversationRelay · Claude · ElevenLabs", back: "← Portfolio", phoneSoon: "Number coming soon", phoneLabel: "Or call:" },
```
```ts
    vapi: { callButton: "Talk to Ana", ending: "Ending…", listening: "Ana is listening…", unavailable: "Unavailable — coming soon" },
    retell: { callButton: "Talk to Ana", ending: "Ending…", listening: "Ana is listening…", unavailable: "Unavailable — coming soon" },
    twilio: { callButton: "Call Ana", ending: "Ending…", listening: "Ana is listening…", unavailable: "Unavailable — coming soon" },
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds. (Nav/gallery don't reference the new keys yet — that's Phase 4 — so nothing renders them, but the types must compile.)

- [ ] **Step 5: Commit**

```bash
git add lib/i18n/dictionaries.ts
git commit -m "feat(i18n): add vapi/retell/twilio dictionary keys (pt + en)"
```

---

## Phase 1 — Vapi demo

### Task 1.1: `vapi-agent/system-prompt.txt`

**Files:**
- Create: `vapi-agent/system-prompt.txt`

- [ ] **Step 1: Create the prompt**

Copy `elevenlabs-agent/system-prompt.txt` verbatim into `vapi-agent/system-prompt.txt` (same pt-PT register, same `book_meeting` flow, already includes the "sem perguntas sociais recíprocas" rule). This file is versioned reference; the live prompt lives in the Vapi assistant config.

Run: `cp elevenlabs-agent/system-prompt.txt vapi-agent/system-prompt.txt` then verify the rule is present:
Run: `grep -c "perguntas sociais recíprocas" vapi-agent/system-prompt.txt`
Expected: `1`

- [ ] **Step 2: Commit**

```bash
git add vapi-agent/system-prompt.txt
git commit -m "feat(vapi): add versioned pt-PT system prompt"
```

### Task 1.2: `/api/vapi/book-meeting` route (TDD)

**Files:**
- Create: `app/api/vapi/book-meeting/route.ts`
- Test: `app/api/vapi/book-meeting/route.test.ts`

> Vapi sends tool calls in `message.toolCallList[]` (newer) — each item `{ id, function: { name, arguments } }` where `arguments` may be a JSON string or object. Response must be `{ results: [{ toolCallId, result }] }`.

- [ ] **Step 1: Write the failing test**

```ts
// app/api/vapi/book-meeting/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/book-meeting', () => ({
  bookMeeting: vi.fn().mockResolvedValue({ success: true, meetingTime: '20 de maio, às 10:00' }),
}));

import { POST } from './route';
import { bookMeeting } from '@/lib/book-meeting';

function makeReq(body: object, secret = 'vapi-secret') {
  return new NextRequest('http://localhost/api/vapi/book-meeting', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-vapi-secret': secret },
    body: JSON.stringify(body),
  });
}

const toolCallBody = {
  message: {
    toolCallList: [
      { id: 'call-1', function: { name: 'book_meeting', arguments: { callerName: 'João', callerPhone: '+351 912 345 678', startTime: '2026-05-20T10:00:00' } } },
    ],
  },
};

describe('POST /api/vapi/book-meeting', () => {
  beforeEach(() => { process.env.VAPI_WEBHOOK_SECRET = 'vapi-secret'; vi.clearAllMocks(); });

  it('401 on wrong secret', async () => {
    const res = await POST(makeReq(toolCallBody, 'nope'));
    expect(res.status).toBe(401);
  });

  it('books and returns results array with toolCallId', async () => {
    const res = await POST(makeReq(toolCallBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results[0].toolCallId).toBe('call-1');
    expect(data.results[0].result).toContain('20 de maio');
    expect(vi.mocked(bookMeeting)).toHaveBeenCalledWith(
      expect.objectContaining({ callerPhone: '+351 912 345 678' })
    );
  });

  it('parses arguments when sent as a JSON string', async () => {
    const body = { message: { toolCallList: [
      { id: 'call-2', function: { name: 'book_meeting', arguments: JSON.stringify({ callerName: 'Ana', callerPhone: '+351 911', startTime: '2026-05-21T15:00:00' }) } },
    ] } };
    const res = await POST(makeReq(body));
    const data = await res.json();
    expect(data.results[0].toolCallId).toBe('call-2');
  });

  it('returns a fallback result string when booking fails', async () => {
    vi.mocked(bookMeeting).mockResolvedValueOnce({ success: false, error: 'Failed to create calendar event' });
    const res = await POST(makeReq(toolCallBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results[0].result).toContain('Não consegui');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run app/api/vapi/book-meeting/route.test.ts`
Expected: FAIL — route not found.

- [ ] **Step 3: Implement the route**

```ts
// app/api/vapi/book-meeting/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { bookMeeting } from '@/lib/book-meeting';

type VapiToolCall = { id: string; function: { name: string; arguments: unknown } };

function parseArgs(raw: unknown): { callerName?: string; callerPhone?: string; startTime?: string } {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return (raw as Record<string, string>) ?? {};
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-vapi-secret');
  if (!secret || secret !== process.env.VAPI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const calls: VapiToolCall[] = body?.message?.toolCallList ?? body?.message?.toolCalls ?? [];

  const results = await Promise.all(
    calls.map(async (call) => {
      const { callerName, callerPhone, startTime } = parseArgs(call.function?.arguments);
      if (!callerName || !callerPhone || !startTime) {
        return { toolCallId: call.id, result: 'Faltam dados para marcar. Pede nome, telefone e hora.' };
      }
      const r = await bookMeeting({ callerName, callerPhone, startTime });
      return {
        toolCallId: call.id,
        result: r.success
          ? `Ficou marcado para ${r.meetingTime}. O Raphael fala contigo em breve.`
          : 'Não consegui criar o evento agora. O Raphael contacta-te directamente.',
      };
    })
  );

  return NextResponse.json({ results });
}
```

Note: the fallback string is `'Não consegui criar o evento agora. O Raphael contacta-te directamente.'` — the Step 1 test asserts `toContain('Não consegui')`, which matches.

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run app/api/vapi/book-meeting/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/vapi/book-meeting/route.ts app/api/vapi/book-meeting/route.test.ts
git commit -m "feat(vapi): book_meeting tool endpoint"
```

### Task 1.3: Rewrite `components/VapiWidget.tsx`

**Files:**
- Modify: `components/VapiWidget.tsx`

> Mirror `components/ElevenLabsWidget.tsx` structure (states, transcript box). Vapi message events: `vapi.on("message", m)` where transcripts are `m.type === "transcript" && m.transcriptType === "final"`, `m.role` is `"user"|"assistant"`, `m.transcript` is the text. Theme = **sky**.

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";
import type { Dict } from "@/lib/i18n/dictionaries";

type CallState = "idle" | "connecting" | "active" | "ending";
type TranscriptEntry = { role: "user" | "agent"; text: string };

type VapiDict = { common: Dict["widgets"]["common"]; vapi: Dict["widgets"]["vapi"] };

export default function VapiWidget({ dict }: { dict: VapiDict }) {
  const vapiRef = useRef<Vapi | null>(null);
  const [state, setState] = useState<CallState>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
  const configured = Boolean(publicKey && assistantId);

  useEffect(() => {
    if (!configured) return;
    const vapi = new Vapi(publicKey!);
    vapiRef.current = vapi;

    vapi.on("call-start", () => setState("active"));
    vapi.on("call-end", () => { setState("idle"); setIsSpeaking(false); });
    vapi.on("speech-start", () => setIsSpeaking(true));
    vapi.on("speech-end", () => setIsSpeaking(false));
    vapi.on("message", (m: { type?: string; transcriptType?: string; role?: string; transcript?: string }) => {
      if (m.type === "transcript" && m.transcriptType === "final" && m.transcript) {
        setTranscript((prev) => [...prev, { role: m.role === "user" ? "user" : "agent", text: m.transcript! }]);
      }
    });

    return () => { vapi.stop(); };
  }, [configured, publicKey]);

  async function handleClick() {
    if (!vapiRef.current) return;
    if (state === "active" || state === "ending") {
      setState("ending");
      vapiRef.current.stop();
    } else if (state === "idle") {
      setState("connecting");
      setTranscript([]);
      await vapiRef.current.start(assistantId!);
    }
  }

  const label =
    !configured ? dict.vapi.unavailable :
    state === "idle" ? dict.vapi.callButton :
    state === "connecting" ? dict.common.connecting :
    state === "active" ? dict.common.endCall : dict.vapi.ending;

  const isActive = state === "active";
  const isLoading = state === "connecting" || state === "ending";

  return (
    <div className="mt-8 flex flex-col items-center gap-3 w-full">
      <button
        onClick={handleClick}
        disabled={!configured || isLoading}
        className={[
          "relative px-8 py-4 rounded-full font-semibold text-base transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950",
          isActive
            ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 focus:ring-red-500"
            : "bg-sky-500 text-zinc-950 hover:bg-sky-400 focus:ring-sky-500",
          !configured || isLoading ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        {isActive && <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />}
        <span className="relative flex items-center gap-2">
          {isActive ? (
            <span className={`w-2 h-2 rounded-full ${isSpeaking ? "bg-red-400 animate-pulse" : "bg-red-400"}`} />
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          )}
          {label}
        </span>
      </button>
      {isActive && <p className="text-xs text-zinc-500 animate-pulse">{dict.vapi.listening}</p>}

      {transcript.length > 0 && (
        <div className="mt-2 w-full max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3 text-left text-sm space-y-2">
          {transcript.map((entry, i) => (
            <p key={i} className={entry.role === "user" ? "text-zinc-200" : "text-sky-300"}>
              <span className="font-semibold">{entry.role === "user" ? `${dict.common.you}: ` : `${dict.common.agentName}: `}</span>
              {entry.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/VapiWidget.tsx
git commit -m "feat(vapi): rewrite widget with i18n, sky theme, transcription, key guard"
```

### Task 1.4: `app/vapi/page.tsx`

**Files:**
- Create: `app/vapi/page.tsx`

- [ ] **Step 1: Create the page**

Mirror `app/elevenlabs/page.tsx` exactly, swapping: import `VapiWidget`, use `dict.vapi`, sky badge, and pass `dict={{ common: dict.widgets.common, vapi: dict.widgets.vapi }}`.

```tsx
export const dynamic = "force-dynamic";

import { Badge } from "@/components/ui/badge";
import VapiWidget from "@/components/VapiWidget";
import { getLang } from "@/lib/i18n/lang";
import { dictionaries } from "@/lib/i18n/dictionaries";

export default async function VapiPage() {
  const lang = await getLang();
  const dict = dictionaries[lang];

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full text-center">
        <Badge variant="outline" className="border-sky-500/40 text-sky-400 bg-sky-500/10 mb-6">
          {dict.vapi.badge}
        </Badge>

        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight uppercase tracking-wide">
          {dict.vapi.title} <span className="text-sky-400">{dict.vapi.titleHighlight}</span>
        </h1>

        <p className="mt-4 text-zinc-400 text-lg leading-relaxed">
          {dict.vapi.descBefore} <strong className="text-white">{dict.vapi.descBold}</strong> {dict.vapi.descAfter}
        </p>

        <p className="mt-4 text-zinc-500 text-sm">{dict.vapi.powered}</p>

        <VapiWidget dict={{ common: dict.widgets.common, vapi: dict.widgets.vapi }} />

        <div className="mt-16 border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-zinc-500">
          <a href="/" className="hover:text-zinc-300 transition-colors">{dict.vapi.back}</a>
          <span className="hidden sm:inline">·</span>
          <a href="mailto:work@raphaelbruno.dev" className="hover:text-zinc-300 transition-colors">work@raphaelbruno.dev</a>
          <span className="hidden sm:inline">·</span>
          <a href="https://upwork.com/freelancers/raphabruno7" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">Upwork</a>
          <span className="hidden sm:inline">·</span>
          <a href="https://linkedin.com/in/raphabruno7" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">LinkedIn</a>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: success; `/vapi` appears in the route list.

- [ ] **Step 3: Verify render (manual)**

Run: dev server already on :3000 (`/tmp/voice-demo-dev.log`). Open `http://localhost:3000/vapi`.
Expected: page renders, button shows "Indisponível — em breve" (no Vapi keys yet), footer correct, no console crash.

- [ ] **Step 4: Commit**

```bash
git add app/vapi/page.tsx
git commit -m "feat(vapi): add /vapi demo page"
```

---

## Phase 2 — Retell demo

### Task 2.1: Install SDK + read its API

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install**

Run: `npm install retell-client-js-sdk`
Expected: added to dependencies.

- [ ] **Step 2: Read the actual client API before coding**

Run: `cat node_modules/retell-client-js-sdk/dist/index.d.ts` (or the package's types entry).
Confirm the exact symbols: `RetellWebClient`, `startCall({ accessToken })`, and event names (`call_started`, `call_ended`, `update`, `agent_start_talking`, `agent_stop_talking`). If names differ in the installed version, use the installed names in Task 2.3 (do not guess from this plan).

- [ ] **Step 3: Commit the lockfile**

```bash
git add package.json package-lock.json
git commit -m "chore(retell): add retell-client-js-sdk"
```

### Task 2.2: `/api/retell/web-call` + `/api/retell/book-meeting` (TDD on book-meeting)

**Files:**
- Create: `app/api/retell/web-call/route.ts`
- Create: `app/api/retell/book-meeting/route.ts`
- Test: `app/api/retell/book-meeting/route.test.ts`

- [ ] **Step 1: Write the web-call route (no test — thin proxy)**

```ts
// app/api/retell/web-call/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  const apiKey = process.env.RETELL_API_KEY;
  const agentId = process.env.RETELL_AGENT_ID;
  if (!apiKey || !agentId) {
    return NextResponse.json({ error: 'Retell not configured' }, { status: 503 });
  }

  const res = await fetch('https://api.retellai.com/v2/create-web-call', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }
  const data = await res.json();
  return NextResponse.json({ accessToken: data.access_token });
}
```

- [ ] **Step 2: Write the failing book-meeting test**

```ts
// app/api/retell/book-meeting/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/book-meeting', () => ({
  bookMeeting: vi.fn().mockResolvedValue({ success: true, meetingTime: '20 de maio, às 10:00' }),
}));

import { POST } from './route';
import { bookMeeting } from '@/lib/book-meeting';

function makeReq(body: object, secret = 'retell-secret') {
  return new NextRequest('http://localhost/api/retell/book-meeting', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-retell-secret': secret },
    body: JSON.stringify(body),
  });
}

// Retell custom-function call payload (args nested under `args`).
const body = { call: { call_id: 'c1' }, name: 'book_meeting', args: { callerName: 'João', callerPhone: '+351 912 345 678', startTime: '2026-05-20T10:00:00' } };

describe('POST /api/retell/book-meeting', () => {
  beforeEach(() => { process.env.RETELL_WEBHOOK_SECRET = 'retell-secret'; vi.clearAllMocks(); });

  it('401 on wrong secret', async () => {
    const res = await POST(makeReq(body, 'nope'));
    expect(res.status).toBe(401);
  });

  it('books and returns a result string', async () => {
    const res = await POST(makeReq(body));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toContain('20 de maio');
    expect(vi.mocked(bookMeeting)).toHaveBeenCalledWith(expect.objectContaining({ callerPhone: '+351 912 345 678' }));
  });

  it('fallback string when booking fails', async () => {
    vi.mocked(bookMeeting).mockResolvedValueOnce({ success: false, error: 'x' });
    const res = await POST(makeReq(body));
    const data = await res.json();
    expect(data.result).toContain('Não consegui');
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx vitest run app/api/retell/book-meeting/route.test.ts`
Expected: FAIL — route not found.

- [ ] **Step 4: Implement the book-meeting route**

```ts
// app/api/retell/book-meeting/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { bookMeeting } from '@/lib/book-meeting';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-retell-secret');
  if (!secret || secret !== process.env.RETELL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const args = (body?.args ?? {}) as { callerName?: string; callerPhone?: string; startTime?: string };
  const { callerName, callerPhone, startTime } = args;

  if (!callerName || !callerPhone || !startTime) {
    return NextResponse.json({ result: 'Faltam dados para marcar. Pede nome, telefone e hora.' });
  }

  const r = await bookMeeting({ callerName, callerPhone, startTime });
  return NextResponse.json({
    result: r.success
      ? `Ficou marcado para ${r.meetingTime}. O Raphael fala contigo em breve.`
      : 'Não consegui criar o evento agora. O Raphael contacta-te directamente.',
  });
}
```

> Verify the real Retell custom-function payload shape (`body.args` vs `body.arguments`) against Retell docs when wiring the live agent; adjust the one-line accessor if needed. Tests pin the current assumption.

- [ ] **Step 5: Run test, verify it passes**

Run: `npx vitest run app/api/retell/book-meeting/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add app/api/retell/
git commit -m "feat(retell): web-call + book_meeting endpoints"
```

### Task 2.3: `retell-agent/system-prompt.txt` + `components/RetellWidget.tsx` + `app/retell/page.tsx`

**Files:**
- Create: `retell-agent/system-prompt.txt`
- Create: `components/RetellWidget.tsx`
- Create: `app/retell/page.tsx`

- [ ] **Step 1: System prompt**

Run: `cp elevenlabs-agent/system-prompt.txt retell-agent/system-prompt.txt`
Run: `grep -c "perguntas sociais recíprocas" retell-agent/system-prompt.txt` → expect `1`.

- [ ] **Step 2: Create `components/RetellWidget.tsx`**

Use the installed SDK symbols confirmed in Task 2.1 Step 2. Theme = **fuchsia**.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import type { Dict } from "@/lib/i18n/dictionaries";

type CallState = "idle" | "connecting" | "active" | "ending";
type TranscriptEntry = { role: "user" | "agent"; text: string };
type RetellDict = { common: Dict["widgets"]["common"]; retell: Dict["widgets"]["retell"] };

export default function RetellWidget({ dict }: { dict: RetellDict }) {
  const clientRef = useRef<RetellWebClient | null>(null);
  const [state, setState] = useState<CallState>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const client = new RetellWebClient();
    clientRef.current = client;
    client.on("call_started", () => setState("active"));
    client.on("call_ended", () => { setState("idle"); setIsSpeaking(false); });
    client.on("agent_start_talking", () => setIsSpeaking(true));
    client.on("agent_stop_talking", () => setIsSpeaking(false));
    client.on("update", (u: { transcript?: { role: string; content: string }[] }) => {
      if (!u.transcript?.length) return;
      setTranscript(u.transcript.map((t) => ({ role: t.role === "user" ? "user" : "agent", text: t.content })));
    });
    return () => { client.stopCall(); };
  }, []);

  async function handleClick() {
    const client = clientRef.current;
    if (!client) return;
    if (state === "active" || state === "ending") {
      setState("ending"); client.stopCall(); return;
    }
    if (state === "idle") {
      setState("connecting"); setTranscript([]);
      try {
        const res = await fetch("/api/retell/web-call", { method: "POST" });
        if (!res.ok) { setAvailable(false); setState("idle"); return; }
        const { accessToken } = await res.json();
        await client.startCall({ accessToken });
      } catch { setAvailable(false); setState("idle"); }
    }
  }

  const label =
    !available ? dict.retell.unavailable :
    state === "idle" ? dict.retell.callButton :
    state === "connecting" ? dict.common.connecting :
    state === "active" ? dict.common.endCall : dict.retell.ending;

  const isActive = state === "active";
  const isLoading = state === "connecting" || state === "ending";

  return (
    <div className="mt-8 flex flex-col items-center gap-3 w-full">
      <button
        onClick={handleClick}
        disabled={!available || isLoading}
        className={[
          "relative px-8 py-4 rounded-full font-semibold text-base transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950",
          isActive
            ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 focus:ring-red-500"
            : "bg-fuchsia-500 text-zinc-950 hover:bg-fuchsia-400 focus:ring-fuchsia-500",
          !available || isLoading ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        {isActive && <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />}
        <span className="relative flex items-center gap-2">
          {isActive ? (
            <span className={`w-2 h-2 rounded-full ${isSpeaking ? "bg-red-400 animate-pulse" : "bg-red-400"}`} />
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          )}
          {label}
        </span>
      </button>
      {isActive && <p className="text-xs text-zinc-500 animate-pulse">{dict.retell.listening}</p>}

      {transcript.length > 0 && (
        <div className="mt-2 w-full max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3 text-left text-sm space-y-2">
          {transcript.map((entry, i) => (
            <p key={i} className={entry.role === "user" ? "text-zinc-200" : "text-fuchsia-300"}>
              <span className="font-semibold">{entry.role === "user" ? `${dict.common.you}: ` : `${dict.common.agentName}: `}</span>
              {entry.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `app/retell/page.tsx`**

Copy `app/vapi/page.tsx`, swap: `RetellWidget`, `dict.retell`, fuchsia badge classes (`border-fuchsia-500/40 text-fuchsia-400 bg-fuchsia-500/10`, highlight `text-fuchsia-400`), pass `dict={{ common: dict.widgets.common, retell: dict.widgets.retell }}`.

- [ ] **Step 4: Typecheck + build + verify**

Run: `npx tsc --noEmit && npm run build`
Expected: success; `/retell` in route list. Open `http://localhost:3000/retell` → button shows "Indisponível" (web-call returns 503 without keys).

- [ ] **Step 5: Commit**

```bash
git add retell-agent/ components/RetellWidget.tsx app/retell/page.tsx
git commit -m "feat(retell): system prompt, widget (fuchsia), and /retell page"
```

---

## Phase 3 — Twilio demo

### Task 3.1: Install deps + read APIs

- [ ] **Step 1: Install browser + server SDKs**

Run: `npm install @twilio/voice-sdk twilio`
Expected: both added.

- [ ] **Step 2: Read the actual APIs**

Run: `cat node_modules/@twilio/voice-sdk/dist/twilio.d.ts | head -80` — confirm `Device` import and `device.connect()` signature.
For TwiML/token server helpers, confirm `twilio.jwt.AccessToken` + `AccessToken.VoiceGrant` exist in `node_modules/twilio`. Use installed signatures in Tasks 3.2–3.3.

- [ ] **Step 3: Commit lockfile**

```bash
git add package.json package-lock.json
git commit -m "chore(twilio): add @twilio/voice-sdk and twilio"
```

### Task 3.2: `/api/twilio/token` + `/api/twilio/twiml`

**Files:**
- Create: `app/api/twilio/token/route.ts`
- Create: `app/api/twilio/twiml/route.ts`

- [ ] **Step 1: Token route**

```ts
// app/api/twilio/token/route.ts
import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST() {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET || !TWILIO_TWIML_APP_SID) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 503 });
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const token = new AccessToken(TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, { identity: 'web-visitor' });
  token.addGrant(new VoiceGrant({ outgoingApplicationSid: TWILIO_TWIML_APP_SID, incomingAllow: false }));

  return NextResponse.json({ token: token.toJwt() });
}
```

- [ ] **Step 2: TwiML route**

```ts
// app/api/twilio/twiml/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  const relay = process.env.TWILIO_AGENT_WSS_URL;
  if (!relay) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="pt-PT">A demonstração ainda não está disponível. Volta em breve.</Say></Response>`,
      { headers: { 'content-type': 'text/xml' } }
    );
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><ConversationRelay url="${relay}" ttsProvider="ElevenLabs" voice="bBNhdwrIjl4fcVYiRbT2" language="pt-PT" /></Connect></Response>`;
  return new NextResponse(xml, { headers: { 'content-type': 'text/xml' } });
}
```

> Twilio signature validation (`x-twilio-signature`) is recommended for the TwiML route in production; add it when the live number/URL exist (needs the public URL + `TWILIO_AUTH_TOKEN`). Phase 3 ships without it since there is no live caller yet.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success; both routes registered.

- [ ] **Step 4: Commit**

```bash
git add app/api/twilio/token/route.ts app/api/twilio/twiml/route.ts
git commit -m "feat(twilio): access-token and ConversationRelay TwiML routes"
```

### Task 3.3: `components/TwilioWidget.tsx` + `app/twilio/page.tsx`

**Files:**
- Create: `components/TwilioWidget.tsx`
- Create: `app/twilio/page.tsx`

- [ ] **Step 1: Widget (theme rose; state only, no browser transcript in phase 1)**

```tsx
"use client";

import { useRef, useState } from "react";
import { Device } from "@twilio/voice-sdk";
import type { Dict } from "@/lib/i18n/dictionaries";

type CallState = "idle" | "connecting" | "active" | "ending";
type TwilioDict = { common: Dict["widgets"]["common"]; twilio: Dict["widgets"]["twilio"] };

export default function TwilioWidget({ dict }: { dict: TwilioDict }) {
  const deviceRef = useRef<Device | null>(null);
  const [state, setState] = useState<CallState>("idle");
  const [available, setAvailable] = useState(true);

  async function handleClick() {
    if (state === "active" || state === "ending") {
      setState("ending");
      deviceRef.current?.disconnectAll();
      setState("idle");
      return;
    }
    if (state !== "idle") return;
    setState("connecting");
    try {
      const res = await fetch("/api/twilio/token", { method: "POST" });
      if (!res.ok) { setAvailable(false); setState("idle"); return; }
      const { token } = await res.json();
      const device = new Device(token);
      deviceRef.current = device;
      const call = await device.connect();
      call.on("accept", () => setState("active"));
      call.on("disconnect", () => setState("idle"));
    } catch { setAvailable(false); setState("idle"); }
  }

  const label =
    !available ? dict.twilio.unavailable :
    state === "idle" ? dict.twilio.callButton :
    state === "connecting" ? dict.common.connecting :
    state === "active" ? dict.common.endCall : dict.twilio.ending;

  const isActive = state === "active";
  const isLoading = state === "connecting" || state === "ending";

  return (
    <div className="mt-8 flex flex-col items-center gap-3 w-full">
      <button
        onClick={handleClick}
        disabled={!available || isLoading}
        className={[
          "relative px-8 py-4 rounded-full font-semibold text-base transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950",
          isActive
            ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 focus:ring-red-500"
            : "bg-rose-500 text-zinc-950 hover:bg-rose-400 focus:ring-rose-500",
          !available || isLoading ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        {isActive && <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />}
        <span className="relative flex items-center gap-2">
          {isActive ? (
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          )}
          {label}
        </span>
      </button>
      {isActive && <p className="text-xs text-zinc-500 animate-pulse">{dict.twilio.listening}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Page (browser button + phone number block)**

```tsx
export const dynamic = "force-dynamic";

import { Badge } from "@/components/ui/badge";
import TwilioWidget from "@/components/TwilioWidget";
import { getLang } from "@/lib/i18n/lang";
import { dictionaries } from "@/lib/i18n/dictionaries";

export default async function TwilioPage() {
  const lang = await getLang();
  const dict = dictionaries[lang];
  const phone = process.env.NEXT_PUBLIC_TWILIO_NUMBER;

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full text-center">
        <Badge variant="outline" className="border-rose-500/40 text-rose-400 bg-rose-500/10 mb-6">
          {dict.twilio.badge}
        </Badge>

        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight uppercase tracking-wide">
          {dict.twilio.title} <span className="text-rose-400">{dict.twilio.titleHighlight}</span>
        </h1>

        <p className="mt-4 text-zinc-400 text-lg leading-relaxed">
          {dict.twilio.descBefore} <strong className="text-white">{dict.twilio.descBold}</strong> {dict.twilio.descAfter}
        </p>

        <p className="mt-4 text-zinc-500 text-sm">{dict.twilio.powered}</p>

        <TwilioWidget dict={{ common: dict.widgets.common, twilio: dict.widgets.twilio }} />

        <p className="mt-6 text-sm text-zinc-500">
          {dict.twilio.phoneLabel}{" "}
          <span className="text-rose-300 font-semibold">{phone ?? dict.twilio.phoneSoon}</span>
        </p>

        <div className="mt-16 border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-zinc-500">
          <a href="/" className="hover:text-zinc-300 transition-colors">{dict.twilio.back}</a>
          <span className="hidden sm:inline">·</span>
          <a href="mailto:work@raphaelbruno.dev" className="hover:text-zinc-300 transition-colors">work@raphaelbruno.dev</a>
          <span className="hidden sm:inline">·</span>
          <a href="https://upwork.com/freelancers/raphabruno7" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">Upwork</a>
          <span className="hidden sm:inline">·</span>
          <a href="https://linkedin.com/in/raphabruno7" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">LinkedIn</a>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + build + verify**

Run: `npx tsc --noEmit && npm run build`
Expected: success; `/twilio` in route list. Open `http://localhost:3000/twilio` → button "Indisponível", phone shows "Número em breve".

- [ ] **Step 4: Commit**

```bash
git add components/TwilioWidget.tsx app/twilio/page.tsx
git commit -m "feat(twilio): widget (rose) + /twilio page with phone block"
```

### Task 3.4: `twilio-agent/` ConversationRelay WebSocket server

**Files:**
- Create: `twilio-agent/server.js`
- Create: `twilio-agent/package.json`
- Create: `twilio-agent/system-prompt.txt`
- Create: `twilio-agent/Dockerfile`
- Create: `twilio-agent/.gitignore`

> This is a standalone Node service (not built by Next). It is deployed separately (Railway/local), exactly like `livekit-agent/`. ConversationRelay protocol: Twilio connects via WS and sends JSON messages with `type` of `setup`, `prompt` (with `voicePrompt` = transcribed user text), `interrupt`, etc. The server replies with `{ type: "text", token: "...", last: true|false }` messages that Twilio synthesizes. Confirm the message field names against Twilio's ConversationRelay docs before going live (they are stable but version-sensitive).

- [ ] **Step 1: `twilio-agent/package.json`**

```json
{
  "name": "twilio-agent",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": { "start": "node server.js" },
  "dependencies": {
    "ws": "^8.18.0",
    "@anthropic-ai/sdk": "^0.32.1"
  }
}
```

- [ ] **Step 2: `twilio-agent/system-prompt.txt`**

Run: `cp ../voice-demo/elevenlabs-agent/system-prompt.txt twilio-agent/system-prompt.txt` — or from repo root: `cp elevenlabs-agent/system-prompt.txt twilio-agent/system-prompt.txt`.
Verify: `grep -c "perguntas sociais recíprocas" twilio-agent/system-prompt.txt` → `1`.

- [ ] **Step 3: `twilio-agent/server.js`**

```js
import { WebSocketServer } from "ws";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT = readFileSync(join(__dirname, "system-prompt.txt"), "utf8");
const PORT = process.env.PORT || 8080;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const wss = new WebSocketServer({ port: PORT });
console.log(`[twilio-agent] ConversationRelay WS listening on :${PORT}`);

wss.on("connection", (ws) => {
  const history = [];

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "setup") {
      // Greet first (Twilio plays this via TTS).
      ws.send(JSON.stringify({ type: "text", token: "Olá, fala a Ana. Como te posso ajudar?", last: true }));
      return;
    }

    if (msg.type === "prompt") {
      const userText = msg.voicePrompt ?? "";
      if (!userText) return;
      history.push({ role: "user", content: userText });

      try {
        const stream = await anthropic.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          temperature: 0.2,
          system: SYSTEM_PROMPT,
          messages: history,
        });

        let full = "";
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            full += event.delta.text;
            ws.send(JSON.stringify({ type: "text", token: event.delta.text, last: false }));
          }
        }
        ws.send(JSON.stringify({ type: "text", token: "", last: true }));
        history.push({ role: "assistant", content: full });
      } catch (e) {
        console.error("[twilio-agent] LLM error:", e);
        ws.send(JSON.stringify({ type: "text", token: "Desculpa, tive um problema técnico.", last: true }));
      }
    }
  });

  ws.on("close", () => console.log("[twilio-agent] connection closed"));
});
```

> `book_meeting` from the phone agent: phase 1 omits tool-calling in the relay (keeps the server minimal and shippable). When wiring the live number, extend `server.js` to declare the `book_meeting` tool to Claude and POST to `<site>/api/book-meeting` with `x-hume-secret`. Tracked in CLAUDE.md pendentes (Task 4.2).

- [ ] **Step 4: `twilio-agent/Dockerfile`**

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]
```

- [ ] **Step 5: `twilio-agent/.gitignore`**

```
node_modules/
```

- [ ] **Step 6: Smoke-test the server boots**

Run: `cd twilio-agent && npm install && ANTHROPIC_API_KEY=dummy node -e "import('./server.js').then(()=>setTimeout(()=>process.exit(0),500))"`
Expected: logs "ConversationRelay WS listening on :8080" then exits 0. Then `cd ..`.

- [ ] **Step 7: Commit**

```bash
git add twilio-agent/
git commit -m "feat(twilio): ConversationRelay WebSocket relay (Claude streaming)"
```

---

## Phase 4 — Wire-up + docs

### Task 4.1: Add the 3 demos to nav + gallery

**Files:**
- Modify: `components/AgentNav.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: AgentNav — add 3 links**

In `components/AgentNav.tsx`, extend the `agents` array (after the elevenlabs entry):

```tsx
    { label: dict.vapi, href: "/vapi" },
    { label: dict.retell, href: "/retell" },
    { label: dict.twilio, href: "/twilio" },
```

- [ ] **Step 2: page.tsx — colorClasses + stacks + grid**

In `app/page.tsx`, add to the `colorClasses` map (after `amber`):

```ts
  sky: {
    border: "border-sky-500/20", bg: "bg-sky-500/5", text: "text-sky-400",
    button: "bg-sky-500 text-zinc-950 hover:bg-sky-400",
    badge: "border-sky-500/40 text-sky-400 bg-sky-500/10",
  },
  fuchsia: {
    border: "border-fuchsia-500/20", bg: "bg-fuchsia-500/5", text: "text-fuchsia-400",
    button: "bg-fuchsia-500 text-zinc-950 hover:bg-fuchsia-400",
    badge: "border-fuchsia-500/40 text-fuchsia-400 bg-fuchsia-500/10",
  },
  rose: {
    border: "border-rose-500/20", bg: "bg-rose-500/5", text: "text-rose-400",
    button: "bg-rose-500 text-zinc-950 hover:bg-rose-400",
    badge: "border-rose-500/40 text-rose-400 bg-rose-500/10",
  },
```

Extend the `stacks` array (after elevenlabs):

```ts
    { href: "/vapi", color: "sky", ...dict.gallery.stacks.vapi },
    { href: "/retell", color: "fuchsia", ...dict.gallery.stacks.retell },
    { href: "/twilio", color: "rose", ...dict.gallery.stacks.twilio },
```

Change the grid wrapper class from `sm:grid-cols-3` to `sm:grid-cols-2 lg:grid-cols-3` (6 cards → tidy 2×3 / 3×2).

- [ ] **Step 3: Typecheck + build + verify**

Run: `npx tsc --noEmit && npm run build`
Expected: success. Open `http://localhost:3000/` → 6 cards in a clean grid; `AgentNav` shows all 6 + lang toggle; toggle pt/en works; each card links to its page.

- [ ] **Step 4: Commit**

```bash
git add components/AgentNav.tsx app/page.tsx
git commit -m "feat(portfolio): add Vapi/Retell/Twilio to nav and gallery (6 cards)"
```

### Task 4.2: Full test suite + CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the whole suite + build**

Run: `npm test && npm run build`
Expected: all vitest tests pass (existing + new book-meeting/vapi/retell), build green.

- [ ] **Step 2: Update CLAUDE.md**

Add a "Vapi / Retell / Twilio demos" subsection documenting: the three pages, the shared `lib/book-meeting.ts`, the `twilio-agent/` separate WS service (deploy like `livekit-agent/`), the colour scheme, and a **Pendentes** block listing what the Raphael must do to go live:
- Vapi: fill `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, `NEXT_PUBLIC_VAPI_ASSISTANT_ID`, `VAPI_API_KEY`, `VAPI_WEBHOOK_SECRET` (.env.local + Vercel); create the assistant (Claude Sonnet 4 + 11labs Marta + deepgram pt + `book_meeting` → `/api/vapi/book-meeting`); register ELEVENLABS_API_KEY as a Vapi provider key.
- Retell: fill `RETELL_API_KEY`, `RETELL_AGENT_ID`, `RETELL_WEBHOOK_SECRET`; create the agent (LLM choice still open — default Gemini; voice Marta; `book_meeting` → `/api/retell/book-meeting`); verify custom-function payload shape.
- Twilio: buy a number (non-PT ok); fill `TWILIO_API_KEY`/`TWILIO_API_SECRET`/`TWILIO_TWIML_APP_SID`/`NEXT_PUBLIC_TWILIO_NUMBER`/`TWILIO_AGENT_WSS_URL`; deploy `twilio-agent/` (Railway); TwiML App Voice URL → `/api/twilio/twiml`; add `book_meeting` tool-calling to `twilio-agent/server.js`; add Twilio signature validation to the TwiML route.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): document Vapi/Retell/Twilio demos + go-live pendentes"
```

---

## Self-review notes (addressed)
- **Spec coverage:** every spec section maps to a task — book-meeting refactor (0.1–0.2), i18n/gallery/nav (0.3, 4.1), Vapi (1.x), Retell (2.x), Twilio incl. relay (3.x), env/docs (4.2). ✓
- **Build-always-green:** each phase ends with `npm run build`; widgets guard on missing keys. ✓
- **SDK uncertainty:** Retell (2.1.2) and Twilio (3.1.2) API names are confirmed against installed `node_modules` types before coding, not guessed. ✓
- **Type consistency:** `bookMeeting()` / `BookMeetingArgs` used identically in all tool routes; widget dict prop shapes match the `Dict["widgets"][x]` slices added in 0.3. ✓
- **Known follow-ups (intentional, not placeholders):** Twilio browser transcript, relay `book_meeting` tool-calling, and TwiML signature validation are explicitly deferred to go-live (documented in 4.2), per the spec's YAGNI/phase-1 scope.
