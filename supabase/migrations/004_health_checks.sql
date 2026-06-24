create table health_checks (
  id          uuid primary key default gen_random_uuid(),
  checked_at  timestamptz not null default now(),
  service     text not null,
  status      text not null check (status in ('ok', 'degraded', 'fail')),
  latency_ms  integer,
  error_msg   text
);

alter table health_checks enable row level security;
-- Dados operacionais internos — service_role only, sem public select
create index health_checks_service_checked_at on health_checks (service, checked_at desc);
