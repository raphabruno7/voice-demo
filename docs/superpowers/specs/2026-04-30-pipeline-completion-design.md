# Design: Voice Demo — Pipeline Completion

**Date:** 2026-04-30  
**Status:** Approved

## Overview

Complete the post-call automation pipeline for voice-demo. The webhook → Supabase path is live. What remains: trigger n8n from Supabase, configure three external integrations (Twilio WhatsApp, Google Sheets, GoHighLevel), add a calendar booking endpoint for Ana, and enable outbound PT calls.

## Scope

7 pending items split by responsibility:

### User actions (external dashboards)
| ID | Action | Service |
|----|--------|---------|
| A | Create Twilio account, activate WhatsApp sandbox | twilio.com |
| B | Create Google Sheet with 6 columns (Date, Caller, Language, Duration, Intent, Summary), configure OAuth2 in n8n | sheets.google.com + n8n |
| C | Create GoHighLevel account (free trial), create Location, obtain API key + Location ID | gohighlevel.com |
| D | Authorize Google Calendar in Vapi dashboard + link calendar tool to Ana | app.vapi.ai |

### Code/config (Claude)
| ID | Action | Where |
|----|--------|-------|
| 1 | Guide Supabase DB Webhook setup | Supabase dashboard |
| 2 | Fix n8n workflow JSON (Mark Notified race condition + GHL API v1 → v2) | n8n/post-call-automation.json |
| 3 | Create `/api/calendar` endpoint for Ana to book via Vapi tool | Next.js |
| 4 | Import updated workflow into n8n and activate | n8n |

## Architecture

### Post-call pipeline (n8n)

```
Supabase UPDATE (ended_at set)
  → n8n webhook trigger
    ├── Twilio WhatsApp → Notify Raphael (terminates)
    ├── Google Sheets → Append row
    │     → Supabase PATCH → Set notified_at   ← always runs
    └── IF intent == qualified|booked
          → GHL v2 → Create/Update Contact (terminates)
```

**Fix:** `Mark Notified` currently wired from both Google Sheets and GHL branches → race condition. New design: Sheets branch always runs Mark Notified (every call gets marked). GHL branch terminates independently after creating the contact. This guarantees `notified_at` is set exactly once for all intent types.

### Calendar booking endpoint

```
Vapi tool call (Ana collects name + time preference)
  → POST /api/calendar
    → Google Calendar API → Create event
    → Return { success, eventId, confirmationMessage }
  → Ana reads confirmation back to caller
```

Endpoint validates `x-vapi-secret`, creates event in Raphael's calendar (30-min slot, title "Demo with {name}"), returns natural-language confirmation for Ana to speak.

### GoHighLevel API v2

Old: `POST https://rest.gohighlevel.com/v1/contacts/`  
New: `POST https://services.leadconnectorhq.com/contacts/` with `Authorization: Bearer {API_KEY}` and `Version: 2021-07-28` header.

Contact payload: `phone`, `firstName`, `locationId`, tags `["voice-demo", intent, language]`, custom fields for `call_summary`, `call_language`, `call_intent`.

### Outbound PT calls

Free-tier Vapi only supports US outbound. Two options:
- **Vapi Scale plan** (~$99/mo) — enables international
- **Twilio BYOC** — bring Twilio number to Vapi (cheaper, requires Twilio account already needed for WhatsApp)

Recommended: use Twilio BYOC since Twilio account is being created anyway for WhatsApp. Requires purchasing a PT number (~€1/mo) and linking it to Vapi via "Phone Numbers > Import" in the Vapi dashboard.

## Environment variables to add

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=
```

## Execution order

1. Fix n8n JSON (no external dependency)
2. Create `/api/calendar` endpoint + deploy
3. User creates Twilio + GHL accounts (parallel)
4. User sets up Google Sheets OAuth2 in n8n
5. Configure Supabase DB Webhook
6. Import updated n8n workflow + add credentials
7. Activate n8n workflow
8. Configure Vapi Calendar tool (after endpoint is live)
9. Twilio BYOC for PT outbound
10. End-to-end test call
