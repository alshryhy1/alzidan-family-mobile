-- COPY-ME: Preset id: maint.pulse_online_phones_v1
-- حضور النبض مع جوال المسجّلين (للإدارة فقط).
-- - pulse_heartbeat_v1: يعدّ المتواجدين ويحفظ جوال العضو المسجّل إن وُجد.
-- - family_admin_pulse_online_v1: قائمة جوالات المتصلين لإدارة العائلة في التطبيق.
-- - admin_pulse_online_v1: نفس القائمة لرمز إدارة الويب.
-- Safe to re-run.

create table if not exists public.pulse_presence (
  session_id text primary key,
  phone text null,
  last_seen_at timestamptz not null default now()
);

create index if not exists pulse_presence_last_seen_idx
  on public.pulse_presence (last_seen_at desc);

create index if not exists pulse_presence_phone_seen_idx
  on public.pulse_presence (phone, last_seen_at desc)
  where phone is not null;

alter table public.pulse_presence enable row level security;

drop policy if exists pulse_presence_deny_all on public.pulse_presence;
-- No direct anon access; all reads/writes go through security definer RPCs.

-- نافذة «متصل الآن»: آخر نبضة خلال ٣ دقائق (التطبيق ينبض كل ٤٥ ثانية تقريباً).
create or replace function public.pulse_online_window_v1()
returns interval
language sql
immutable
as $fn$
  select interval '3 minutes';
$fn$;

grant execute on function public.pulse_online_window_v1() to anon, authenticated;

create or replace function public.pulse_presence_attach_phone_v1(p_phone text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_phone text;
begin
  if p_phone is null or btrim(p_phone) = '' then
    return null;
  end if;
  -- لا نحفظ إلا جوال عضو مسجّل (خصوصية).
  if to_regprocedure('public.member_phone_registered_v1(text)') is null then
    return null;
  end if;
  v_phone := public.member_phone_registered_v1(p_phone);
  return nullif(btrim(coalesce(v_phone, '')), '');
end;
$fn$;

revoke all on function public.pulse_presence_attach_phone_v1(text) from public;
grant execute on function public.pulse_presence_attach_phone_v1(text) to anon, authenticated;

-- استبدال التوقيعات القديمة إن وُجدت.
drop function if exists public.pulse_heartbeat_v1(text);
drop function if exists public.pulse_heartbeat_v1(text, text);

create or replace function public.pulse_heartbeat_v1(
  p_session_id text,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_session text;
  v_phone text;
  v_online int;
begin
  v_session := nullif(btrim(coalesce(p_session_id, '')), '');
  if v_session is null or char_length(v_session) < 8 then
    return jsonb_build_object('ok', false, 'error', 'bad_session', 'online', 0);
  end if;
  if char_length(v_session) > 80 then
    v_session := left(v_session, 80);
  end if;

  v_phone := public.pulse_presence_attach_phone_v1(p_phone);

  insert into public.pulse_presence (session_id, phone, last_seen_at)
  values (v_session, v_phone, now())
  on conflict (session_id) do update
    set last_seen_at = excluded.last_seen_at,
        phone = coalesce(excluded.phone, public.pulse_presence.phone);

  -- تنظيف جلسات قديمة جداً.
  delete from public.pulse_presence
  where last_seen_at < now() - interval '2 days';

  select count(*)::int into v_online
  from public.pulse_presence
  where last_seen_at >= now() - public.pulse_online_window_v1();

  return jsonb_build_object('ok', true, 'online', coalesce(v_online, 0));
end;
$fn$;

revoke all on function public.pulse_heartbeat_v1(text, text) from public;
grant execute on function public.pulse_heartbeat_v1(text, text) to anon, authenticated;

create or replace function public.pulse_online_phones_rows_v1()
returns table (
  phone text,
  display_name text,
  branch_key text,
  last_seen_at timestamptz,
  sessions int
)
language sql
stable
security definer
set search_path = public
as $fn$
  with live as (
    select
      nullif(btrim(p.phone), '') as phone,
      max(p.last_seen_at) as last_seen_at,
      count(*)::int as sessions
    from public.pulse_presence p
    where p.last_seen_at >= now() - public.pulse_online_window_v1()
      and nullif(btrim(p.phone), '') is not null
    group by 1
  )
  select
    l.phone,
    coalesce(
      nullif(btrim(mp.display_name), ''),
      nullif(btrim(to_jsonb(c)->>'child_name'), ''),
      nullif(btrim(to_jsonb(c)->>'name'), ''),
      '—'
    ) as display_name,
    coalesce(
      nullif(btrim(mp.branch_key), ''),
      nullif(btrim(to_jsonb(c)->>'branch_key'), ''),
      ''
    ) as branch_key,
    l.last_seen_at,
    l.sessions
  from live l
  left join lateral (
    select
      nullif(btrim(to_jsonb(m)->>'display_name'), '') as display_name,
      nullif(btrim(to_jsonb(m)->>'branch_key'), '') as branch_key,
      nullif(to_jsonb(m)->>'tree_child_id', '')::bigint as tree_child_id
    from public.member_profiles m
    where right(regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g'), 9)
        = right(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g'), 9)
    order by coalesce((to_jsonb(m)->>'updated_at')::timestamptz, 'epoch'::timestamptz) desc
    limit 1
  ) mp on true
  left join public.tree_children c on c.id = mp.tree_child_id
  order by l.last_seen_at desc;
$fn$;

revoke all on function public.pulse_online_phones_rows_v1() from public;

create or replace function public.family_admin_pulse_online_v1(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_sess jsonb;
  v_online int;
begin
  if to_regprocedure('public.family_admin_session_v1(text)') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing', 'rows', '[]'::jsonb);
  end if;

  v_sess := public.family_admin_session_v1(p_phone);
  if v_sess is null
     or coalesce((v_sess->>'ok')::boolean, true) = false
     or coalesce((v_sess->>'enabled')::boolean, false) = false then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'rows', '[]'::jsonb);
  end if;

  select count(*)::int into v_online
  from public.pulse_presence
  where last_seen_at >= now() - public.pulse_online_window_v1();

  return jsonb_build_object(
    'ok', true,
    'online', coalesce(v_online, 0),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.last_seen_at desc)
      from public.pulse_online_phones_rows_v1() r
    ), '[]'::jsonb)
  );
end;
$fn$;

revoke all on function public.family_admin_pulse_online_v1(text) from public;
grant execute on function public.family_admin_pulse_online_v1(text) to anon, authenticated;

create or replace function public.admin_pulse_online_v1(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_online int;
begin
  if to_regprocedure('public.admin_token_ok_v1(text)') is null
     or not public.admin_token_ok_v1(p_token) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'rows', '[]'::jsonb);
  end if;

  select count(*)::int into v_online
  from public.pulse_presence
  where last_seen_at >= now() - public.pulse_online_window_v1();

  return jsonb_build_object(
    'ok', true,
    'online', coalesce(v_online, 0),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.last_seen_at desc)
      from public.pulse_online_phones_rows_v1() r
    ), '[]'::jsonb)
  );
end;
$fn$;

revoke all on function public.admin_pulse_online_v1(text) from public;
grant execute on function public.admin_pulse_online_v1(text) to anon, authenticated;
