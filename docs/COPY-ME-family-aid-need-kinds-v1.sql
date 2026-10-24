-- COPY-ME: Preset id: maint.family_aid_need_kinds_v1
-- أنواع طلب المساعدة عند الإرسال:
-- بطاقة العثيم · فاتورة كهرباء · عقد إيجار · فاتورة ماء
-- مع خانة الرقم (pay_ref) من العضو مباشرة.
-- Safe to re-run. يتطلب family_aid_requests + قنوات الدفع (pay_channel/pay_ref).

alter table public.family_aid_requests
  add column if not exists pay_channel text;

alter table public.family_aid_requests
  add column if not exists pay_ref text;

alter table public.family_aid_requests
  drop constraint if exists family_aid_requests_pay_channel_chk;

alter table public.family_aid_requests
  add constraint family_aid_requests_pay_channel_chk
  check (
    pay_channel is null
    or pay_channel in (
      'othaim_card',
      'sawaa_electric',
      'sawaa_rent',
      'sawaa_water',
      'family_fund'
    )
  );

create or replace function public.family_aid_normalize_pay_channel_v1(p text)
returns text
language sql
immutable
as $fn$
  select case
    when g in ('othaim_card', 'othaim', 'العثيم', 'عثيم', 'بطاقة العثيم', 'بطاقه العثيم') then 'othaim_card'
    when g in ('sawaa_electric', 'electric', 'كهربا', 'كهرباء', 'سوا كهربا', 'سوا كهرباء', 'فاتورة كهرباء') then 'sawaa_electric'
    when g in ('sawaa_rent', 'rent', 'ايجار', 'إيجار', 'سوا ايجار', 'سوا إيجار', 'عقد إيجار', 'عقد ايجار') then 'sawaa_rent'
    when g in ('sawaa_water', 'water', 'ماء', 'مياه', 'سوا ماء', 'فاتورة ماء') then 'sawaa_water'
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
    when 'sawaa_electric' then 'فاتورة كهرباء (سوا)'
    when 'sawaa_rent' then 'عقد إيجار (سوا)'
    when 'sawaa_water' then 'فاتورة ماء (سوا)'
    when 'family_fund' then 'صندوق العائلة'
    else 'مساهمة عبر الإدارة'
  end;
$fn$;

grant execute on function public.family_aid_pay_channel_label_v1(text) to anon, authenticated;

drop function if exists public.member_aid_request_submit_v1(text, text, text, boolean, text);
drop function if exists public.member_aid_request_submit_v1(text, text, text, boolean, text, text, text);

create or replace function public.member_aid_request_submit_v1(
  p_phone text,
  p_situation text,
  p_need_text text,
  p_hide_name boolean default true,
  p_contact_phone text default null,
  p_pay_channel text default null,
  p_pay_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_phone text;
  v_situation text;
  v_need text;
  v_contact text;
  v_digits text;
  v_pay text;
  v_ref text;
  v_id bigint;
  v_mp record;
begin
  if to_regprocedure('public.member_phone_registered_v1(text)') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing');
  end if;

  v_phone := public.member_phone_registered_v1(p_phone);
  if v_phone is null then
    return jsonb_build_object('ok', false, 'error', 'not_registered');
  end if;

  v_situation := public.family_aid_normalize_situation_v1(p_situation);
  if v_situation is null then
    return jsonb_build_object('ok', false, 'error', 'bad_situation');
  end if;

  v_pay := public.family_aid_normalize_pay_channel_v1(p_pay_channel);
  if v_pay is null or v_pay not in ('othaim_card', 'sawaa_electric', 'sawaa_rent', 'sawaa_water') then
    return jsonb_build_object('ok', false, 'error', 'bad_pay_channel');
  end if;

  v_ref := nullif(btrim(coalesce(p_pay_ref, '')), '');
  if v_ref is null or char_length(v_ref) < 4 then
    return jsonb_build_object('ok', false, 'error', 'pay_ref_required');
  end if;
  if char_length(v_ref) > 80 then
    v_ref := left(v_ref, 80);
  end if;

  v_need := nullif(btrim(coalesce(p_need_text, '')), '');
  if v_need is null then
    v_need := public.family_aid_pay_channel_label_v1(v_pay) || ' — ' || v_ref;
  end if;
  if char_length(v_need) < 8 then
    return jsonb_build_object('ok', false, 'error', 'need_too_short');
  end if;
  if char_length(v_need) > 800 then
    v_need := left(v_need, 800);
  end if;

  v_contact := nullif(btrim(coalesce(p_contact_phone, '')), '');
  if v_contact is null then
    v_contact := v_phone;
  end if;

  v_digits := nullif(right(regexp_replace(coalesce(v_phone, ''), '[^0-9]', '', 'g'), 9), '');
  if to_regclass('public.member_profiles') is not null and v_digits is not null then
    select mp.* into v_mp
    from public.member_profiles mp
    where right(regexp_replace(coalesce(mp.phone, ''), '[^0-9]', '', 'g'), 9) = v_digits
      and coalesce(nullif(btrim(coalesce(mp.status, '')), ''), 'active') is distinct from 'pending_family'
    order by mp.updated_at desc nulls last, mp.id desc
    limit 1;
  end if;

  insert into public.family_aid_requests (
    member_phone,
    tree_child_id,
    branch_key,
    situation,
    need_text,
    hide_name,
    contact_phone,
    pay_channel,
    pay_ref,
    status
  ) values (
    v_phone,
    nullif(v_mp.tree_child_id, 0),
    nullif(btrim(coalesce(v_mp.branch_key, '')), ''),
    v_situation,
    v_need,
    coalesce(p_hide_name, true),
    v_contact,
    v_pay,
    v_ref,
    'pending'
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'pending', 'pay_channel', v_pay);
exception when others then
  return jsonb_build_object('ok', false, 'error', 'insert_failed', 'detail', left(sqlerrm, 160));
end;
$fn$;

revoke all on function public.member_aid_request_submit_v1(text, text, text, boolean, text, text, text) from public;
grant execute on function public.member_aid_request_submit_v1(text, text, text, boolean, text, text, text) to anon, authenticated;

create or replace function public.member_aid_requests_mine_v1(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_phone text;
  v_digits text;
begin
  if to_regprocedure('public.member_phone_registered_v1(text)') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing', 'rows', '[]'::jsonb);
  end if;
  v_phone := public.member_phone_registered_v1(p_phone);
  if v_phone is null then
    return jsonb_build_object('ok', false, 'error', 'not_registered', 'rows', '[]'::jsonb);
  end if;
  v_digits := nullif(right(regexp_replace(coalesce(v_phone, ''), '[^0-9]', '', 'g'), 9), '');

  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select
          r.id,
          r.situation,
          public.family_aid_situation_label_v1(r.situation) as situation_label,
          r.need_text,
          r.hide_name,
          r.status,
          r.public_title,
          r.public_body,
          r.publish_contact_note,
          public.family_aid_normalize_pay_channel_v1(to_jsonb(r)->>'pay_channel') as pay_channel,
          public.family_aid_pay_channel_label_v1(to_jsonb(r)->>'pay_channel') as pay_channel_label,
          nullif(btrim(coalesce(to_jsonb(r)->>'pay_ref', '')), '') as pay_ref,
          r.created_at,
          r.updated_at,
          r.published_at,
          r.closed_at
        from public.family_aid_requests r
        where right(regexp_replace(coalesce(r.member_phone, ''), '[^0-9]', '', 'g'), 9) = v_digits
        order by r.created_at desc
        limit 50
      ) x
    ), '[]'::jsonb)
  );
end;
$fn$;

revoke all on function public.member_aid_requests_mine_v1(text) from public;
grant execute on function public.member_aid_requests_mine_v1(text) to anon, authenticated;
