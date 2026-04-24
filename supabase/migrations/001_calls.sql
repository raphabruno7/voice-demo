create table calls (
  id           uuid primary key default gen_random_uuid(),
  call_id      text unique not null,
  started_at   timestamptz not null,
  ended_at     timestamptz,
  duration_sec integer,
  language     text default 'unknown',
  transcript   text,
  summary      text,
  created_at   timestamptz default now()
);

alter table calls enable row level security;
create policy "public read" on calls for select using (true);
