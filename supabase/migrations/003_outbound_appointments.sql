-- Phase 3: outbound confirmation/reschedule/cancel calls ("Ana liga-te")
create table outbound_appointments (
  id                 uuid primary key default gen_random_uuid(),
  calendar_event_id  text unique not null,
  business_type      text,
  client_name        text,
  client_phone       text,
  appointment_at     timestamptz not null,
  reminder_status    text not null default 'pending'
    check (reminder_status in ('pending','called','confirmed','rescheduled','cancelled','no_answer','failed','opted_out')),
  reminder_attempts  integer not null default 0,
  last_attempt_at    timestamptz,
  outcome_notes      text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

alter table outbound_appointments enable row level security;
-- Unlike `calls` (public read, fine for portfolio demo data), this table holds
-- real PII of third-party clinic/real-estate clients — service_role only,
-- no public select policy.
