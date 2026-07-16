create table turn_metrics (
  id              uuid primary key default gen_random_uuid(),
  call_id         text not null,
  e2e_latency_ms  integer not null,
  created_at      timestamptz default now()
);

alter table turn_metrics enable row level security;
-- Operacional interno — service_role only, sem public select (como health_checks)
create index turn_metrics_call_id on turn_metrics (call_id, created_at desc);
