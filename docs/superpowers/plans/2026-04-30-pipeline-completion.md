# Voice Demo — Pipeline Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the post-call automation pipeline: Supabase → n8n → (WhatsApp + Google Sheets + GoHighLevel) and add Google Calendar booking tool to Ana.

**Architecture:** n8n workflow triggered by Supabase DB webhook on `calls` UPDATE; three parallel branches (Twilio WhatsApp notification, Google Sheets logging → Mark Notified, conditional GHL contact creation); Vapi calendar tool calls a Next.js endpoint that creates Google Calendar events via service account.

**Tech Stack:** Next.js 16 App Router, googleapis npm package, n8n 1.x, Vapi, Supabase DB webhooks, Twilio WhatsApp, GoHighLevel v2 API, Vitest.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `lib/google-calendar.ts` | Google Calendar service account client — `createEvent()` |
| Create | `lib/google-calendar.test.ts` | Unit tests for createEvent |
| Create | `app/api/calendar/route.ts` | POST endpoint called by Vapi tool to book a meeting |
| Modify | `n8n/post-call-automation.json` | Fix race condition + guard node + GHL v2 API |
| Modify | `.env.local.example` | Add Google Calendar env vars |
| Modify | `CLAUDE.md` | Document new endpoint + env vars |
| Modify | `vapi/system-prompt.md` | Add exact tool name Ana must use |

---

## Task 1: Fix n8n workflow JSON

**Files:**
- Modify: `n8n/post-call-automation.json`

- [ ] **Step 1: Replace the full file with the corrected workflow**

  Three changes from the original:
  1. New guard `IF — Has Ended and Not Notified` at the top (prevents double-processing)
  2. `Mark Notified` connected only from the Sheets branch (fixes race condition)
  3. GHL node updated to API v2 (`services.leadconnectorhq.com`)

  Full file content:

  ```json
  {
    "_meta": {
      "description": "Post-call automation for voice-demo. Triggers on Supabase calls UPDATE, sends WhatsApp summary via Twilio, logs to Google Sheets, syncs qualified leads to GoHighLevel.",
      "n8n_version": "1.x",
      "last_updated": "2026-04-30"
    },
    "name": "Voice Demo — Post-Call Automation",
    "nodes": [
      {
        "name": "Supabase Trigger",
        "type": "n8n-nodes-base.webhook",
        "notes": "Receives Supabase DB webhook on calls UPDATE. Configure in Supabase: Database > Webhooks > New Webhook, table=calls, event=UPDATE, URL=<this node URL>.",
        "parameters": {
          "httpMethod": "POST",
          "path": "voice-demo-call-ended",
          "responseMode": "onReceived"
        }
      },
      {
        "name": "IF — Has Ended and Not Notified",
        "type": "n8n-nodes-base.if",
        "notes": "Guard: only process calls that have ended and have not been notified yet. Prevents reprocessing on repeated Supabase updates.",
        "parameters": {
          "conditions": {
            "string": [
              {
                "value1": "={{ $json.record.ended_at }}",
                "operation": "isNotEmpty"
              }
            ],
            "dateTime": [],
            "boolean": [
              {
                "value1": "={{ $json.record.notified_at === null || $json.record.notified_at === undefined }}",
                "value2": true
              }
            ]
          },
          "combineOperation": "all"
        }
      },
      {
        "name": "Twilio WhatsApp — Notify Raphael",
        "type": "n8n-nodes-base.twilio",
        "notes": "Sends post-call summary to Raphael via WhatsApp. Credential: Twilio API (Account SID + Auth Token). From = whatsapp:+14155238886 (sandbox) or your real Twilio number. To = whatsapp:+351XXXXXXXXX.",
        "parameters": {
          "operation": "send",
          "from": "whatsapp:+14155238886",
          "to": "={{ 'whatsapp:' + $env.TWILIO_WHATSAPP_TO }}",
          "message": "=📞 Nova chamada\nNúmero: {{ $json.record.caller_number ?? 'desconhecido' }}\nNome: {{ $json.record.caller_name ?? '-' }}\nIdioma: {{ $json.record.language }} | Duração: {{ $json.record.duration_sec }}s\nIntent: {{ $json.record.intent }}\n\nResumo:\n{{ $json.record.summary }}"
        }
      },
      {
        "name": "Google Sheets — Append Row",
        "type": "n8n-nodes-base.googleSheets",
        "notes": "Appends one row per call. Create sheet manually with headers in row 1: Date | Caller | Language | Duration (s) | Intent | Summary. Then replace YOUR_GOOGLE_SHEET_ID with the ID from the sheet URL.",
        "parameters": {
          "operation": "append",
          "documentId": "YOUR_GOOGLE_SHEET_ID",
          "sheetName": "Voice Demo Calls",
          "columns": {
            "mappingMode": "defineBelow",
            "value": {
              "Date": "={{ new Date($json.record.ended_at).toLocaleString('pt-PT') }}",
              "Caller": "={{ $json.record.caller_number ?? '' }}",
              "Language": "={{ $json.record.language }}",
              "Duration (s)": "={{ $json.record.duration_sec }}",
              "Intent": "={{ $json.record.intent }}",
              "Summary": "={{ $json.record.summary }}"
            }
          }
        }
      },
      {
        "name": "Supabase — Mark Notified",
        "type": "n8n-nodes-base.httpRequest",
        "notes": "Marks the call as notified so it is not processed again. Uses Supabase REST API with service_role key. Set n8n env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        "parameters": {
          "method": "PATCH",
          "url": "={{ $env.SUPABASE_URL }}/rest/v1/calls?call_id=eq.{{ $json.record.call_id }}",
          "headers": {
            "apikey": "={{ $env.SUPABASE_SERVICE_ROLE_KEY }}",
            "Authorization": "=Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          "body": {
            "notified_at": "={{ new Date().toISOString() }}"
          },
          "sendBody": true,
          "bodyContentType": "json"
        }
      },
      {
        "name": "IF — Qualified or Booked",
        "type": "n8n-nodes-base.if",
        "notes": "Only proceed to CRM if there is a qualified lead or booking.",
        "parameters": {
          "conditions": {
            "string": [
              {
                "value1": "={{ $json.record.intent }}",
                "operation": "regex",
                "value2": "^(qualified|booked)$"
              }
            ]
          }
        }
      },
      {
        "name": "GoHighLevel — Create Contact",
        "type": "n8n-nodes-base.httpRequest",
        "notes": "Creates a GHL contact using API v2. Add Header Auth credential named 'GoHighLevel API' with header name=Authorization value='Bearer YOUR_GHL_API_KEY'. Replace YOUR_GHL_LOCATION_ID below.",
        "parameters": {
          "method": "POST",
          "url": "https://services.leadconnectorhq.com/contacts/",
          "authentication": "genericCredentialType",
          "genericAuthType": "httpHeaderAuth",
          "nodeCredentialType": "httpHeaderAuth",
          "headers": {
            "Version": "2021-07-28",
            "Content-Type": "application/json"
          },
          "body": {
            "locationId": "YOUR_GHL_LOCATION_ID",
            "phone": "={{ $json.record.caller_number }}",
            "firstName": "={{ $json.record.caller_name ?? $json.record.caller_number }}",
            "tags": ["voice-demo", "={{ $json.record.intent }}", "={{ $json.record.language }}"]
          },
          "sendBody": true,
          "bodyContentType": "json"
        }
      }
    ],
    "connections": {
      "Supabase Trigger": {
        "main": [[
          { "node": "IF — Has Ended and Not Notified", "type": "main", "index": 0 }
        ]]
      },
      "IF — Has Ended and Not Notified": {
        "main": [
          [
            { "node": "Twilio WhatsApp — Notify Raphael", "type": "main", "index": 0 },
            { "node": "Google Sheets — Append Row", "type": "main", "index": 0 },
            { "node": "IF — Qualified or Booked", "type": "main", "index": 0 }
          ],
          []
        ]
      },
      "Google Sheets — Append Row": {
        "main": [[
          { "node": "Supabase — Mark Notified", "type": "main", "index": 0 }
        ]]
      },
      "IF — Qualified or Booked": {
        "main": [
          [{ "node": "GoHighLevel — Create Contact", "type": "main", "index": 0 }],
          []
        ]
      }
    },
    "setup_checklist": [
      "1. In n8n: Settings > Variables — add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      "2. In n8n: Settings > Variables — add TWILIO_WHATSAPP_TO (your PT number, e.g. +351912345678)",
      "3. Configure Twilio API credential in n8n Credentials (Account SID + Auth Token)",
      "4. Configure Google Sheets OAuth2 credential in n8n Credentials",
      "5. Create Google Sheet named 'Voice Demo Calls' with headers: Date | Caller | Language | Duration (s) | Intent | Summary",
      "6. Replace YOUR_GOOGLE_SHEET_ID in Google Sheets node with the ID from your sheet URL",
      "7. Create Header Auth credential in n8n named 'GoHighLevel API': header=Authorization, value=Bearer YOUR_GHL_API_KEY",
      "8. Replace YOUR_GHL_LOCATION_ID in GHL node with your Location ID from GHL dashboard",
      "9. In Supabase: Database > Webhooks > New Webhook — table=calls, event=UPDATE, URL=<n8n Supabase Trigger webhook URL>",
      "10. Activate the workflow in n8n",
      "11. Make a test call and verify: WhatsApp received, row in Google Sheets, GHL contact created (if qualified)"
    ]
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add n8n/post-call-automation.json
  git commit -m "fix(n8n): add guard node, fix Mark Notified race condition, GHL API v1→v2"
  ```

---

## Task 2: Add Google Calendar env vars + install googleapis

**Files:**
- Modify: `.env.local.example`
- Modify: `package.json` (add googleapis, vitest)

- [ ] **Step 1: Add env vars to `.env.local.example`**

  Append below the existing Twilio block:

  ```
  # Google Calendar (for Ana to book demos — used in /api/calendar)
  GOOGLE_SERVICE_ACCOUNT_EMAIL=voice-demo@your-project.iam.gserviceaccount.com
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
  GOOGLE_CALENDAR_ID=your-calendar-id@gmail.com
  ```

- [ ] **Step 2: Install googleapis and vitest**

  ```bash
  cd /Users/raphaelbruno/voice-demo
  npm install googleapis
  npm install -D vitest @vitest/globals
  ```

- [ ] **Step 3: Add test script to package.json**

  In `package.json`, add `"test": "vitest run"` to the scripts block:

  ```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  }
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add .env.local.example package.json package-lock.json
  git commit -m "chore: add googleapis, vitest, and Google Calendar env vars"
  ```

---

## Task 3: Create Google Calendar library

**Files:**
- Create: `lib/google-calendar.ts`
- Create: `lib/google-calendar.test.ts`

- [ ] **Step 1: Write the failing test**

  Create `lib/google-calendar.test.ts`:

  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  const mockInsert = vi.fn();

  vi.mock('googleapis', () => ({
    google: {
      auth: {
        GoogleAuth: vi.fn().mockImplementation(() => ({ getClient: vi.fn() })),
      },
      calendar: vi.fn().mockReturnValue({
        events: { insert: mockInsert },
      }),
    },
  }));

  import { createEvent } from './google-calendar';

  describe('createEvent', () => {
    beforeEach(() => {
      mockInsert.mockResolvedValue({
        data: {
          id: 'evt-abc123',
          htmlLink: 'https://calendar.google.com/event?eid=abc123',
          start: { dateTime: '2026-05-01T10:00:00+01:00' },
        },
      });
    });

    it('returns eventId and htmlLink from Google Calendar response', async () => {
      const result = await createEvent({
        callerName: 'João Silva',
        startTime: '2026-05-01T10:00:00+01:00',
      });

      expect(result.eventId).toBe('evt-abc123');
      expect(result.htmlLink).toContain('calendar.google.com');
      expect(result.startTime).toBe('2026-05-01T10:00:00+01:00');
    });

    it('inserts event with correct summary and 30-minute duration', async () => {
      await createEvent({ callerName: 'Maria', startTime: '2026-05-02T15:00:00+01:00' });

      const call = mockInsert.mock.calls[0][0];
      expect(call.requestBody.summary).toBe('Demo — Maria');
      const start = new Date(call.requestBody.start.dateTime);
      const end = new Date(call.requestBody.end.dateTime);
      expect((end.getTime() - start.getTime()) / 60000).toBe(30);
    });
  });
  ```

- [ ] **Step 2: Run test — verify it fails**

  ```bash
  cd /Users/raphaelbruno/voice-demo && npm test
  ```

  Expected: `FAIL lib/google-calendar.test.ts — Cannot find module './google-calendar'`

- [ ] **Step 3: Implement `lib/google-calendar.ts`**

  ```typescript
  import { google } from 'googleapis';

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  export async function createEvent({
    callerName,
    startTime,
  }: {
    callerName: string;
    startTime: string;
  }) {
    const calendar = google.calendar({ version: 'v3', auth });
    const start = new Date(startTime);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    const res = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID!,
      requestBody: {
        summary: `Demo — ${callerName}`,
        description: 'Booked via Ana voice AI agent (voice-demo)',
        start: { dateTime: start.toISOString(), timeZone: 'Europe/Lisbon' },
        end: { dateTime: end.toISOString(), timeZone: 'Europe/Lisbon' },
      },
    });

    return {
      eventId: res.data.id!,
      htmlLink: res.data.htmlLink!,
      startTime: res.data.start?.dateTime ?? startTime,
    };
  }
  ```

- [ ] **Step 4: Run test — verify it passes**

  ```bash
  npm test
  ```

  Expected: `PASS lib/google-calendar.test.ts (2 tests)`

- [ ] **Step 5: Commit**

  ```bash
  git add lib/google-calendar.ts lib/google-calendar.test.ts
  git commit -m "feat: add Google Calendar createEvent library"
  ```

---

## Task 4: Create /api/calendar endpoint

**Files:**
- Create: `app/api/calendar/route.ts`

- [ ] **Step 1: Create `app/api/calendar/route.ts`**

  ```typescript
  import { NextRequest, NextResponse } from 'next/server';
  import { createEvent } from '@/lib/google-calendar';

  export async function POST(req: NextRequest) {
    const secret = req.headers.get('x-vapi-secret');
    if (secret !== process.env.VAPI_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { callerName, startTime } = body as { callerName?: string; startTime?: string };

    if (!callerName || !startTime) {
      return NextResponse.json(
        { error: 'callerName and startTime are required' },
        { status: 400 }
      );
    }

    try {
      const event = await createEvent({ callerName, startTime });
      const formattedTime = new Date(startTime).toLocaleString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Lisbon',
      });

      return NextResponse.json({
        success: true,
        eventId: event.eventId,
        meetingTime: formattedTime,
      });
    } catch (err) {
      console.error('[/api/calendar] createEvent failed:', err);
      return NextResponse.json({
        success: false,
        error: 'Failed to create calendar event',
      });
    }
  }
  ```

- [ ] **Step 2: Commit and push to trigger Vercel deploy**

  ```bash
  git add app/api/calendar/route.ts
  git commit -m "feat: add /api/calendar endpoint for Ana to book demos"
  git push
  ```

- [ ] **Step 3: Verify Vercel deploy succeeded**

  Visit https://voice-demo-navy.vercel.app — check that it loads without errors.

  In Vercel dashboard, add the three new env vars:
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
  - `GOOGLE_CALENDAR_ID`

  Then trigger a redeploy (Vercel dashboard > Deployments > Redeploy).

---

## Task 5: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add calendar endpoint and env vars to CLAUDE.md**

  In the `## Project structure` section, add the new route:

  ```
  app/api/calendar/route.ts    # Vapi tool endpoint — creates Google Calendar event for Ana
  lib/
    google-calendar.ts         # Google Calendar service-account client (createEvent)
  ```

  In the `## Environment variables` table, add:

  ```
  | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Calendar API auth |
  | `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Calendar API auth |
  | `GOOGLE_CALENDAR_ID` | Target calendar for demo events |
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add CLAUDE.md
  git commit -m "docs: document /api/calendar endpoint and Google Calendar env vars"
  ```

---

## Task 6: Update Vapi system prompt with exact tool name

**Files:**
- Modify: `vapi/system-prompt.md`

- [ ] **Step 1: Update the `## Vapi Tools to Configure` section**

  Replace the existing tool section with the exact Vapi tool JSON the user needs to paste in the dashboard:

  ```markdown
  ## Vapi Tools to Configure

  ### bookMeeting

  In Vapi dashboard → Assistants → Ana → Tools → Add Tool → Custom Tool, paste:

  \`\`\`json
  {
    "type": "function",
    "function": {
      "name": "bookMeeting",
      "description": "Books a 30-minute demo meeting with Raphael in Google Calendar. Use when the caller agrees to schedule a meeting.",
      "parameters": {
        "type": "object",
        "properties": {
          "callerName": {
            "type": "string",
            "description": "Full name or first name of the caller"
          },
          "startTime": {
            "type": "string",
            "description": "ISO 8601 datetime string for the meeting start. Convert the caller's preferred day/time to an absolute ISO datetime (e.g. 2026-05-01T10:00:00). Morning = 10:00, Afternoon = 15:00. Base relative dates on today's date."
          }
        },
        "required": ["callerName", "startTime"]
      }
    },
    "server": {
      "url": "https://voice-demo-navy.vercel.app/api/calendar",
      "headers": {
        "x-vapi-secret": "<paste VAPI_WEBHOOK_SECRET value here>"
      }
    }
  }
  \`\`\`
  ```

  Also update the system prompt block to reference the tool by exact name:

  Replace:
  ```
  Then use the Google Calendar booking tool with the collected name and time preference.
  ```
  With:
  ```
  Then call the bookMeeting tool with callerName and startTime (ISO 8601).
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add vapi/system-prompt.md
  git commit -m "docs: add exact Vapi bookMeeting tool JSON and update system prompt reference"
  ```

---

## Task 7: [Guide] Google Cloud — Service Account for Calendar API

> **User action required** — no code to write. Follow these steps in the Google Cloud Console.

- [ ] **Step 1: Create a Google Cloud project**

  1. Go to https://console.cloud.google.com
  2. Click "Select a project" → "New Project" → name it `voice-demo`
  3. Click "Create"

- [ ] **Step 2: Enable Google Calendar API**

  1. In the project, go to "APIs & Services" → "Library"
  2. Search "Google Calendar API" → click Enable

- [ ] **Step 3: Create a service account**

  1. Go to "APIs & Services" → "Credentials"
  2. Click "Create Credentials" → "Service Account"
  3. Name: `voice-demo-calendar`, click "Done"
  4. Click the service account → "Keys" → "Add Key" → "JSON"
  5. A JSON file downloads — open it

- [ ] **Step 4: Extract credentials from the JSON file**

  From the downloaded JSON:
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL` = value of `"client_email"`
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` = value of `"private_key"` (the full multiline string including `-----BEGIN PRIVATE KEY-----`)

- [ ] **Step 5: Share your calendar with the service account**

  1. Go to https://calendar.google.com → Settings → your calendar → "Share with specific people"
  2. Add the `GOOGLE_SERVICE_ACCOUNT_EMAIL` value with "Make changes to events" permission

- [ ] **Step 6: Get your Calendar ID**

  In Google Calendar → Settings → your calendar → scroll down to "Integrate calendar" → copy "Calendar ID"
  - `GOOGLE_CALENDAR_ID` = that value (e.g. `raphaelbruno.dev@gmail.com` or a long `@group.calendar.google.com` ID)

- [ ] **Step 7: Add env vars to Vercel and .env.local**

  Add the three env vars to Vercel dashboard → voice-demo → Settings → Environment Variables.
  Add the same values to your local `.env.local`.
  Redeploy on Vercel after adding.

---

## Task 8: [Guide] Supabase DB Webhook

> **User action required** — configure in Supabase dashboard.

- [ ] **Step 1: Apply migration 002 if not already done**

  In Supabase SQL Editor, check if `notified_at` column exists:

  ```sql
  select column_name from information_schema.columns
  where table_name = 'calls' and column_name = 'notified_at';
  ```

  If no row returned, run the migration:

  ```sql
  alter table calls
    add column if not exists caller_number  text,
    add column if not exists caller_name    text,
    add column if not exists business_type  text,
    add column if not exists intent         text
      check (intent in ('qualified', 'booked', 'objection', 'no_interest', 'unknown'))
      default 'unknown',
    add column if not exists appointment_id text,
    add column if not exists appointment_at timestamptz,
    add column if not exists crm_contact_id text,
    add column if not exists notified_at    timestamptz;

  alter table calls drop constraint if exists calls_language_check;
  alter table calls add constraint calls_language_check
    check (language in ('pt', 'en', 'es', 'de', 'nl', 'unknown'));
  ```

- [ ] **Step 2: Get the n8n webhook URL**

  In n8n: open the "Voice Demo — Post-Call Automation" workflow → click the "Supabase Trigger" webhook node → copy the "Test URL" (or "Production URL" once activated).

  It looks like: `https://your-n8n-domain/webhook/voice-demo-call-ended`

  If running n8n locally, use ngrok to expose it: `ngrok http 5678`
  Use the ngrok URL: `https://<ngrok-id>.ngrok.io/webhook/voice-demo-call-ended`

- [ ] **Step 3: Create the webhook in Supabase**

  In Supabase dashboard → Database → Webhooks → "Create a new hook":

  - **Name:** `voice-demo-call-ended`
  - **Table:** `calls`
  - **Events:** check `UPDATE` only
  - **Type:** HTTP Request
  - **Method:** POST
  - **URL:** paste the n8n webhook URL from Step 2
  - **HTTP Headers:** none required
  - Click "Confirm"

---

## Task 9: [Guide] Twilio WhatsApp setup

> **User action required** — create account and configure.

- [ ] **Step 1: Create Twilio account**

  Go to https://www.twilio.com/try-twilio → sign up → verify phone number.

- [ ] **Step 2: Activate WhatsApp sandbox**

  In Twilio dashboard → Messaging → Try it out → Send a WhatsApp message.
  Follow the sandbox activation: send the join code from your phone to the sandbox number (+1 415 523 8886).

- [ ] **Step 3: Get Twilio credentials**

  In Twilio dashboard → Account → API keys & tokens:
  - `Account SID` — starts with `AC`
  - `Auth Token`

- [ ] **Step 4: Add Twilio credential in n8n**

  In n8n → Credentials → New → search "Twilio" → Twilio API:
  - Account SID: paste value
  - Auth Token: paste value
  - Name: `Twilio`

- [ ] **Step 5: Set TWILIO_WHATSAPP_TO in n8n variables**

  In n8n → Settings → Variables → New Variable:
  - Key: `TWILIO_WHATSAPP_TO`
  - Value: your PT WhatsApp number in E.164 format, e.g. `+351912345678`

---

## Task 10: [Guide] Google Sheets OAuth2 setup in n8n

> **User action required.**

- [ ] **Step 1: Create the Google Sheet**

  Go to https://sheets.google.com → New spreadsheet → name it "Voice Demo Calls".
  In row 1, add headers in columns A–F:
  `Date | Caller | Language | Duration (s) | Intent | Summary`

- [ ] **Step 2: Copy the Sheet ID**

  From the URL: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`
  Copy `SHEET_ID`.

- [ ] **Step 3: Configure Google Sheets OAuth2 in n8n**

  In n8n → Credentials → New → "Google Sheets OAuth2 API":
  - Follow the OAuth2 flow to authorize with your Google account
  - Name it `Google Sheets`

- [ ] **Step 4: Update the workflow node**

  In n8n → Voice Demo workflow → Google Sheets node:
  - Set credential to `Google Sheets`
  - Set Document ID to the `SHEET_ID` from Step 2

---

## Task 11: [Guide] GoHighLevel setup

> **User action required.**

- [ ] **Step 1: Create GoHighLevel account**

  Go to https://www.gohighlevel.com → Start Free Trial → complete onboarding → create a Location (sub-account) named "Voice Demo".

- [ ] **Step 2: Get API key and Location ID**

  - **API key:** Settings → Integrations → API Keys → Create API Key
  - **Location ID:** Settings → Business Profile → scroll to "Location ID"

- [ ] **Step 3: Create Header Auth credential in n8n**

  In n8n → Credentials → New → "HTTP Header Auth":
  - Name: `GoHighLevel API`
  - Header Name: `Authorization`
  - Header Value: `Bearer YOUR_GHL_API_KEY`

- [ ] **Step 4: Update GHL node in n8n**

  In n8n → Voice Demo workflow → GoHighLevel node:
  - Set credential to `GoHighLevel API`
  - In the body JSON, replace `YOUR_GHL_LOCATION_ID` with your actual Location ID

---

## Task 12: [Guide] n8n environment variables + activate workflow

> **User action required** — after completing Tasks 9–11.

- [ ] **Step 1: Add Supabase vars to n8n**

  In n8n → Settings → Variables:
  - `SUPABASE_URL` = your Supabase project URL (e.g. `https://xxxx.supabase.co`)
  - `SUPABASE_SERVICE_ROLE_KEY` = from Supabase dashboard → Settings → API → service_role key

- [ ] **Step 2: Verify all nodes have credentials**

  Open the workflow. Each node should show its credential (no red warnings):
  - Twilio WhatsApp → Twilio credential
  - Google Sheets → Google Sheets OAuth2
  - GoHighLevel → GoHighLevel API (Header Auth)

- [ ] **Step 3: Activate the workflow**

  Click the toggle in the top-right of the workflow editor → "Active".

- [ ] **Step 4: End-to-end test**

  Make a real call to Ana's number. After the call ends:
  1. Check WhatsApp — notification should arrive within ~10 seconds
  2. Check Google Sheet — new row should appear
  3. If you said something that sounds qualified/interested — check GHL contacts
  4. Check Supabase calls table — `notified_at` should be set

---

## Task 13: [Guide] Vapi bookMeeting tool + Twilio BYOC for PT outbound

> **User action required** — two independent setup steps.

### Vapi Calendar tool

- [ ] **Step 1: Configure bookMeeting tool in Vapi**

  In Vapi dashboard → Assistants → Ana → Tools → Add Tool → Custom Tool.
  Paste the JSON from `vapi/system-prompt.md` → `## Vapi Tools to Configure` section.
  Replace `<paste VAPI_WEBHOOK_SECRET value here>` with the actual value.

- [ ] **Step 2: Update Ana's system prompt**

  In Vapi dashboard → Ana → Model → System Prompt:
  Replace the old APPOINTMENT BOOKING block with the updated version from `vapi/system-prompt.md`.

- [ ] **Step 3: Test calendar booking**

  Call Ana and express interest in a meeting. She should ask for your name and preferred time, then call `bookMeeting`. Verify a Google Calendar event is created.

### Twilio BYOC for PT outbound

- [ ] **Step 4: Purchase a Portuguese Twilio number**

  In Twilio dashboard → Phone Numbers → Manage → Buy a number:
  - Country: Portugal
  - Select a mobile or local number (~€1/mo)
  - Click Buy

- [ ] **Step 5: Import the Twilio number into Vapi**

  In Vapi dashboard → Phone Numbers → Import:
  - Provider: Twilio
  - Account SID: paste
  - Auth Token: paste
  - Phone Number: the PT number you bought (e.g. `+351912345678`)

- [ ] **Step 6: Link the imported number to Ana**

  In Vapi → Phone Numbers → select the PT number → Assistant → select "Ana".

- [ ] **Step 7: Update NEXT_PUBLIC_PHONE_NUMBER env var**

  In Vercel → voice-demo → Environment Variables:
  - `NEXT_PUBLIC_PHONE_NUMBER` = the PT number (e.g. `+351 912 345 678`)

  Redeploy to show the new number on the landing page.

- [ ] **Step 8: Update .env.local**

  ```
  NEXT_PUBLIC_PHONE_NUMBER=+351 912 345 678
  ```

  Commit:

  ```bash
  git add .env.local.example
  git commit -m "chore: update NEXT_PUBLIC_PHONE_NUMBER for PT Twilio number"
  ```
