create table if not exists public.push_tokens (
  token text primary key,
  platform text,
  device_name text,
  app_version text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens_public_insert" on public.push_tokens;
drop policy if exists "push_tokens_public_update" on public.push_tokens;

create policy "push_tokens_public_insert"
on public.push_tokens
for insert
to anon
with check (true);

create policy "push_tokens_public_update"
on public.push_tokens
for update
to anon
using (true)
with check (true);

grant insert, update on public.push_tokens to anon;
