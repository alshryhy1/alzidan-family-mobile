-- COPY-ME: Preset id: maint.family_admin_session_tighten_v1
-- يمنع ظهور «إدارة العائلة» لغير المخوّل:
-- الصلاحية تُربط بـ tree_child_id فقط (لا تطابق person_id الفضفاض).
-- Safe to re-run.

create or replace function public.family_admin_session_v1(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_digits text;
  v_mp public.member_profiles%rowtype;
  v_grant public.member_role_grants%rowtype;
begin
  v_digits := nullif(right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 9), '');
  if v_digits is null or char_length(v_digits) < 9 then
    return jsonb_build_object('ok', true, 'enabled', false, 'reason', 'bad_phone');
  end if;
  if to_regclass('public.member_profiles') is null or to_regclass('public.member_role_grants') is null then
    return jsonb_build_object('ok', true, 'enabled', false, 'reason', 'no_grants');
  end if;

  select mp.*
    into v_mp
  from public.member_profiles mp
  where coalesce(nullif(btrim(coalesce(mp.status, '')), ''), 'active') = 'active'
    and right(regexp_replace(coalesce(mp.phone, ''), '[^0-9]', '', 'g'), 9) = v_digits
  order by mp.updated_at desc nulls last, mp.id desc
  limit 1;
  if not found then
    return jsonb_build_object('ok', true, 'enabled', false, 'reason', 'not_member');
  end if;

  if coalesce(v_mp.tree_child_id, 0) < 1 then
    return jsonb_build_object('ok', true, 'enabled', false, 'reason', 'no_tree_child');
  end if;

  -- فقط من له منحة نشطة على نفس بطاقة الشجرة — بلا تطابق person_id وحده.
  select g.*
    into v_grant
  from public.member_role_grants g
  where g.role_key = 'family_admin'
    and g.status = 'active'
    and g.tree_child_id = v_mp.tree_child_id
  order by g.updated_at desc nulls last, g.id desc
  limit 1;
  if not found then
    return jsonb_build_object('ok', true, 'enabled', false, 'reason', 'no_grant');
  end if;

  return jsonb_build_object(
    'ok', true,
    'enabled', true,
    'role_key', 'family_admin',
    'tree_child_id', v_grant.tree_child_id,
    'person_id', v_grant.person_id
  );
end;
$fn$;

revoke all on function public.family_admin_session_v1(text) from public;
grant execute on function public.family_admin_session_v1(text) to anon, authenticated;

-- تشخيص: من يملك منحة إدارة العائلة الآن؟
-- select g.tree_child_id, g.status, g.person_id, mp.phone, mp.display_name
-- from public.member_role_grants g
-- left join public.member_profiles mp on mp.tree_child_id = g.tree_child_id
-- where g.role_key = 'family_admin' and g.status = 'active';
