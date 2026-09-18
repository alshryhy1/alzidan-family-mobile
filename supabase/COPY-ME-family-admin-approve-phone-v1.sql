-- اعتماد طلب جوال عضو: يجد الشخص بنفس منطق التحقق عند الإرسال ثم يربط الرقم.
-- شغّله في Supabase SQL Editor بعد family_admin_app_v1.

create or replace function public.family_admin_find_register_name_child_v1(
  p_branch text,
  p_name text
)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_branch text := nullif(btrim(coalesce(p_branch, '')), '');
  v_tokens text[];
  v_id bigint;
  v_count int;
begin
  if v_branch is null then
    return null;
  end if;
  select coalesce(array(
    select t from (
      select public.member_phone_fold_ar_v1(x) as t
      from unnest(regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+')) as x
    ) s
    where t is not null and t not in ('بن', 'ابن')
    limit 3
  ), '{}'::text[]) into v_tokens;
  if coalesce(array_length(v_tokens, 1), 0) < 3 then
    return null;
  end if;

  select count(*)::int, min(c.id)
  into v_count, v_id
  from public.tree_children c
  cross join lateral (
    select
      public.member_phone_fold_ar_v1(
        replace(
          case
            when position('/' in coalesce(c.child_name, c.name, '')) > 0
              then coalesce(c.child_name, c.name, '')
            else btrim(coalesce(c.parent_name, '') || '/' || coalesce(c.child_name, c.name, ''), '/')
          end,
          '/',
          ' '
        )
      ) as hay,
      public.member_phone_fold_ar_v1(
        nullif(btrim(regexp_replace(btrim(coalesce(c.child_name, c.name, '')), '^.*/', '')), '')
      ) as leaf
  ) s
  where btrim(coalesce(c.branch_key, '')) = v_branch
    and s.leaf = v_tokens[1]
    and position(v_tokens[1] in coalesce(s.hay, '')) > 0
    and position(v_tokens[2] in coalesce(s.hay, '')) > 0
    and position(v_tokens[3] in coalesce(s.hay, '')) > 0;

  if v_count = 1 then
    return v_id;
  end if;
  return null;
end;
$fn$;

create or replace function public.family_admin_approve_member_phone_request_v1(
  p_phone text,
  p_request_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_req public.approval_requests%rowtype;
  v_child bigint;
  v_bind jsonb;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate;
  end if;
  if p_request_id is null or p_request_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;

  select * into v_req from public.approval_requests where id = p_request_id limit 1;
  if not found or coalesce(nullif(btrim(v_req.status), ''), 'pending') is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not public.family_admin_request_is_member_v1(v_req.kind, v_req.message) then
    return jsonb_build_object('ok', false, 'error', 'wrong_kind');
  end if;

  v_child := public.family_admin_find_register_name_child_v1(v_req.branch_key, v_req.name);
  if v_child is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'name_not_unique',
      'hint', 'لم يُعثر على شخص واحد في الشجرة بهذا الاسم والفرع — نفس منطق قبول الطلب عند الإرسال.'
    );
  end if;

  v_bind := public.family_admin_request_bind_v1(p_phone, p_request_id, v_child);
  return v_bind || jsonb_build_object('tree_child_id', v_child, 'auto', true);
end;
$fn$;

revoke all on function public.family_admin_find_register_name_child_v1(text, text) from public;
grant execute on function public.family_admin_find_register_name_child_v1(text, text) to anon, authenticated;

revoke all on function public.family_admin_approve_member_phone_request_v1(text, bigint) from public;
grant execute on function public.family_admin_approve_member_phone_request_v1(text, bigint) to anon, authenticated;

notify pgrst, 'reload schema';
