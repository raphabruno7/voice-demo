@AGENTS.md

# voice-demo

Portfolio demo of a live bilingual voice AI agent (Ana, PT/EN). Prospects call a real phone number and speak with Ana in real time. The stack is production-grade, not a prototype.

## Stack

| Layer | Service |
|---|---|
| Framework | Next.js 16 (App Router) — React 19 |
| Voice AI | Vapi (assistant: Ana) |
| LLM | Groq → Llama 3.3 70B Versatile |
| Phone number | Vapi native (free US number) |
| Database | Supabase (PostgreSQL + RLS) |
| Deploy | Vercel (Supabase native integration for env vars) |
| UI | Tailwind v4 + shadcn/ui (Base UI) |

## Project structure

```
app/
  page.tsx                      # Landing page — force-dynamic
  api/
    vapi/webhook/route.ts       # Vapi event handler (call-started, end-of-call-report)
    call/route.ts               # Outbound call via Vapi REST API
components/
  CallStats.tsx                 # Async server component — revalidate 60s, reads Supabase
  CallMeForm.tsx                # Client component — triggers outbound call
  PhoneNumber.tsx               # Client component — copy-to-clipboard
  QRCode.tsx                    # Async server component — SVG QR for tel: URI
lib/
  supabase.ts                   # Lazy singleton clients (anon + service_role)
  vapi.ts                       # VapiEvent types + detectLanguage()
supabase/migrations/
  001_calls.sql                 # calls table + RLS public read policy
```

## Key patterns

**Supabase clients** — lazy singletons in `lib/supabase.ts`. Never instantiate at module level (breaks build). Use `supabase` (anon) for reads in server components, `supabaseAdmin` (service_role) only in API routes that write.

**Webhook security** — `app/api/vapi/webhook/route.ts` validates `x-vapi-secret` header against `VAPI_WEBHOOK_SECRET`. Returns 401 on mismatch. Vapi retries on non-200 so always return 200 on success.

**Language detection** — `detectLanguage()` in `lib/vapi.ts` uses word-frequency regex (PT vs EN). Applied to transcript on `end-of-call-report`.

**Static prerendering** — page uses `export const dynamic = "force-dynamic"`. `CallStats` guards with `if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null` so build passes without env vars.

**QR code** — server component, `qrcode` pkg generates SVG string (`type: "svg"`), injected via `dangerouslySetInnerHTML`. White dots on transparent background (`dark: "#ffffff"`, `light: "#00000000"`).

## Environment variables

| Variable | Where used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase anon client + CallStats guard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon client (reads) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin client (webhook writes) |
| `VAPI_WEBHOOK_SECRET` | Webhook auth header validation |
| `VAPI_API_KEY` | Outbound call API (`/api/call`) |
| `VAPI_ASSISTANT_ID` | Outbound call payload |
| `VAPI_PHONE_NUMBER_ID` | Outbound call payload |
| `NEXT_PUBLIC_PHONE_NUMBER` | Phone number displayed on landing page |

Vercel env vars are synced via the Supabase native integration (covers the four Supabase vars automatically).

## Local dev

```bash
cp .env.local.example .env.local  # fill in vars
npm run dev
```

Webhook requires a public URL — use `ngrok http 3000` and point Vapi Org Settings > Server URL to `https://<ngrok>/api/vapi/webhook`.

## Git

```
Remote: https://github.com/raphabruno7/voice-demo.git
Branch: main (single branch — push directly, no PRs needed for this solo project)
```

Commit style used in this repo (follow it):
```
feat: add outbound call form — Ana liga para o utilizador
style: reduce phone number size to fit inline with QR code
fix: <short description>
```

## Deploy

Push to `main` → Vercel auto-deploys. No build config needed — `next build` is the default.

Production URL: `voice-demo-navy.vercel.app`

## Vapi configuration (manual, via dashboard)

- **Assistant name:** Ana
- **LLM:** Groq → `llama-3.3-70b-versatile`
- **Webhook:** Org Settings > Server URL → `https://voice-demo-navy.vercel.app/api/vapi/webhook`
- **Webhook secret:** set as Authorization header `x-vapi-secret: <value>` matching `VAPI_WEBHOOK_SECRET`
- **Phone number:** linked to Ana assistant

## Database

Single table `calls`. Schema at `supabase/migrations/001_calls.sql`. RLS enabled — public SELECT, writes only via service_role key (webhook).

To apply migration to a fresh Supabase project: paste the SQL in the Supabase SQL Editor and run.
