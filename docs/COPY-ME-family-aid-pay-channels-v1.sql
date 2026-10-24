-- COPY-ME: Preset id: maint.family_aid_pay_channels_v1
-- قنوات المساهمة عند نشر فرصة مساعدة (بلا اسم المستفيدة):
-- عثيم (رقم بطاقة) · سوا كهرباء · سوا إيجار · صندوق العائلة.
-- Safe to re-run. يتطلب family_aid_requests موجوداً مسبقاً.

alter table public.family_aid_requests
  add column if not exists pay_channel text;

alter table public.family_aid_requests
  add column if not exists pay_ref text;

do $chk$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'family_aid_requests_pay_channel_chk'
  ) then
    alter table public.family_aid_requests
      add constraint family_aid_requests_pay_channel_chk
      check (
        pay_channel is null
        or pay_channel in ('othaim_card', 'sawaa_electric', 'sawaa_rent', 'family_fund')
      );
  end if;
end;
$chk$;

create or replace function public.family_aid_normalize_pay_channel_v1(p text)
returns text
language sql
immutable
as $fn$
  select case
    when g in ('othaim_card', 'othaim', 'العثيم', 'عثيم', 'بطاقة العثيم', 'بطاقه العثيم') then 'othaim_card'
    when g in ('sawaa_electric', 'electric', 'كهربا', 'كهرباء', 'سوا كهربا', 'سوا كهرباء') then 'sawaa_electric'
    when g in ('sawaa_rent', 'rent', 'ايجار', 'إيجار', 'سوا ايجار', 'سوا إيجار') then 'sawaa_rent'
    when g in ('family_fund', 'fund', 'صندوق', 'صندوق العائلة') then 'family_fund'
    else null
  end
  from (select lower(btrim(coalesce(p, ''))) as g) s;
$fn$;

grant execute on function public.family_aid_normalize_pay_channel_v1(text) to anon, authenticated;

create or replace function public.family_aid_pay_channel_label_v1(p text)
returns text
language sql
immutable
as $fn$
  select case public.family_aid_normalize_pay_channel_v1(p)
    when 'othaim_card' then 'بطاقة العثيم'
    when 'sawaa_electric' then 'سداد فاتورة سوا — كهرباء'
    when 'sawaa_rent' then 'سداد فاتورة سوا — إيجار'
    when 'family_fund' then 'صندوق العائلة'
    else 'مساهمة عبر الإدارة'
  end;
$fn$;

grant execute on function public.family_aid_pay_channel_label_v1(text) to anon, authenticated;

create or replace function public.public_aid_requests_published_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.published_at desc nulls last, x.id desc)
      from (
        select
          r.id,
          r.situation,
          public.family_aid_situation_label_v1(r.situation) as situation_label,
          -- للعامة: نوع الطلب + الاحتياج فقط (بلا اسم/جوال).
          coalesce(nullif(btrim(r.public_title), ''), public.family_aid_situation_label_v1(r.situation)) as title,
          coalesce(nullif(btrim(r.public_body), ''), r.need_text) as body,
          coalesce(
            nullif(btrim(r.publish_contact_note), ''),
            'ساهم عبر القناة أدناه — بلا تحويل باسم المستفيدة.'
          ) as contact_note,
          public.family_aid_normalize_pay_channel_v1(r.pay_channel) as pay_channel,
          public.family_aid_pay_channel_label_v1(r.pay_channel) as pay_channel_label,
          nullif(btrim(coalesce(r.pay_ref, '')), '') as pay_ref,
          null::text as display_name,
          nullif(btrim(coalesce(r.branch_key, '')), '') as branch_key,
          r.published_at,
          r.created_at
        from public.family_aid_requests r
        where r.status = 'published'
        order by r.published_at desc nulls last, r.id desc
        limit 100
      ) x
    ), '[]'::jsonb)
  );
end;
$fn$;

revoke all on function public.public_aid_requests_published_v1() from public;
grant execute on function public.public_aid_requests_published_v1() to anon, authenticated;

drop function if exists public.admin_aid_request_set_status_v1(text, bigint, text, text, text, text, text);

create or replace function public.admin_aid_request_set_status_v1(
  p_token text,
  p_id bigint,
  p_status text,
  p_admin_note text default null,
  p_public_title text default null,
  p_public_body text default null,
  p_publish_contact_note text default null,
  p_pay_channel text default null,
  p_pay_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_status text;
  v_row public.family_aid_requests%rowtype;
  v_pay text;
begin
  if to_regprocedure('public.admin_token_ok_v1(text)') is null
     or not public.admin_token_ok_v1(p_token) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  if p_id is null or p_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_id');
  end if;

  v_status := lower(btrim(coalesce(p_status, '')));
  if v_status not in ('pending', 'published', 'closed', 'declined') then
    return jsonb_build_object('ok', false, 'error', 'bad_status');
  end if;

  select * into v_row from public.family_aid_requests where id = p_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_pay := public.family_aid_normalize_pay_channel_v1(p_pay_channel);

  update public.family_aid_requests r
  set
    status = v_status,
    admin_note = coalesce(nullif(btrim(coalesce(p_admin_note, '')), ''), r.admin_note),
    public_title = case
      when v_status = 'published' then coalesce(
        nullif(btrim(coalesce(p_public_title, '')), ''),
        nullif(btrim(r.public_title), ''),
        public.family_aid_situation_label_v1(r.situation)
      )
      else r.public_title
    end,
    public_body = case
      when v_status = 'published' then coalesce(
        nullif(btrim(coalesce(p_public_body, '')), ''),
        nullif(btrim(r.public_body), ''),
        r.need_text
      )
      else r.public_body
    end,
    publish_contact_note = case
      when v_status = 'published' then coalesce(
        nullif(btrim(coalesce(p_publish_contact_note, '')), ''),
        nullif(btrim(r.publish_contact_note), ''),
        'ساهم عبر القناة أدناه — بلا تحويل باسم المستفيدة.'
      )
      else r.publish_contact_note
    end,
    pay_channel = case
      when v_status = 'published' then coalesce(v_pay, r.pay_channel, 'family_fund')
      else coalesce(v_pay, r.pay_channel)
    end,
    pay_ref = case
      when p_pay_ref is not null then nullif(btrim(p_pay_ref), '')
      else r.pay_ref
    end,
    published_at = case
      when v_status = 'published' then coalesce(r.published_at, now())
      else r.published_at
    end,
    closed_at = case
      when v_status in ('closed', 'declined') then coalesce(r.closed_at, now())
      else r.closed_at
    end,
    updated_at = now()
  where r.id = p_id;

  return jsonb_build_object('ok', true, 'id', p_id, 'status', v_status);
end;
$fn$;

revoke all on function public.admin_aid_request_set_status_v1(text, bigint, text, text, text, text, text, text, text) from public;
grant execute on function public.admin_aid_request_set_status_v1(text, bigint, text, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.admin_aid_requests_list_v1(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if to_regprocedure('public.admin_token_ok_v1(text)') is null
     or not public.admin_token_ok_v1(p_token) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'rows', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(x) order by
        case x.status when 'pending' then 0 when 'published' then 1 else 2 end,
        x.created_at desc)
      from (
        select
          r.id,
          r.member_phone,
          r.contact_phone,
          r.tree_child_id,
          r.branch_key,
          r.situation,
          public.family_aid_situation_label_v1(r.situation) as situation_label,
          r.need_text,
          r.hide_name,
          r.status,
          r.public_title,
          r.public_body,
          r.publish_contact_note,
          public.family_aid_normalize_pay_channel_v1(r.pay_channel) as pay_channel,
          public.family_aid_pay_channel_label_v1(r.pay_channel) as pay_channel_label,
          nullif(btrim(coalesce(r.pay_ref, '')), '') as pay_ref,
          r.admin_note,
          r.created_at,
          r.updated_at,
          r.published_at,
          r.closed_at,
          coalesce(
            nullif(btrim(c.child_name), ''),
            nullif(btrim(to_jsonb(c)->>'name'), ''),
            nullif(btrim(mp.display_name), ''),
            '—'
          ) as member_name
        from public.family_aid_requests r
        left join public.tree_children c on c.id = r.tree_child_id
        left join lateral (
          select m.display_name
          from public.member_profiles m
          where right(regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g'), 9)
              = right(regexp_replace(coalesce(r.member_phone, ''), '[^0-9]', '', 'g'), 9)
          order by m.updated_at desc nulls last
          limit 1
        ) mp on true
        order by r.created_at desc
        limit 300
      ) x
    ), '[]'::jsonb)
  );
end;
$fn$;

revoke all on function public.admin_aid_requests_list_v1(text) from public;
grant execute on function public.admin_aid_requests_list_v1(text) to anon, authenticated;
