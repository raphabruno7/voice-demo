-- Phase 2: enrich calls table with qualification, CRM, and notification fields
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

-- expand language column to accept ES, DE, NL
alter table calls
  drop constraint if exists calls_language_check;

alter table calls
  add constraint calls_language_check
    check (language in ('pt', 'en', 'es', 'de', 'nl', 'unknown'));
