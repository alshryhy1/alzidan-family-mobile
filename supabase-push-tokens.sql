-- Push tokens: table + RLS for mobile registration + RPC fallback.
-- Run in Supabase SQL editor if push registration fails with RLS 42501.

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
to anon, authenticated
with check (true);

create policy "push_tokens_public_update"
on public.push_tokens
for update
to anon, authenticated
using (true)
with check (true);

grant insert, update on public.push_tokens to anon, authenticated;

create or replace function public.register_push_token_v1(
  p_token text,
  p_platform text,
  p_device_name text default null,
  p_app_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(p_token), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_token');
  end if;

  insert into public.push_tokens (token, platform, device_name, app_version, enabled, updated_at)
  values (trim(p_token), nullif(trim(p_platform), ''), p_device_name, p_app_version, true, now())
  on conflict (token) do update set
    platform = excluded.platform,
    device_name = excluded.device_name,
    app_version = excluded.app_version,
    enabled = true,
    updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.register_push_token_v1(text, text, text, text) from public;
grant execute on function public.register_push_token_v1(text, text, text, text) to anon, authenticated;

-- التحقق: SELECT count(*) FROM push_tokens; (بصلاحية service role)
