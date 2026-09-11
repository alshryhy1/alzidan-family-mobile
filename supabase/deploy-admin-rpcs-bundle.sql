-- ===== supabase/sql/COPY-ME-family-admin-app-v1.sql =====

-- COPY-ME: Preset id: maint.family_admin_app_v1
-- App family admin: role_key family_admin on existing member_role_grants.
-- No admin_token in the app. Writes require trusted device + grant.
-- Daily: person name/gender/deceased, phones, phone/membership requests, device unbind.
-- Wives, mothers, SQL workspace, import stay on the web. Safe to re-run.

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

  select g.*
    into v_grant
  from public.member_role_grants g
  where g.role_key = 'family_admin'
    and g.status = 'active'
    and (
      (coalesce(v_mp.tree_child_id, 0) > 0 and g.tree_child_id = v_mp.tree_child_id)
      or (v_mp.person_id is not null and g.person_id is not distinct from v_mp.person_id)
    )
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

create or replace function public.family_admin_require_v1(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_session jsonb;
begin
  v_session := public.family_admin_session_v1(p_phone);
  if coalesce((v_session->>'enabled')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  if to_regprocedure('public.member_device_allows_phone_v1(text)') is not null
     and public.member_device_allows_phone_v1(p_phone) is not true then
    return jsonb_build_object('ok', false, 'error', 'device_required');
  end if;
  return v_session;
end;
$fn$;

create or replace function public.admin_family_admin_get_v1(p_token text, p_tree_child_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_grant public.member_role_grants%rowtype;
  v_status text := 'inactive';
  v_child public.tree_children%rowtype;
begin
  if not public.admin_token_ok_v1(p_token) then
    raise exception 'not allowed';
  end if;
  if p_tree_child_id is null or p_tree_child_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'person_not_found');
  end if;
  select * into v_child from public.tree_children c where c.id = p_tree_child_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'person_not_found');
  end if;
  select g.* into v_grant
  from public.member_role_grants g
  where g.tree_child_id = p_tree_child_id and g.role_key = 'family_admin'
  limit 1;
  if found then
    v_status := v_grant.status;
  end if;
  return jsonb_build_object(
    'ok', true,
    'role_key', 'family_admin',
    'status', v_status,
    'tree_child_id', p_tree_child_id,
    'person_id', coalesce(v_grant.person_id, v_child.person_id),
    'assigned_at', v_grant.assigned_at,
    'assigned_by', v_grant.assigned_by
  );
end;
$fn$;

create or replace function public.admin_family_admin_set_v1(
  p_token text,
  p_tree_child_id bigint,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_prev text := 'inactive';
  v_child public.tree_children%rowtype;
  v_now timestamptz := now();
begin
  if not public.admin_token_ok_v1(p_token) then
    raise exception 'not allowed';
  end if;
  if v_action not in ('assign', 'suspend') then
    return jsonb_build_object('ok', false, 'error', 'bad_action');
  end if;
  if p_tree_child_id is null or p_tree_child_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'person_not_found');
  end if;
  select * into v_child from public.tree_children c where c.id = p_tree_child_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'person_not_found');
  end if;
  select g.status into v_prev
  from public.member_role_grants g
  where g.tree_child_id = p_tree_child_id and g.role_key = 'family_admin'
  limit 1;
  v_prev := coalesce(v_prev, 'inactive');

  if v_action = 'assign' then
    insert into public.member_role_grants (
      role_key, tree_child_id, person_id, status, assigned_at, assigned_by, updated_at
    ) values (
      'family_admin', p_tree_child_id, v_child.person_id, 'active', v_now, 'admin', v_now
    )
    on conflict (tree_child_id, role_key) do update
    set
      status = 'active',
      person_id = coalesce(excluded.person_id, public.member_role_grants.person_id),
      assigned_at = v_now,
      assigned_by = 'admin',
      updated_at = v_now;
  else
    if v_prev = 'inactive' then
      return jsonb_build_object('ok', true, 'status', 'inactive', 'action', 'noop');
    end if;
    update public.member_role_grants
    set status = 'suspended', assigned_by = 'admin', updated_at = v_now
    where tree_child_id = p_tree_child_id and role_key = 'family_admin';
  end if;

  return public.admin_family_admin_get_v1(p_token, p_tree_child_id)
    || jsonb_build_object('ok', true, 'action', v_action);
end;
$fn$;

create or replace function public.admin_family_admin_set_by_phone_v1(
  p_token text,
  p_phone text,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_digits text;
  v_id bigint;
begin
  if not public.admin_token_ok_v1(p_token) then
    raise exception 'not allowed';
  end if;
  v_digits := nullif(right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 9), '');
  if v_digits is null then
    return jsonb_build_object('ok', false, 'error', 'bad_phone');
  end if;
  select mp.tree_child_id into v_id
  from public.member_profiles mp
  where coalesce(mp.tree_child_id, 0) > 0
    and right(regexp_replace(coalesce(mp.phone, ''), '[^0-9]', '', 'g'), 9) = v_digits
  order by mp.updated_at desc nulls last, mp.id desc
  limit 1;
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_tree_person');
  end if;
  return public.admin_family_admin_set_v1(p_token, v_id, p_action);
end;
$fn$;

create or replace function public.family_admin_search_people_v1(
  p_phone text,
  p_query text,
  p_branch_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_q text;
  v_branch text;
  v_leaf text;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate || jsonb_build_object('rows', '[]'::jsonb);
  end if;
  v_q := nullif(btrim(coalesce(p_query, '')), '');
  v_branch := nullif(btrim(coalesce(p_branch_key, '')), '');
  if v_q is not null then
    v_q := replace(replace(v_q, '%', ''), '_', '');
  end if;
  if v_q is null or char_length(v_q) < 2 then
    return jsonb_build_object('ok', true, 'need_query', true, 'rows', '[]'::jsonb);
  end if;
  v_leaf := nullif(btrim(regexp_replace(v_q, '^.*/', '')), '');

  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.display_name)
      from (
        select
          c.id,
          c.person_id,
          c.branch_key,
          nullif(btrim(regexp_replace(coalesce(c.child_name, to_jsonb(c)->>'name', ''), '^.*/', '')), '') as display_name,
          nullif(btrim(coalesce(c.child_name, to_jsonb(c)->>'name', '')), '') as path,
          c.gender,
          coalesce(c.is_deceased, false) as is_deceased,
          mp.phone,
          mp.status
        from public.tree_children c
        left join lateral (
          select p.phone, p.status
          from public.member_profiles p
          where p.tree_child_id = c.id
             or (c.person_id is not null and p.person_id is not distinct from c.person_id)
          order by p.updated_at desc nulls last, p.id desc
          limit 1
        ) mp on true
        where (v_branch is null or c.branch_key = v_branch)
          and (
            position(v_q in coalesce(c.child_name, to_jsonb(c)->>'name', '')) > 0
            or coalesce(c.child_name, to_jsonb(c)->>'name', '') ilike '%' || v_q || '%'
            or (
              v_leaf is not null
              and regexp_replace(coalesce(c.child_name, to_jsonb(c)->>'name', ''), '^.*/', '') ilike '%' || v_leaf || '%'
            )
            or exists (
              select 1
              from unnest(regexp_split_to_array(v_q, '\s+')) as w(word)
              where char_length(btrim(w.word)) >= 2
                and coalesce(c.child_name, to_jsonb(c)->>'name', '') ilike '%' || btrim(w.word) || '%'
            )
          )
        order by c.id desc
        limit 40
      ) r
    ), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.family_admin_update_person_v1(
  p_phone text,
  p_tree_child_id bigint,
  p_display_name text,
  p_gender text,
  p_is_deceased boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_child public.tree_children%rowtype;
  v_leaf text;
  v_path text;
  v_new_path text;
  v_gender text;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate;
  end if;
  if p_tree_child_id is null or p_tree_child_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;
  select * into v_child from public.tree_children where id = p_tree_child_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'person_not_found');
  end if;

  v_path := coalesce(v_child.child_name, to_jsonb(v_child)->>'name', '');
  v_leaf := nullif(btrim(coalesce(p_display_name, '')), '');
  if v_leaf is not null then
    v_leaf := regexp_replace(v_leaf, '[/\\]', ' ', 'g');
    if v_path like '%/%' then
      v_new_path := regexp_replace(v_path, '[^/]+$', v_leaf);
    else
      v_new_path := v_leaf;
    end if;
  else
    v_new_path := v_path;
  end if;

  if to_regprocedure('public.tree_child_normalize_gender(text)') is not null then
    v_gender := public.tree_child_normalize_gender(p_gender);
  else
    v_gender := case
      when lower(btrim(coalesce(p_gender, ''))) in ('daughter', 'female', 'f', 'أنثى', 'انثى', 'ابنة', 'بنت') then 'daughter'
      when lower(btrim(coalesce(p_gender, ''))) in ('son', 'male', 'm', 'ذكر', 'ابن', 'ولد') then 'son'
      else null
    end;
  end if;

  update public.tree_children c
  set
    child_name = coalesce(nullif(btrim(v_new_path), ''), c.child_name),
    name = coalesce(nullif(btrim(v_new_path), ''), c.name),
    gender = coalesce(v_gender, c.gender),
    is_deceased = coalesce(p_is_deceased, c.is_deceased, false)
  where c.id = p_tree_child_id;

  return jsonb_build_object('ok', true, 'id', p_tree_child_id);
end;
$fn$;

create or replace function public.family_admin_set_phone_v1(
  p_phone text,
  p_tree_child_id bigint,
  p_member_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_child public.tree_children%rowtype;
  v_bind jsonb;
  v_member_phone text;
  v_digits text;
  v_keep_id bigint;
  v_leaf text;
  v_other_pid text;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate;
  end if;
  if p_tree_child_id is null or p_tree_child_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;
  v_member_phone := nullif(btrim(coalesce(p_member_phone, '')), '');
  if v_member_phone is null then
    return jsonb_build_object('ok', false, 'error', 'bad_phone');
  end if;
  select * into v_child from public.tree_children where id = p_tree_child_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'person_not_found');
  end if;

  if to_regprocedure('public.bind_sender_phone_to_person_v1(text, text, bigint)') is not null then
    v_bind := public.bind_sender_phone_to_person_v1(
      v_member_phone,
      coalesce(v_child.person_id::text, ''),
      v_child.id
    );
    if coalesce((v_bind->>'ok')::boolean, false) is not true then
      return jsonb_build_object('ok', false, 'error', coalesce(v_bind->>'error', 'bind_failed'), 'detail', v_bind);
    end if;
  else
    v_digits := right(regexp_replace(v_member_phone, '[^0-9]', '', 'g'), 9);
    if char_length(coalesce(v_digits, '')) < 9 then
      return jsonb_build_object('ok', false, 'error', 'bad_phone');
    end if;
    v_leaf := nullif(btrim(regexp_replace(coalesce(v_child.child_name, to_jsonb(v_child)->>'name', ''), '^.*/', '')), '');
    select nullif(btrim(coalesce(mp.person_id::text, '')), '')
      into v_other_pid
    from public.member_profiles mp
    where char_length(v_digits) = 9
      and right(regexp_replace(coalesce(mp.phone, ''), '[^0-9]', '', 'g'), 9) = v_digits
    order by mp.id
    limit 1;
    if v_other_pid is not null
       and v_child.person_id is not null
       and v_other_pid is distinct from v_child.person_id::text then
      return jsonb_build_object('ok', false, 'error', 'phone_conflict');
    end if;
    select mp.id into v_keep_id
    from public.member_profiles mp
    where mp.tree_child_id = v_child.id
       or (v_child.person_id is not null and mp.person_id is not distinct from v_child.person_id)
       or (
         char_length(v_digits) = 9
         and right(regexp_replace(coalesce(mp.phone, ''), '[^0-9]', '', 'g'), 9) = v_digits
       )
    order by (mp.tree_child_id is not distinct from v_child.id) desc, mp.id desc
    limit 1;
    if v_keep_id is not null then
      update public.member_profiles
      set
        phone = v_member_phone,
        branch_key = coalesce(nullif(btrim(coalesce(v_child.branch_key, '')), ''), branch_key),
        tree_child_id = v_child.id,
        person_id = v_child.person_id,
        display_name = coalesce(nullif(btrim(coalesce(display_name, '')), ''), v_leaf),
        status = 'active',
        updated_at = now()
      where id = v_keep_id;
    else
      insert into public.member_profiles (
        phone, branch_key, tree_child_id, person_id, display_name, status, created_at, updated_at
      ) values (
        v_member_phone, v_child.branch_key, v_child.id, v_child.person_id, v_leaf, 'active', now(), now()
      );
    end if;
  end if;

  update public.member_profiles
  set status = 'active', updated_at = now()
  where tree_child_id = v_child.id
     or (v_child.person_id is not null and person_id is not distinct from v_child.person_id);

  return jsonb_build_object('ok', true, 'tree_child_id', v_child.id);
end;
$fn$;

create or replace function public.family_admin_requests_list_v1(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate || jsonb_build_object('rows', '[]'::jsonb);
  end if;
  if to_regclass('public.approval_requests') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing', 'rows', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from (
        select
          ar.id,
          ar.request_id,
          ar.kind,
          nullif(btrim(coalesce(ar.name, '')), '') as name,
          nullif(btrim(coalesce(ar.phone, '')), '') as phone,
          nullif(btrim(coalesce(ar.branch_key, '')), '') as branch_key,
          ar.created_at,
          ar.status
        from public.approval_requests ar
        where coalesce(nullif(btrim(ar.status), ''), 'pending') = 'pending'
          and (
            btrim(coalesce(ar.kind, '')) in ('member_registration', 'member_phone_register')
            or position('MEMBER_PHONE_REGISTER_V1' in coalesce(ar.message, '')) > 0
          )
        order by ar.created_at desc nulls last
        limit 80
      ) r
    ), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.family_admin_request_reject_v1(p_phone text, p_request_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_n int := 0;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate;
  end if;
  if p_request_id is null or p_request_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;
  update public.approval_requests
  set status = 'rejected'
  where id = p_request_id
    and coalesce(nullif(btrim(status), ''), 'pending') = 'pending';
  get diagnostics v_n = row_count;
  if v_n < 1 then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'id', p_request_id);
end;
$fn$;

create or replace function public.family_admin_request_bind_v1(
  p_phone text,
  p_request_id bigint,
  p_tree_child_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_req public.approval_requests%rowtype;
  v_set jsonb;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate;
  end if;
  if p_request_id is null or p_request_id < 1 or p_tree_child_id is null or p_tree_child_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;
  select * into v_req from public.approval_requests where id = p_request_id limit 1;
  if not found or coalesce(nullif(btrim(v_req.status), ''), 'pending') is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if nullif(btrim(coalesce(v_req.phone, '')), '') is not null then
    v_set := public.family_admin_set_phone_v1(p_phone, p_tree_child_id, v_req.phone);
    if coalesce((v_set->>'ok')::boolean, false) is not true then
      return v_set;
    end if;
  end if;
  update public.approval_requests set status = 'approved' where id = v_req.id;
  return jsonb_build_object('ok', true, 'id', v_req.id, 'tree_child_id', p_tree_child_id);
end;
$fn$;

create or replace function public.family_admin_devices_list_v1(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate || jsonb_build_object('items', '[]'::jsonb);
  end if;
  if to_regclass('public.member_trusted_devices') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing', 'items', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'ok', true,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'phone_key', d.phone_key,
        'label', d.label,
        'status', d.status,
        'bound_at', d.bound_at,
        'last_seen_at', d.last_seen_at
      ) order by coalesce(d.last_seen_at, d.bound_at) desc)
      from public.member_trusted_devices d
      where d.status = 'active'
    ), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.family_admin_device_unbind_v1(p_phone text, p_target_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_key text;
  v_n int := 0;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate;
  end if;
  if to_regprocedure('public.member_device_phone_key_v1(text)') is not null then
    v_key := public.member_device_phone_key_v1(p_target_phone);
  else
    v_key := nullif(right(regexp_replace(coalesce(p_target_phone, ''), '[^0-9]', '', 'g'), 9), '');
  end if;
  if v_key is null then
    return jsonb_build_object('ok', false, 'error', 'bad_phone');
  end if;
  if to_regclass('public.member_device_transfers') is not null then
    delete from public.member_device_transfers t where t.phone_key = v_key;
  end if;
  delete from public.member_trusted_devices d where d.phone_key = v_key;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'revoked', v_n);
end;
$fn$;

revoke all on function public.family_admin_session_v1(text) from public;
revoke all on function public.family_admin_require_v1(text) from public;
revoke all on function public.admin_family_admin_get_v1(text, bigint) from public;
revoke all on function public.admin_family_admin_set_v1(text, bigint, text) from public;
revoke all on function public.admin_family_admin_set_by_phone_v1(text, text, text) from public;
revoke all on function public.family_admin_search_people_v1(text, text, text) from public;
revoke all on function public.family_admin_update_person_v1(text, bigint, text, text, boolean) from public;
revoke all on function public.family_admin_set_phone_v1(text, bigint, text) from public;
revoke all on function public.family_admin_requests_list_v1(text) from public;
revoke all on function public.family_admin_request_reject_v1(text, bigint) from public;
revoke all on function public.family_admin_request_bind_v1(text, bigint, bigint) from public;
revoke all on function public.family_admin_devices_list_v1(text) from public;
revoke all on function public.family_admin_device_unbind_v1(text, text) from public;

grant execute on function public.family_admin_session_v1(text) to anon, authenticated;
grant execute on function public.admin_family_admin_get_v1(text, bigint) to anon, authenticated;
grant execute on function public.admin_family_admin_set_v1(text, bigint, text) to anon, authenticated;
grant execute on function public.admin_family_admin_set_by_phone_v1(text, text, text) to anon, authenticated;
grant execute on function public.family_admin_search_people_v1(text, text, text) to anon, authenticated;
grant execute on function public.family_admin_update_person_v1(text, bigint, text, text, boolean) to anon, authenticated;
grant execute on function public.family_admin_set_phone_v1(text, bigint, text) to anon, authenticated;
grant execute on function public.family_admin_requests_list_v1(text) to anon, authenticated;
grant execute on function public.family_admin_request_reject_v1(text, bigint) to anon, authenticated;
grant execute on function public.family_admin_request_bind_v1(text, bigint, bigint) to anon, authenticated;
grant execute on function public.family_admin_devices_list_v1(text) to anon, authenticated;
grant execute on function public.family_admin_device_unbind_v1(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
select
  to_regprocedure('public.family_admin_session_v1(text)') is not null as has_session,
  to_regprocedure('public.admin_family_admin_set_by_phone_v1(text, text, text)') is not null as has_grant_by_phone,
  to_regprocedure('public.family_admin_search_people_v1(text, text, text)') is not null as has_search;



-- ===== supabase/sql/COPY-ME-family-admin-delegates-v1.sql =====

-- COPY-ME: Preset id: maint.family_admin_delegates_v1
-- Family admin in the app: accept/reject delegate requests + change delegate
-- roles / enable like the web panel. No admin_token. Trusted device + family_admin.
-- Member phone bind stays as-is. Tree cards, events, wives, SQL stay on the web.
-- Safe to re-run.

create or replace function public.family_admin_request_is_daily_v1(
  p_kind text,
  p_message text,
  p_request_type text
)
returns boolean
language sql
immutable
as $fn$
  select
    btrim(coalesce(p_kind, '')) in (
      'member_registration',
      'member_phone_register',
      'tree_delegate',
      'events_delegate',
      'delegate_secret_reset'
    )
    or position('MEMBER_PHONE_REGISTER_V1' in coalesce(p_message, '')) > 0
    or btrim(coalesce(p_request_type, '')) = 'delegate_secret_reset';
$fn$;

create or replace function public.family_admin_request_is_member_v1(
  p_kind text,
  p_message text
)
returns boolean
language sql
immutable
as $fn$
  select
    btrim(coalesce(p_kind, '')) in ('member_registration', 'member_phone_register')
    or position('MEMBER_PHONE_REGISTER_V1' in coalesce(p_message, '')) > 0;
$fn$;

create or replace function public.family_admin_requests_list_v1(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate || jsonb_build_object('rows', '[]'::jsonb);
  end if;
  if to_regclass('public.approval_requests') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing', 'rows', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from (
        select
          ar.id,
          ar.request_id,
          ar.kind,
          nullif(btrim(coalesce(to_jsonb(ar)->>'request_type', '')), '') as request_type,
          nullif(btrim(coalesce(ar.name, '')), '') as name,
          nullif(btrim(coalesce(ar.phone, '')), '') as phone,
          nullif(btrim(coalesce(ar.branch_key, '')), '') as branch_key,
          ar.created_at,
          ar.status
        from public.approval_requests ar
        where coalesce(nullif(btrim(ar.status), ''), 'pending') = 'pending'
          and public.family_admin_request_is_daily_v1(
            ar.kind,
            ar.message,
            to_jsonb(ar)->>'request_type'
          )
        order by ar.created_at desc nulls last
        limit 120
      ) r
    ), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.family_admin_request_reject_v1(p_phone text, p_request_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_req public.approval_requests%rowtype;
  v_n int := 0;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate;
  end if;
  if p_request_id is null or p_request_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;
  select * into v_req from public.approval_requests where id = p_request_id for update;
  if not found or coalesce(nullif(btrim(v_req.status), ''), 'pending') is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not public.family_admin_request_is_daily_v1(
    v_req.kind,
    v_req.message,
    to_jsonb(v_req)->>'request_type'
  ) then
    return jsonb_build_object('ok', false, 'error', 'wrong_kind');
  end if;

  if btrim(coalesce(v_req.kind, '')) = 'delegate_secret_reset'
     or coalesce(to_jsonb(v_req)->>'request_type', '') = 'delegate_secret_reset' then
    update public.approval_requests
    set
      status = 'rejected',
      request_type = 'delegate_secret_reset',
      wf_state = 'rejected',
      wf_updated_at = now()
    where id = v_req.id;
  else
    update public.approval_requests
    set status = 'rejected'
    where id = v_req.id
      and coalesce(nullif(btrim(status), ''), 'pending') = 'pending';
  end if;
  get diagnostics v_n = row_count;
  if v_n < 1 then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'id', p_request_id, 'kind', v_req.kind);
end;
$fn$;

create or replace function public.family_admin_request_bind_v1(
  p_phone text,
  p_request_id bigint,
  p_tree_child_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_req public.approval_requests%rowtype;
  v_set jsonb;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate;
  end if;
  if p_request_id is null or p_request_id < 1 or p_tree_child_id is null or p_tree_child_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;
  select * into v_req from public.approval_requests where id = p_request_id limit 1;
  if not found or coalesce(nullif(btrim(v_req.status), ''), 'pending') is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not public.family_admin_request_is_member_v1(v_req.kind, v_req.message) then
    return jsonb_build_object('ok', false, 'error', 'wrong_kind');
  end if;
  if nullif(btrim(coalesce(v_req.phone, '')), '') is not null then
    v_set := public.family_admin_set_phone_v1(p_phone, p_tree_child_id, v_req.phone);
    if coalesce((v_set->>'ok')::boolean, false) is not true then
      return v_set;
    end if;
  end if;
  update public.approval_requests set status = 'approved' where id = v_req.id;
  return jsonb_build_object('ok', true, 'id', v_req.id, 'tree_child_id', p_tree_child_id);
end;
$fn$;

create or replace function public.family_admin_request_approve_v1(p_phone text, p_request_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_req public.approval_requests%rowtype;
  v_kind text;
  v_sibling text;
  v_wants_dual boolean := false;
  v_base text;
  v_branch text;
  v_phone_n text;
  v_hash text;
  v_email text;
  v_legacy_n int := 0;
  v_v2_n int := 0;
  v_delegate_id uuid;
  v_act jsonb;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate;
  end if;
  if p_request_id is null or p_request_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;
  select * into v_req from public.approval_requests where id = p_request_id for update;
  if not found or coalesce(nullif(btrim(v_req.status), ''), 'pending') is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not public.family_admin_request_is_daily_v1(
    v_req.kind,
    v_req.message,
    to_jsonb(v_req)->>'request_type'
  ) then
    return jsonb_build_object('ok', false, 'error', 'wrong_kind');
  end if;
  if public.family_admin_request_is_member_v1(v_req.kind, v_req.message) then
    return jsonb_build_object('ok', false, 'error', 'bind_required');
  end if;

  v_kind := btrim(coalesce(v_req.kind, ''));

  if v_kind = 'delegate_secret_reset'
     or coalesce(to_jsonb(v_req)->>'request_type', '') = 'delegate_secret_reset' then
    v_hash := nullif(btrim(coalesce(v_req.secret_hash, '')), '');
    if v_hash is null then
      return jsonb_build_object('ok', false, 'error', 'missing_secret_hash');
    end if;
    if to_regprocedure('public.delegate_secret_reset_norm_branch(text)') is not null then
      v_branch := public.delegate_secret_reset_norm_branch(v_req.branch_key);
      v_phone_n := public.delegate_secret_reset_norm_phone(v_req.phone);
      v_email := public.delegate_secret_reset_norm_email(v_req.email);
    else
      v_branch := regexp_replace(btrim(coalesce(v_req.branch_key, '')), '\s+', ' ', 'g');
      v_phone_n := regexp_replace(btrim(coalesce(v_req.phone, '')), '\s+', '', 'g');
      v_email := lower(regexp_replace(btrim(coalesce(v_req.email, '')), '\s+', '', 'g'));
    end if;

    update public.approval_requests r
    set secret_hash = v_hash
    where r.kind in ('tree_delegate', 'events_delegate')
      and r.status = 'approved'
      and regexp_replace(btrim(coalesce(r.branch_key, '')), '\s+', ' ', 'g') = v_branch
      and regexp_replace(btrim(coalesce(r.phone, '')), '\s+', '', 'g') = v_phone_n
      and (
        v_email = ''
        or lower(regexp_replace(btrim(coalesce(r.email, '')), '\s+', '', 'g')) = ''
        or lower(regexp_replace(btrim(coalesce(r.email, '')), '\s+', '', 'g')) = v_email
      );
    get diagnostics v_legacy_n = row_count;

    if to_regclass('public.delegates_v2') is not null then
      update public.delegates_v2 d
      set secret_hash = v_hash, updated_at = now()
      where regexp_replace(btrim(coalesce(d.branch_key, '')), '\s+', ' ', 'g') = v_branch
        and regexp_replace(btrim(coalesce(d.phone, '')), '\s+', '', 'g') = v_phone_n
        and (
          v_email = ''
          or lower(regexp_replace(btrim(coalesce(d.email, '')), '\s+', '', 'g')) = ''
          or lower(regexp_replace(btrim(coalesce(d.email, '')), '\s+', '', 'g')) = v_email
        );
      get diagnostics v_v2_n = row_count;
    end if;

    if v_legacy_n = 0 and v_v2_n = 0 then
      return jsonb_build_object('ok', false, 'error', 'no_delegate_target');
    end if;

    update public.approval_requests
    set
      status = 'approved',
      secret_hash = v_hash,
      request_type = 'delegate_secret_reset',
      wf_state = 'done',
      wf_updated_at = now()
    where id = v_req.id;

    return jsonb_build_object('ok', true, 'id', v_req.id, 'kind', v_kind, 'secret_reset', true);
  end if;

  if v_kind not in ('tree_delegate', 'events_delegate') then
    return jsonb_build_object('ok', false, 'error', 'wrong_kind');
  end if;

  v_sibling := case when v_kind = 'tree_delegate' then 'events_delegate' else 'tree_delegate' end;
  v_wants_dual :=
    (
      position('"tree_delegate"' in coalesce(v_req.message, '')) > 0
      and position('"events_delegate"' in coalesce(v_req.message, '')) > 0
    )
    or coalesce(v_req.request_id, '') ~* '-(TREE|EVENTS)$';
  v_base := regexp_replace(coalesce(v_req.request_id, ''), '-(TREE|EVENTS)$', '', 'i');
  v_branch := regexp_replace(btrim(coalesce(v_req.branch_key, '')), '\s+', ' ', 'g');
  v_phone_n := regexp_replace(btrim(coalesce(v_req.phone, '')), '\s+', '', 'g');

  update public.approval_requests set status = 'approved' where id = v_req.id;

  if v_wants_dual and v_base <> '' and v_branch <> '' and v_phone_n <> '' then
    update public.approval_requests r
    set status = 'approved'
    where r.id is distinct from v_req.id
      and r.kind = v_sibling
      and coalesce(nullif(btrim(r.status), ''), 'pending') = 'pending'
      and regexp_replace(btrim(coalesce(r.branch_key, '')), '\s+', ' ', 'g') = v_branch
      and regexp_replace(btrim(coalesce(r.phone, '')), '\s+', '', 'g') = v_phone_n
      and (
        regexp_replace(coalesce(r.request_id, ''), '-(TREE|EVENTS)$', '', 'i') = v_base
        or r.request_id = v_base || case when v_sibling = 'tree_delegate' then '-TREE' else '-EVENTS' end
      );
  end if;

  if to_regprocedure('public.delegates_v2_activate_from_request_pk_v1(bigint)') is not null then
    v_act := public.delegates_v2_activate_from_request_pk_v1(v_req.id);
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_req.id,
    'kind', v_kind,
    'role_key', coalesce(v_act->>'role_key', ''),
    'activate', coalesce(v_act, '{}'::jsonb)
  );
end;
$fn$;

create or replace function public.family_admin_delegates_list_v1(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate || jsonb_build_object('rows', '[]'::jsonb, 'roles', '[]'::jsonb);
  end if;
  if to_regclass('public.delegates_v2') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing', 'rows', '[]'::jsonb, 'roles', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.is_enabled desc, x.branch_key, x.name)
      from (
        select
          d.id,
          d.branch_key,
          d.name,
          d.phone,
          d.email,
          d.role_key,
          coalesce(r.title_ar, d.role_key) as role_title_ar,
          coalesce(d.is_enabled, false) as is_enabled
        from public.delegates_v2 d
        left join public.delegate_roles r on r.role_key = d.role_key
        order by d.is_enabled desc, d.branch_key asc nulls last, d.name asc nulls last
        limit 500
      ) x
    ), '[]'::jsonb),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('role_key', r.role_key, 'title_ar', r.title_ar) order by r.sort_order, r.role_key)
      from public.delegate_roles r
    ), jsonb_build_array(
      jsonb_build_object('role_key', 'viewer', 'title_ar', 'عرض فقط'),
      jsonb_build_object('role_key', 'branch_editor', 'title_ar', 'محرر فرع'),
      jsonb_build_object('role_key', 'events_editor', 'title_ar', 'محرر مناسبات'),
      jsonb_build_object('role_key', 'full_delegate', 'title_ar', 'مندوب كامل'),
      jsonb_build_object('role_key', 'approver_l1', 'title_ar', 'معتمد مرحلة 1')
    ))
  );
end;
$fn$;

create or replace function public.family_admin_delegates_set_role_v1(
  p_phone text,
  p_id text,
  p_role_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_id uuid;
  v_role text;
  v_branch text;
  v_prev text;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate;
  end if;
  begin
    v_id := nullif(btrim(coalesce(p_id, '')), '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end;
  v_role := nullif(btrim(coalesce(p_role_key, '')), '');
  if v_id is null or v_role is null then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;
  if to_regclass('public.delegates_v2') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing');
  end if;
  if to_regclass('public.delegate_roles') is not null
     and not exists (select 1 from public.delegate_roles where role_key = v_role) then
    return jsonb_build_object('ok', false, 'error', 'unknown_role');
  end if;

  select role_key, branch_key into v_prev, v_branch
  from public.delegates_v2
  where id = v_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  update public.delegates_v2
  set role_key = v_role, updated_at = now()
  where id = v_id;

  begin
    perform public.admin_audit_write_v1(
      'family_admin', null, 'delegate.role_set', 'delegates_v2', v_id::text, v_branch,
      jsonb_build_object('role_key', v_role, 'previous_role_key', v_prev, 'at', now())
    );
  exception when others then null;
  end;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'role_key', v_role,
    'previous_role_key', v_prev
  );
end;
$fn$;

create or replace function public.family_admin_delegates_set_enabled_v1(
  p_phone text,
  p_id text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_id uuid;
  v_row public.delegates_v2%rowtype;
  v_status text;
  v_branch text;
  v_phone_n text;
  v_email text;
begin
  v_gate := public.family_admin_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate;
  end if;
  begin
    v_id := nullif(btrim(coalesce(p_id, '')), '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end;
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;
  if to_regclass('public.delegates_v2') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing');
  end if;

  select * into v_row from public.delegates_v2 where id = v_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_status := case when coalesce(p_enabled, false) then 'approved' else 'rejected' end;
  v_branch := regexp_replace(btrim(coalesce(v_row.branch_key, '')), '\s+', ' ', 'g');
  v_phone_n := regexp_replace(btrim(coalesce(v_row.phone, '')), '\s+', '', 'g');
  v_email := lower(regexp_replace(btrim(coalesce(v_row.email, '')), '\s+', '', 'g'));

  if to_regclass('public.approval_requests') is not null then
    if nullif(btrim(coalesce(v_row.tree_request_id, '')), '') is not null then
      update public.approval_requests
      set status = v_status
      where request_id = v_row.tree_request_id
        and kind = 'tree_delegate';
    end if;
    if nullif(btrim(coalesce(v_row.events_request_id, '')), '') is not null then
      update public.approval_requests
      set status = v_status
      where request_id = v_row.events_request_id
        and kind = 'events_delegate';
    end if;
    if nullif(v_branch, '') is not null and nullif(v_phone_n, '') is not null then
      update public.approval_requests r
      set status = v_status
      where r.kind in ('tree_delegate', 'events_delegate')
        and regexp_replace(btrim(coalesce(r.branch_key, '')), '\s+', ' ', 'g') = v_branch
        and regexp_replace(btrim(coalesce(r.phone, '')), '\s+', '', 'g') = v_phone_n
        and (
          v_email = ''
          or lower(regexp_replace(btrim(coalesce(r.email, '')), '\s+', '', 'g')) = ''
          or lower(regexp_replace(btrim(coalesce(r.email, '')), '\s+', '', 'g')) = v_email
        );
    end if;
  end if;

  update public.delegates_v2
  set is_enabled = coalesce(p_enabled, false),
      updated_at = now()
  where id = v_id;

  begin
    perform public.admin_audit_write_v1(
      'family_admin', null,
      case when coalesce(p_enabled, false) then 'delegate.enable' else 'delegate.disable' end,
      'delegates_v2', v_id::text, v_row.branch_key,
      jsonb_build_object(
        'enabled', coalesce(p_enabled, false),
        'role_key', v_row.role_key,
        'phone', v_row.phone,
        'email', v_row.email,
        'at', now()
      )
    );
  exception when others then null;
  end;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'is_enabled', coalesce(p_enabled, false)
  );
end;
$fn$;

revoke all on function public.family_admin_request_is_daily_v1(text, text, text) from public;
revoke all on function public.family_admin_request_is_member_v1(text, text) from public;
revoke all on function public.family_admin_requests_list_v1(text) from public;
revoke all on function public.family_admin_request_reject_v1(text, bigint) from public;
revoke all on function public.family_admin_request_bind_v1(text, bigint, bigint) from public;
revoke all on function public.family_admin_request_approve_v1(text, bigint) from public;
revoke all on function public.family_admin_delegates_list_v1(text) from public;
revoke all on function public.family_admin_delegates_set_role_v1(text, text, text) from public;
revoke all on function public.family_admin_delegates_set_enabled_v1(text, text, boolean) from public;

grant execute on function public.family_admin_request_is_daily_v1(text, text, text) to anon, authenticated;
grant execute on function public.family_admin_request_is_member_v1(text, text) to anon, authenticated;
grant execute on function public.family_admin_requests_list_v1(text) to anon, authenticated;
grant execute on function public.family_admin_request_reject_v1(text, bigint) to anon, authenticated;
grant execute on function public.family_admin_request_bind_v1(text, bigint, bigint) to anon, authenticated;
grant execute on function public.family_admin_request_approve_v1(text, bigint) to anon, authenticated;
grant execute on function public.family_admin_delegates_list_v1(text) to anon, authenticated;
grant execute on function public.family_admin_delegates_set_role_v1(text, text, text) to anon, authenticated;
grant execute on function public.family_admin_delegates_set_enabled_v1(text, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
select
  to_regprocedure('public.family_admin_request_approve_v1(text, bigint)') is not null as has_approve,
  to_regprocedure('public.family_admin_delegates_list_v1(text)') is not null as has_delegates_list,
  to_regprocedure('public.family_admin_delegates_set_role_v1(text, text, text)') is not null as has_set_role;



-- ===== supabase/sql/COPY-ME-women-manager-phone-requests-v1.sql =====

-- COPY-ME: Preset id: maint.women_manager_phone_requests_v1
-- Women manager: list phone-register requests, search daughters, bind+activate.
-- No admin_token. No tree_children name/parent/branch writes.
-- Safe to re-run.

create or replace function public.women_manager_phone_requests_v1(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_session jsonb;
begin
  if to_regprocedure('public.women_manager_session_v1(text)') is null
     or to_regclass('public.approval_requests') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing', 'rows', '[]'::jsonb);
  end if;

  v_session := public.women_manager_session_v1(p_phone);
  if coalesce((v_session->>'enabled')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'rows', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from (
        select
          ar.id,
          ar.request_id,
          nullif(btrim(coalesce(ar.name, '')), '') as name,
          nullif(btrim(coalesce(ar.phone, '')), '') as phone,
          nullif(btrim(coalesce(ar.branch_key, '')), '') as branch_key,
          ar.created_at,
          ar.status
        from public.approval_requests ar
        where coalesce(nullif(btrim(ar.status), ''), 'pending') = 'pending'
          and (
            btrim(coalesce(ar.kind, '')) in ('member_registration', 'member_phone_register')
            or position('MEMBER_PHONE_REGISTER_V1' in coalesce(ar.message, '')) > 0
          )
        order by ar.created_at desc nulls last
        limit 80
      ) r
    ), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.women_manager_search_members_v1(
  p_phone text,
  p_query text,
  p_branch_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_session jsonb;
  v_q text;
  v_branch text;
begin
  if to_regprocedure('public.women_manager_session_v1(text)') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing', 'rows', '[]'::jsonb);
  end if;

  v_session := public.women_manager_session_v1(p_phone);
  if coalesce((v_session->>'enabled')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'rows', '[]'::jsonb);
  end if;

  v_q := nullif(btrim(coalesce(p_query, '')), '');
  v_branch := nullif(btrim(coalesce(p_branch_key, '')), '');
  if v_q is not null then
    v_q := replace(replace(v_q, '%', ''), '_', '');
  end if;

  if v_q is null or char_length(v_q) < 2 then
    return jsonb_build_object('ok', true, 'need_query', true, 'rows', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.display_name)
      from (
        select
          c.id,
          c.person_id,
          c.branch_key,
          nullif(
            btrim(regexp_replace(coalesce(c.child_name, to_jsonb(c)->>'name', ''), '^.*/', '')),
            ''
          ) as display_name,
          nullif(btrim(coalesce(c.child_name, to_jsonb(c)->>'name', '')), '') as path,
          (
            select mp.phone
            from public.member_profiles mp
            where mp.tree_child_id = c.id
               or (c.person_id is not null and mp.person_id is not distinct from c.person_id)
            order by mp.updated_at desc nulls last, mp.id desc
            limit 1
          ) as phone
        from public.tree_children c
        where public.member_role_is_daughter_gender_v1(c.gender)
          and (v_branch is null or c.branch_key = v_branch)
          and (
            position(v_q in coalesce(c.child_name, to_jsonb(c)->>'name', '')) > 0
            or coalesce(c.child_name, to_jsonb(c)->>'name', '') ilike '%' || v_q || '%'
          )
        order by c.id desc
        limit 25
      ) r
    ), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.women_manager_bind_phone_v1(
  p_phone text,
  p_request_id bigint,
  p_tree_child_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_session jsonb;
  v_req public.approval_requests%rowtype;
  v_child public.tree_children%rowtype;
  v_bind jsonb;
  v_req_phone text;
  v_digits text;
  v_keep_id bigint;
  v_leaf text;
  v_other_pid text;
begin
  if to_regprocedure('public.women_manager_session_v1(text)') is null
     or to_regclass('public.approval_requests') is null
     or to_regclass('public.member_profiles') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing');
  end if;

  v_session := public.women_manager_session_v1(p_phone);
  if coalesce((v_session->>'enabled')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  if p_request_id is null or p_request_id < 1 or p_tree_child_id is null or p_tree_child_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;

  select * into v_req from public.approval_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'request_not_found');
  end if;

  if coalesce(nullif(btrim(v_req.status), ''), 'pending') is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_pending');
  end if;

  if not (
    btrim(coalesce(v_req.kind, '')) in ('member_registration', 'member_phone_register')
    or position('MEMBER_PHONE_REGISTER_V1' in coalesce(v_req.message, '')) > 0
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_phone_request');
  end if;

  v_req_phone := nullif(btrim(coalesce(v_req.phone, '')), '');
  if v_req_phone is null then
    return jsonb_build_object('ok', false, 'error', 'bad_phone');
  end if;

  select * into v_child from public.tree_children where id = p_tree_child_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'person_not_found');
  end if;

  if not public.member_role_is_daughter_gender_v1(v_child.gender) then
    return jsonb_build_object('ok', false, 'error', 'not_daughter');
  end if;

  if to_regprocedure('public.bind_sender_phone_to_person_v1(text, text, bigint)') is not null then
    v_bind := public.bind_sender_phone_to_person_v1(
      v_req_phone,
      coalesce(v_child.person_id::text, ''),
      v_child.id
    );
    if coalesce((v_bind->>'ok')::boolean, false) is not true then
      return jsonb_build_object(
        'ok', false,
        'error', coalesce(v_bind->>'error', 'bind_failed'),
        'detail', v_bind
      );
    end if;
  else
    v_digits := right(regexp_replace(v_req_phone, '[^0-9]', '', 'g'), 9);
    v_leaf := nullif(
      btrim(regexp_replace(coalesce(v_child.child_name, to_jsonb(v_child)->>'name', ''), '^.*/', '')),
      ''
    );

    select nullif(btrim(coalesce(mp.person_id::text, '')), '')
      into v_other_pid
    from public.member_profiles mp
    where char_length(v_digits) = 9
      and right(regexp_replace(coalesce(mp.phone, ''), '[^0-9]', '', 'g'), 9) = v_digits
    order by mp.id
    limit 1;
    if v_other_pid is not null
       and v_child.person_id is not null
       and v_other_pid is distinct from v_child.person_id::text then
      return jsonb_build_object('ok', false, 'error', 'phone_conflict', 'other_person_id', v_other_pid);
    end if;

    select mp.id into v_keep_id
    from public.member_profiles mp
    where mp.tree_child_id = v_child.id
       or (v_child.person_id is not null and mp.person_id is not distinct from v_child.person_id)
       or (
         char_length(v_digits) = 9
         and right(regexp_replace(coalesce(mp.phone, ''), '[^0-9]', '', 'g'), 9) = v_digits
       )
    order by (mp.tree_child_id is not distinct from v_child.id) desc, mp.id desc
    limit 1;

    if v_keep_id is not null then
      update public.member_profiles
      set
        phone = v_req_phone,
        branch_key = coalesce(nullif(btrim(coalesce(v_child.branch_key, '')), ''), branch_key),
        tree_child_id = v_child.id,
        person_id = v_child.person_id,
        display_name = coalesce(nullif(btrim(coalesce(display_name, '')), ''), v_leaf),
        status = 'active',
        updated_at = now()
      where id = v_keep_id;
    else
      insert into public.member_profiles (
        phone, branch_key, tree_child_id, person_id, display_name, status, created_at, updated_at
      ) values (
        v_req_phone, v_child.branch_key, v_child.id, v_child.person_id, v_leaf, 'active', now(), now()
      );
    end if;
    v_bind := jsonb_build_object('ok', true, 'action', 'upserted');
  end if;

  update public.member_profiles
  set status = 'active', updated_at = now()
  where tree_child_id = v_child.id
     or (v_child.person_id is not null and person_id is not distinct from v_child.person_id);

  update public.approval_requests
  set status = 'approved'
  where id = v_req.id;

  begin
    if to_regprocedure('public.admin_audit_write_v1(text,text,text,text,text,text,jsonb)') is not null then
      perform public.admin_audit_write_v1(
        'women_manager',
        v_session->>'tree_child_id',
        'women_manager.phone_bind',
        'approval_request',
        v_req.id::text,
        v_req.branch_key,
        jsonb_build_object(
          'request_id', v_req.request_id,
          'tree_child_id', v_child.id,
          'person_id', v_child.person_id
        )
      );
    end if;
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_req.id,
    'tree_child_id', v_child.id,
    'person_id', v_child.person_id,
    'bind', v_bind
  );
end;
$fn$;

revoke all on function public.women_manager_phone_requests_v1(text) from public;
revoke all on function public.women_manager_search_members_v1(text, text, text) from public;
revoke all on function public.women_manager_bind_phone_v1(text, bigint, bigint) from public;

grant execute on function public.women_manager_phone_requests_v1(text) to anon, authenticated;
grant execute on function public.women_manager_search_members_v1(text, text, text) to anon, authenticated;
grant execute on function public.women_manager_bind_phone_v1(text, bigint, bigint) to anon, authenticated;

notify pgrst, 'reload schema';

select
  to_regprocedure('public.women_manager_phone_requests_v1(text)') is not null as has_list,
  to_regprocedure('public.women_manager_search_members_v1(text, text, text)') is not null as has_search,
  to_regprocedure('public.women_manager_bind_phone_v1(text, bigint, bigint)') is not null as has_bind;



-- ===== supabase/sql/COPY-ME-women-manager-members-v1.sql =====

-- COPY-ME: Preset id: maint.women_manager_members_v1
-- Women manager: search daughters, set phone, activate membership.
-- No admin_token. No tree_children name/parent/branch writes.
-- Safe to re-run.

create or replace function public.women_manager_search_members_v1(
  p_phone text,
  p_query text,
  p_branch_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_session jsonb;
  v_q text;
  v_branch text;
begin
  if to_regprocedure('public.women_manager_session_v1(text)') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing', 'rows', '[]'::jsonb);
  end if;

  v_session := public.women_manager_session_v1(p_phone);
  if coalesce((v_session->>'enabled')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'rows', '[]'::jsonb);
  end if;

  v_q := nullif(btrim(coalesce(p_query, '')), '');
  v_branch := nullif(btrim(coalesce(p_branch_key, '')), '');
  if v_q is not null then
    v_q := replace(replace(v_q, '%', ''), '_', '');
  end if;

  if v_q is null or char_length(v_q) < 2 then
    return jsonb_build_object('ok', true, 'need_query', true, 'rows', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.display_name)
      from (
        select
          c.id,
          c.person_id,
          c.branch_key,
          nullif(
            btrim(regexp_replace(coalesce(c.child_name, to_jsonb(c)->>'name', ''), '^.*/', '')),
            ''
          ) as display_name,
          nullif(btrim(coalesce(c.child_name, to_jsonb(c)->>'name', '')), '') as path,
          mp.phone,
          mp.status
        from public.tree_children c
        left join lateral (
          select p.phone, p.status
          from public.member_profiles p
          where p.tree_child_id = c.id
             or (c.person_id is not null and p.person_id is not distinct from c.person_id)
          order by p.updated_at desc nulls last, p.id desc
          limit 1
        ) mp on true
        where public.member_role_is_daughter_gender_v1(c.gender)
          and (v_branch is null or c.branch_key = v_branch)
          and (
            position(v_q in coalesce(c.child_name, to_jsonb(c)->>'name', '')) > 0
            or coalesce(c.child_name, to_jsonb(c)->>'name', '') ilike '%' || v_q || '%'
          )
        order by c.id desc
        limit 25
      ) r
    ), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.women_manager_set_member_phone_v1(
  p_phone text,
  p_tree_child_id bigint,
  p_member_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_session jsonb;
  v_child public.tree_children%rowtype;
  v_bind jsonb;
  v_member_phone text;
  v_digits text;
  v_keep_id bigint;
  v_leaf text;
  v_other_pid text;
begin
  if to_regprocedure('public.women_manager_session_v1(text)') is null
     or to_regclass('public.member_profiles') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing');
  end if;

  v_session := public.women_manager_session_v1(p_phone);
  if coalesce((v_session->>'enabled')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  if p_tree_child_id is null or p_tree_child_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;

  v_member_phone := nullif(btrim(coalesce(p_member_phone, '')), '');
  if v_member_phone is null then
    return jsonb_build_object('ok', false, 'error', 'bad_phone');
  end if;

  select * into v_child from public.tree_children where id = p_tree_child_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'person_not_found');
  end if;

  if not public.member_role_is_daughter_gender_v1(v_child.gender) then
    return jsonb_build_object('ok', false, 'error', 'not_daughter');
  end if;

  if to_regprocedure('public.bind_sender_phone_to_person_v1(text, text, bigint)') is not null then
    v_bind := public.bind_sender_phone_to_person_v1(
      v_member_phone,
      coalesce(v_child.person_id::text, ''),
      v_child.id
    );
    if coalesce((v_bind->>'ok')::boolean, false) is not true then
      return jsonb_build_object(
        'ok', false,
        'error', coalesce(v_bind->>'error', 'bind_failed'),
        'detail', v_bind
      );
    end if;
  else
    v_digits := right(regexp_replace(v_member_phone, '[^0-9]', '', 'g'), 9);
    if char_length(coalesce(v_digits, '')) < 9 then
      return jsonb_build_object('ok', false, 'error', 'bad_phone');
    end if;
    v_leaf := nullif(
      btrim(regexp_replace(coalesce(v_child.child_name, to_jsonb(v_child)->>'name', ''), '^.*/', '')),
      ''
    );

    select nullif(btrim(coalesce(mp.person_id::text, '')), '')
      into v_other_pid
    from public.member_profiles mp
    where char_length(v_digits) = 9
      and right(regexp_replace(coalesce(mp.phone, ''), '[^0-9]', '', 'g'), 9) = v_digits
    order by mp.id
    limit 1;
    if v_other_pid is not null
       and v_child.person_id is not null
       and v_other_pid is distinct from v_child.person_id::text then
      return jsonb_build_object('ok', false, 'error', 'phone_conflict', 'other_person_id', v_other_pid);
    end if;

    select mp.id into v_keep_id
    from public.member_profiles mp
    where mp.tree_child_id = v_child.id
       or (v_child.person_id is not null and mp.person_id is not distinct from v_child.person_id)
       or (
         char_length(v_digits) = 9
         and right(regexp_replace(coalesce(mp.phone, ''), '[^0-9]', '', 'g'), 9) = v_digits
       )
    order by (mp.tree_child_id is not distinct from v_child.id) desc, mp.id desc
    limit 1;

    if v_keep_id is not null then
      update public.member_profiles
      set
        phone = v_member_phone,
        branch_key = coalesce(nullif(btrim(coalesce(v_child.branch_key, '')), ''), branch_key),
        tree_child_id = v_child.id,
        person_id = v_child.person_id,
        display_name = coalesce(nullif(btrim(coalesce(display_name, '')), ''), v_leaf),
        status = 'active',
        updated_at = now()
      where id = v_keep_id;
    else
      insert into public.member_profiles (
        phone, branch_key, tree_child_id, person_id, display_name, status, created_at, updated_at
      ) values (
        v_member_phone, v_child.branch_key, v_child.id, v_child.person_id, v_leaf, 'active', now(), now()
      );
    end if;
    v_bind := jsonb_build_object('ok', true, 'action', 'upserted');
  end if;

  update public.member_profiles
  set status = 'active', updated_at = now()
  where tree_child_id = v_child.id
     or (v_child.person_id is not null and person_id is not distinct from v_child.person_id);

  begin
    if to_regprocedure('public.admin_audit_write_v1(text,text,text,text,text,text,jsonb)') is not null then
      perform public.admin_audit_write_v1(
        'women_manager',
        v_session->>'tree_child_id',
        'women_manager.member_phone',
        'member_profile',
        v_child.id::text,
        v_child.branch_key,
        jsonb_build_object(
          'tree_child_id', v_child.id,
          'person_id', v_child.person_id
        )
      );
    end if;
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'tree_child_id', v_child.id,
    'person_id', v_child.person_id,
    'bind', v_bind
  );
end;
$fn$;

revoke all on function public.women_manager_search_members_v1(text, text, text) from public;
revoke all on function public.women_manager_set_member_phone_v1(text, bigint, text) from public;

grant execute on function public.women_manager_search_members_v1(text, text, text) to anon, authenticated;
grant execute on function public.women_manager_set_member_phone_v1(text, bigint, text) to anon, authenticated;

notify pgrst, 'reload schema';

select
  to_regprocedure('public.women_manager_search_members_v1(text, text, text)') is not null as has_search,
  to_regprocedure('public.women_manager_set_member_phone_v1(text, bigint, text)') is not null as has_set_phone;



-- ===== supabase/sql/COPY-ME-women-manager-mothers-v1.sql =====

-- COPY-ME: Preset id: maint.women_manager_mothers_v1
-- Women manager: mother -> child already in tree_children via tree_mother_links.
-- Does not insert tree_children. Does not write tree_spouses. Does not use tree_external_offspring.
-- Safe to re-run.

create or replace function public.women_manager_mother_spouse_ids_v1(p_mother_id bigint)
returns table(spouse_id bigint)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_mother public.tree_children%rowtype;
  v_path text;
  v_leaf text;
  v_fold_path text;
  v_fold_leaf text;
begin
  if p_mother_id is null or p_mother_id < 1 then
    return;
  end if;
  if to_regclass('public.tree_spouses') is null
     or to_regprocedure('public.women_member_name_fold_v1(text)') is null then
    return;
  end if;

  select * into v_mother from public.tree_children where id = p_mother_id limit 1;
  if not found then
    return;
  end if;
  if not public.member_role_is_daughter_gender_v1(v_mother.gender) then
    return;
  end if;

  v_path := nullif(btrim(coalesce(v_mother.child_name, to_jsonb(v_mother)->>'name', '')), '');
  if to_regprocedure('public.women_member_leaf_name_v1(text)') is not null then
    v_leaf := public.women_member_leaf_name_v1(v_path);
  else
    v_leaf := nullif(btrim(reverse(split_part(reverse(coalesce(v_path, '')), chr(47), 1))), '');
  end if;
  v_fold_path := public.women_member_name_fold_v1(replace(coalesce(v_path, ''), chr(47), ' '));
  v_fold_leaf := public.women_member_name_fold_v1(v_leaf);

  return query
  select s.id
  from public.tree_spouses s
  where coalesce(s.wife_is_family_member, false) = true
    and (
      (
        v_mother.person_id is not null
        and nullif(to_jsonb(s)->>'wife_person_id', '') is not distinct from v_mother.person_id::text
      )
      or (
        v_fold_path is not null
        and public.women_member_name_fold_v1(replace(coalesce(s.wife_lineage, ''), chr(47), ' '))
          is not distinct from v_fold_path
      )
      or (
        v_fold_leaf is not null
        and public.women_member_name_fold_v1(
          case
            when to_regprocedure('public.women_member_leaf_name_v1(text)') is not null
              then public.women_member_leaf_name_v1(coalesce(s.wife_name, s.wife_lineage))
            else reverse(split_part(reverse(coalesce(s.wife_name, s.wife_lineage, '')), chr(47), 1))
          end
        ) is not distinct from v_fold_leaf
        and (
          nullif(btrim(coalesce(s.wife_branch_key, '')), '') is null
          or s.wife_branch_key is not distinct from v_mother.branch_key
        )
      )
    )
  order by
    case when lower(btrim(coalesce(s.status, 'active'))) in ('', 'active') then 0 else 1 end,
    s.id;
end;
$fn$;

create or replace function public.women_manager_mother_children_v1(
  p_phone text,
  p_mother_tree_child_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_session jsonb;
  v_mother public.tree_children%rowtype;
  v_spouses int := 0;
begin
  if to_regprocedure('public.women_manager_session_v1(text)') is null
     or to_regclass('public.tree_mother_links') is null
     or to_regprocedure('public.women_member_leaf_name_v1(text)') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing');
  end if;

  v_session := public.women_manager_session_v1(p_phone);
  if coalesce((v_session->>'enabled')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  if p_mother_tree_child_id is null or p_mother_tree_child_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;

  select * into v_mother from public.tree_children where id = p_mother_tree_child_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'person_not_found');
  end if;
  if not public.member_role_is_daughter_gender_v1(v_mother.gender) then
    return jsonb_build_object('ok', false, 'error', 'not_daughter');
  end if;

  select count(*)::int into v_spouses
  from public.women_manager_mother_spouse_ids_v1(v_mother.id);

  return jsonb_build_object(
    'ok', true,
    'mother_id', v_mother.id,
    'spouses', v_spouses,
    'no_spouse', v_spouses < 1,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.display_name)
      from (
        select
          c.id,
          c.person_id,
          c.branch_key,
          public.women_member_leaf_name_v1(coalesce(c.child_name, to_jsonb(c)->>'name', '')) as display_name,
          nullif(btrim(coalesce(c.child_name, to_jsonb(c)->>'name', '')), '') as path,
          l.spouse_id
        from public.tree_mother_links l
        join public.tree_children c on c.id = l.child_id
        where l.spouse_id in (
          select s.spouse_id from public.women_manager_mother_spouse_ids_v1(v_mother.id) s
        )
        order by c.id desc
        limit 80
      ) r
    ), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.women_manager_search_tree_people_v1(
  p_phone text,
  p_query text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_session jsonb;
  v_q text;
begin
  v_session := public.women_manager_session_v1(p_phone);
  if coalesce((v_session->>'enabled')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'rows', '[]'::jsonb);
  end if;

  v_q := replace(replace(nullif(btrim(coalesce(p_query, '')), ''), '%', ''), '_', '');
  if v_q is null or char_length(v_q) < 2 then
    return jsonb_build_object('ok', true, 'need_query', true, 'rows', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.display_name)
      from (
        select
          c.id,
          c.person_id,
          c.branch_key,
          public.women_member_leaf_name_v1(coalesce(c.child_name, to_jsonb(c)->>'name', '')) as display_name,
          nullif(btrim(coalesce(c.child_name, to_jsonb(c)->>'name', '')), '') as path
        from public.tree_children c
        where
          position(v_q in coalesce(c.child_name, to_jsonb(c)->>'name', '')) > 0
          or coalesce(c.child_name, to_jsonb(c)->>'name', '') ilike '%' || v_q || '%'
        order by c.id desc
        limit 25
      ) r
    ), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.women_manager_link_mother_v1(
  p_phone text,
  p_mother_tree_child_id bigint,
  p_child_tree_child_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_session jsonb;
  v_mother public.tree_children%rowtype;
  v_child public.tree_children%rowtype;
  v_father_id bigint;
  v_spouse public.tree_spouses%rowtype;
  v_existing public.tree_mother_links%rowtype;
  v_n int := 0;
begin
  if to_regprocedure('public.women_manager_session_v1(text)') is null
     or to_regclass('public.tree_mother_links') is null
     or to_regclass('public.tree_spouses') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing');
  end if;

  v_session := public.women_manager_session_v1(p_phone);
  if coalesce((v_session->>'enabled')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  if p_mother_tree_child_id is null or p_mother_tree_child_id < 1
     or p_child_tree_child_id is null or p_child_tree_child_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;
  if p_mother_tree_child_id = p_child_tree_child_id then
    return jsonb_build_object('ok', false, 'error', 'self_link');
  end if;

  select * into v_mother from public.tree_children where id = p_mother_tree_child_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'person_not_found');
  end if;
  if not public.member_role_is_daughter_gender_v1(v_mother.gender) then
    return jsonb_build_object('ok', false, 'error', 'not_daughter');
  end if;

  select * into v_child from public.tree_children where id = p_child_tree_child_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'child_not_found');
  end if;

  select count(*)::int into v_n
  from public.women_manager_mother_spouse_ids_v1(v_mother.id);
  if v_n < 1 then
    return jsonb_build_object('ok', false, 'error', 'no_spouse');
  end if;

  select f.id
    into v_father_id
  from public.tree_children f
  where (
      v_child.parent_person_id is not null
      and f.person_id is not distinct from v_child.parent_person_id
    )
    or coalesce(f.child_name, to_jsonb(f)->>'name', '')
         is not distinct from coalesce(v_child.parent_name, to_jsonb(v_child)->>'parent', '')
  order by
    case
      when v_child.parent_person_id is not null
       and f.person_id is not distinct from v_child.parent_person_id then 0
      else 1
    end,
    f.id
  limit 1;

  select s.*
    into v_spouse
  from public.tree_spouses s
  where s.id in (select x.spouse_id from public.women_manager_mother_spouse_ids_v1(v_mother.id) x)
    and (
      (v_father_id is not null and s.husband_id is not distinct from v_father_id)
      or (v_father_id is null and v_n = 1)
    )
  order by
    case when lower(btrim(coalesce(s.status, 'active'))) in ('', 'active') then 0 else 1 end,
    s.id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_spouse');
  end if;

  select * into v_existing from public.tree_mother_links where child_id = v_child.id limit 1;
  if found then
    if v_existing.spouse_id is not distinct from v_spouse.id then
      return jsonb_build_object('ok', true, 'action', 'existing', 'child_id', v_child.id);
    end if;
    if exists (
      select 1 from public.women_manager_mother_spouse_ids_v1(v_mother.id) x
      where x.spouse_id = v_existing.spouse_id
    ) then
      return jsonb_build_object('ok', true, 'action', 'existing', 'child_id', v_child.id);
    end if;
    return jsonb_build_object('ok', false, 'error', 'already_linked');
  end if;

  insert into public.tree_mother_links (
    child_id, spouse_id, mother_name, mother_is_family_member,
    mother_branch_key, mother_family_name, mother_lineage, confidence, updated_at
  ) values (
    v_child.id,
    v_spouse.id,
    coalesce(v_spouse.wife_name, public.women_member_leaf_name_v1(coalesce(v_mother.child_name, to_jsonb(v_mother)->>'name', ''))),
    true,
    coalesce(v_spouse.wife_branch_key, v_mother.branch_key),
    v_spouse.wife_family_name,
    coalesce(v_spouse.wife_lineage, v_mother.child_name),
    'confirmed',
    now()
  );

  begin
    if to_regprocedure('public.admin_audit_write_v1(text,text,text,text,text,text,jsonb)') is not null then
      perform public.admin_audit_write_v1(
        'women_manager',
        v_session->>'tree_child_id',
        'women_manager.mother_link',
        'tree_mother_link',
        v_child.id::text,
        v_child.branch_key,
        jsonb_build_object(
          'mother_id', v_mother.id,
          'child_id', v_child.id,
          'spouse_id', v_spouse.id
        )
      );
    end if;
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true, 'action', 'linked', 'child_id', v_child.id, 'spouse_id', v_spouse.id);
end;
$fn$;

create or replace function public.women_manager_unlink_mother_v1(
  p_phone text,
  p_mother_tree_child_id bigint,
  p_child_tree_child_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_session jsonb;
  v_deleted int := 0;
begin
  v_session := public.women_manager_session_v1(p_phone);
  if coalesce((v_session->>'enabled')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  if p_mother_tree_child_id is null or p_mother_tree_child_id < 1
     or p_child_tree_child_id is null or p_child_tree_child_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;

  delete from public.tree_mother_links l
  where l.child_id = p_child_tree_child_id
    and l.spouse_id in (
      select x.spouse_id from public.women_manager_mother_spouse_ids_v1(p_mother_tree_child_id) x
    );
  get diagnostics v_deleted = row_count;
  if v_deleted < 1 then
    return jsonb_build_object('ok', false, 'error', 'not_linked');
  end if;
  return jsonb_build_object('ok', true, 'child_id', p_child_tree_child_id);
end;
$fn$;

revoke all on function public.women_manager_mother_spouse_ids_v1(bigint) from public;
revoke all on function public.women_manager_mother_children_v1(text, bigint) from public;
revoke all on function public.women_manager_search_tree_people_v1(text, text) from public;
revoke all on function public.women_manager_link_mother_v1(text, bigint, bigint) from public;
revoke all on function public.women_manager_unlink_mother_v1(text, bigint, bigint) from public;

grant execute on function public.women_manager_mother_children_v1(text, bigint) to anon, authenticated;
grant execute on function public.women_manager_search_tree_people_v1(text, text) to anon, authenticated;
grant execute on function public.women_manager_link_mother_v1(text, bigint, bigint) to anon, authenticated;
grant execute on function public.women_manager_unlink_mother_v1(text, bigint, bigint) to anon, authenticated;

notify pgrst, 'reload schema';

select
  to_regprocedure('public.women_manager_link_mother_v1(text, bigint, bigint)') is not null as has_link,
  to_regprocedure('public.women_manager_mother_children_v1(text, bigint)') is not null as has_list;



-- ===== supabase/sql/COPY-ME-women-manager-search-match-v1.sql =====

-- COPY-ME: Preset id: maint.women_manager_search_match_v1
-- Patch after women_pending_family_v1: find names like نوف even if gender is empty,
-- and match a typed full name to a slash path in the tree.
-- Safe to re-run. No block comments.

create or replace function public.women_manager_search_members_v1(
  p_phone text,
  p_query text,
  p_branch_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_session jsonb;
  v_q text;
  v_q_fold text;
  v_branch text;
  v_tree jsonb := '[]'::jsonb;
  v_pending jsonb := '[]'::jsonb;
begin
  if to_regprocedure('public.women_manager_session_v1(text)') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing', 'rows', '[]'::jsonb);
  end if;

  v_session := public.women_manager_session_v1(p_phone);
  if coalesce((v_session->>'enabled')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'rows', '[]'::jsonb);
  end if;

  v_q := nullif(btrim(coalesce(p_query, '')), '');
  v_branch := nullif(btrim(coalesce(p_branch_key, '')), '');
  if v_q is not null then
    v_q := replace(replace(v_q, '%', ''), '_', '');
  end if;

  if v_q is null or char_length(v_q) < 2 then
    return jsonb_build_object('ok', true, 'need_query', true, 'rows', '[]'::jsonb);
  end if;
  v_q_fold := public.women_member_name_fold_v1(v_q);

  begin
  select coalesce(jsonb_agg(to_jsonb(r) order by r.display_name), '[]'::jsonb)
    into v_tree
  from (
    select
      c.id,
      (
        select p.id from public.member_profiles p
        where p.tree_child_id = c.id
           or (c.person_id is not null and p.person_id is not distinct from c.person_id)
        order by p.updated_at desc nulls last, p.id desc
        limit 1
      ) as member_id,
      c.person_id,
      c.branch_key,
      public.women_member_leaf_name_v1(coalesce(c.child_name, to_jsonb(c)->>'name', '')) as display_name,
      nullif(btrim(coalesce(c.child_name, to_jsonb(c)->>'name', '')), '') as path,
      mp.phone,
      mp.status,
      'tree'::text as kind
    from public.tree_children c
    left join lateral (
      select p.phone, p.status
      from public.member_profiles p
      where p.tree_child_id = c.id
         or (c.person_id is not null and p.person_id is not distinct from c.person_id)
      order by p.updated_at desc nulls last, p.id desc
      limit 1
    ) mp on true
    where lower(btrim(coalesce(c.gender, ''))) not in ('son', 'male', 'm', 'ذكر', 'ابن', 'ولد')
      and (v_branch is null or c.branch_key = v_branch)
      and (
        position(v_q in coalesce(c.child_name, to_jsonb(c)->>'name', '')) > 0
        or coalesce(c.child_name, to_jsonb(c)->>'name', '') ilike '%' || v_q || '%'
        or public.women_member_leaf_name_v1(coalesce(c.child_name, to_jsonb(c)->>'name', '')) ilike '%' || v_q || '%'
        or (
          v_q_fold is not null
          and position(
            v_q_fold in coalesce(public.women_member_name_fold_v1(
              public.women_member_leaf_name_v1(coalesce(c.child_name, to_jsonb(c)->>'name', ''))
            ), '')
          ) > 0
        )
      )
    order by c.id desc
    limit 25
  ) r;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.display_name), '[]'::jsonb)
    into v_pending
  from (
    select
      0::bigint as id,
      mp.id as member_id,
      mp.person_id,
      mp.branch_key,
      mp.display_name,
      null::text as path,
      mp.phone,
      mp.status,
      'pending'::text as kind
    from public.member_profiles mp
    where coalesce(mp.tree_child_id, 0) = 0
      and coalesce(nullif(btrim(coalesce(mp.status, '')), ''), '') = 'pending_family'
      and (
        position(v_q in coalesce(mp.display_name, '')) > 0
        or coalesce(mp.display_name, '') ilike '%' || v_q || '%'
        or (
          v_q_fold is not null
          and position(
            v_q_fold in public.women_member_name_fold_v1(replace(coalesce(mp.display_name, ''), chr(47), ' '))
          ) > 0
        )
      )
    order by mp.id desc
    limit 25
  ) r;

  return jsonb_build_object(
    'ok', true,
    'rows', coalesce(v_tree, '[]'::jsonb) || coalesce(v_pending, '[]'::jsonb)
  );
  exception
    when query_canceled then
      return jsonb_build_object('ok', false, 'error', 'timeout', 'rows', '[]'::jsonb);
    when others then
      return jsonb_build_object('ok', false, 'error', 'timeout', 'rows', '[]'::jsonb);
  end;
end;
$fn$;

create or replace function public.women_manager_add_member_v1(
  p_phone text,
  p_full_name text,
  p_member_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_session jsonb;
  v_name text;
  v_fold text;
  v_member_phone text;
  v_digits text;
  v_existing public.member_profiles%rowtype;
  v_n int := 0;
  v_child_id bigint;
  v_keep_id bigint;
  v_leaf_tok text;
begin
  if to_regprocedure('public.women_manager_session_v1(text)') is null
     or to_regclass('public.member_profiles') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing');
  end if;

  v_session := public.women_manager_session_v1(p_phone);
  if coalesce((v_session->>'enabled')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  v_name := nullif(btrim(coalesce(p_full_name, '')), '');
  if v_name is null or char_length(v_name) < 2 then
    return jsonb_build_object('ok', false, 'error', 'bad_name');
  end if;
  v_fold := public.women_member_name_fold_v1(v_name);
  v_leaf_tok := nullif(btrim(reverse(split_part(reverse(coalesce(v_fold, '')), ' ', 1))), '');

  v_member_phone := nullif(btrim(coalesce(p_member_phone, '')), '');
  if v_member_phone is not null then
    v_digits := right(regexp_replace(v_member_phone, '[^0-9]', '', 'g'), 9);
    if char_length(coalesce(v_digits, '')) < 9 then
      return jsonb_build_object('ok', false, 'error', 'bad_phone');
    end if;
  end if;

  if v_digits is not null then
    select mp.* into v_existing
    from public.member_profiles mp
    where char_length(right(regexp_replace(coalesce(mp.phone, ''), '[^0-9]', '', 'g'), 9)) = 9
      and right(regexp_replace(coalesce(mp.phone, ''), '[^0-9]', '', 'g'), 9) = v_digits
    order by (coalesce(mp.tree_child_id, 0) > 0) desc, mp.id
    limit 1;
    if found then
      if coalesce(v_existing.tree_child_id, 0) > 0 then
        return jsonb_build_object(
          'ok', false,
          'error', 'phone_conflict',
          'tree_child_id', v_existing.tree_child_id
        );
      end if;
      if coalesce(v_existing.status, '') = 'pending_family' then
        update public.member_profiles
        set
          display_name = coalesce(nullif(btrim(coalesce(display_name, '')), ''), v_name),
          phone = v_member_phone,
          status = 'pending_family',
          updated_at = now()
        where id = v_existing.id;
        return jsonb_build_object(
          'ok', true,
          'action', 'existing_pending',
          'member_id', v_existing.id,
          'kind', 'pending'
        );
      end if;
      return jsonb_build_object('ok', false, 'error', 'phone_conflict');
    end if;
  end if;

  select mp.* into v_existing
  from public.member_profiles mp
  where coalesce(mp.tree_child_id, 0) = 0
    and coalesce(mp.status, '') = 'pending_family'
    and public.women_member_name_fold_v1(mp.display_name) is not distinct from v_fold
  order by mp.id
  limit 1;
  if found then
    if v_member_phone is not null then
      update public.member_profiles
      set phone = v_member_phone, updated_at = now()
      where id = v_existing.id
        and nullif(btrim(coalesce(phone, '')), '') is null;
    end if;
    return jsonb_build_object(
      'ok', true,
      'action', 'existing_pending',
      'member_id', v_existing.id,
      'kind', 'pending'
    );
  end if;

  begin
    insert into public.member_profiles (
      phone, branch_key, tree_child_id, person_id, display_name, status, created_at, updated_at
    ) values (
      v_member_phone, null, null, null, v_name, 'pending_family', now(), now()
    )
    returning id into v_keep_id;
  exception
    when not_null_violation then
      begin
        insert into public.member_profiles (
          phone, branch_key, display_name, status, created_at, updated_at
        ) values (
          coalesce(v_member_phone, ''), null, v_name, 'pending_family', now(), now()
        )
        returning id into v_keep_id;
      exception when others then
        return jsonb_build_object('ok', false, 'error', 'save_failed');
      end;
    when unique_violation then
      select mp.* into v_existing
      from public.member_profiles mp
      where coalesce(mp.tree_child_id, 0) = 0
        and public.women_member_name_fold_v1(mp.display_name) is not distinct from v_fold
      order by mp.id
      limit 1;
      if found then
        return jsonb_build_object(
          'ok', true,
          'action', 'existing_pending',
          'member_id', v_existing.id,
          'kind', 'pending'
        );
      end if;
      return jsonb_build_object('ok', false, 'error', 'save_failed');
    when others then
      begin
        insert into public.member_profiles (phone, display_name, status, created_at, updated_at)
        values (coalesce(v_member_phone, ''), v_name, 'pending_family', now(), now())
        returning id into v_keep_id;
      exception when others then
        return jsonb_build_object('ok', false, 'error', 'save_failed');
      end;
  end;

  if v_keep_id is null then
    return jsonb_build_object('ok', false, 'error', 'save_failed');
  end if;

  begin
    if to_regprocedure('public.admin_audit_write_v1(text,text,text,text,text,text,jsonb)') is not null then
      perform public.admin_audit_write_v1(
        'women_manager',
        v_session->>'tree_child_id',
        'women_manager.member_add_pending',
        'member_profile',
        v_keep_id::text,
        null,
        jsonb_build_object('display_name', v_name, 'has_phone', v_member_phone is not null)
      );
    end if;
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'action', 'created_pending',
    'member_id', v_keep_id,
    'kind', 'pending'
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', 'save_failed');
end;
$fn$;

revoke all on function public.women_manager_search_members_v1(text, text, text) from public;
revoke all on function public.women_manager_add_member_v1(text, text, text) from public;
grant execute on function public.women_manager_search_members_v1(text, text, text) to anon, authenticated;
grant execute on function public.women_manager_add_member_v1(text, text, text) to anon, authenticated;
notify pgrst, 'reload schema';
select to_regprocedure('public.women_manager_add_member_v1(text, text, text)') is not null as has_add;



-- ===== supabase/sql/COPY-ME-delegate-app-inbox-v1.sql =====

-- COPY-ME: Preset id: maint.delegate_app_inbox_v1
-- Approved branch delegate inbox in the native app.
-- Identity: trusted device + enabled delegates_v2 row. No website secret.
-- Scope: that branch only. Not family_admin. Not women_manager.
-- Daily: list pending branch requests; approve/reject; bind phone requests
-- to a person in the same branch. Tree editor and events publisher stay on web.
-- Safe to re-run.

create or replace function public.delegate_app_phone_key_v1(p_phone text)
returns text
language plpgsql
immutable
as $fn$
begin
  return nullif(right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 9), '');
end;
$fn$;

create or replace function public.delegate_app_branch_key_v1(p_branch text)
returns text
language plpgsql
immutable
as $fn$
begin
  return nullif(btrim(coalesce(p_branch, '')), '');
end;
$fn$;

create or replace function public.delegate_app_kind_lane_v1(p_kind text, p_message text)
returns text
language plpgsql
immutable
as $fn$
declare
  v_kind text := btrim(coalesce(p_kind, ''));
  v_msg text := coalesce(p_message, '');
begin
  if v_kind in (
    'tree_delegate', 'events_delegate', 'delegate_secret_reset',
    'special_card', 'events_audit', 'tree_audit'
  ) then
    return 'none';
  end if;
  if v_kind in ('member_registration', 'member_phone_register')
     or position('MEMBER_PHONE_REGISTER_V1' in v_msg) > 0 then
    return 'phone';
  end if;
  if v_kind in (
    'event_card', 'family_event', 'event_request',
    'occasion', 'patient', 'health', 'event_death'
  ) then
    return 'events';
  end if;
  if v_kind in (
    'tree_card', 'tree_edit', 'memory_card',
    'add_person', 'memory', 'tree_founder'
  ) then
    return 'tree';
  end if;
  return 'none';
end;
$fn$;

create or replace function public.delegate_app_can_read_lane_v1(p_role text, p_lane text)
returns boolean
language plpgsql
immutable
as $fn$
declare
  v_role text := btrim(coalesce(p_role, ''));
  v_lane text := btrim(coalesce(p_lane, ''));
begin
  if v_lane is null or v_lane = '' or v_lane = 'none' then
    return false;
  end if;
  if v_role = 'full_delegate' then
    return true;
  end if;
  if v_role = 'branch_editor' then
    return v_lane in ('tree', 'phone');
  end if;
  if v_role = 'events_editor' then
    return v_lane = 'events';
  end if;
  return false;
end;
$fn$;

create or replace function public.delegate_app_can_write_lane_v1(p_role text, p_lane text)
returns boolean
language plpgsql
immutable
as $fn$
begin
  return public.delegate_app_can_read_lane_v1(p_role, p_lane);
end;
$fn$;

create or replace function public.delegate_app_session_v1(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_digits text;
  v_row public.delegates_v2%rowtype;
  v_role text;
  v_branch text;
begin
  v_digits := public.delegate_app_phone_key_v1(p_phone);
  if v_digits is null or char_length(v_digits) < 9 then
    return jsonb_build_object('ok', true, 'enabled', false, 'reason', 'bad_phone');
  end if;
  if to_regclass('public.delegates_v2') is null then
    return jsonb_build_object('ok', true, 'enabled', false, 'reason', 'no_table');
  end if;

  select d.*
    into v_row
  from public.delegates_v2 d
  where coalesce(d.is_enabled, false) is true
    and public.delegate_app_phone_key_v1(d.phone) = v_digits
    and btrim(coalesce(d.role_key, '')) in ('branch_editor', 'events_editor', 'full_delegate')
  order by d.updated_at desc nulls last, d.created_at desc nulls last
  limit 1;
  if not found then
    return jsonb_build_object('ok', true, 'enabled', false, 'reason', 'no_delegate');
  end if;

  v_role := btrim(coalesce(v_row.role_key, ''));
  v_branch := public.delegate_app_branch_key_v1(v_row.branch_key);
  if v_branch is null then
    return jsonb_build_object('ok', true, 'enabled', false, 'reason', 'no_branch');
  end if;

  return jsonb_build_object(
    'ok', true,
    'enabled', true,
    'branch_key', v_branch,
    'role_key', v_role,
    'name', nullif(btrim(coalesce(v_row.name, '')), ''),
    'can_tree', public.delegate_app_can_write_lane_v1(v_role, 'tree'),
    'can_events', public.delegate_app_can_write_lane_v1(v_role, 'events'),
    'can_phone', public.delegate_app_can_write_lane_v1(v_role, 'phone')
  );
end;
$fn$;

create or replace function public.delegate_app_require_v1(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_session jsonb;
begin
  v_session := public.delegate_app_session_v1(p_phone);
  if coalesce((v_session->>'enabled')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  if to_regprocedure('public.member_device_allows_phone_v1(text)') is not null
     and public.member_device_allows_phone_v1(p_phone) is not true then
    return jsonb_build_object('ok', false, 'error', 'device_required');
  end if;
  return v_session;
end;
$fn$;

create or replace function public.delegate_app_requests_list_v1(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_branch text;
  v_role text;
begin
  v_gate := public.delegate_app_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate || jsonb_build_object('rows', '[]'::jsonb);
  end if;
  if to_regclass('public.approval_requests') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing', 'rows', '[]'::jsonb);
  end if;
  v_branch := v_gate->>'branch_key';
  v_role := v_gate->>'role_key';
  return jsonb_build_object(
    'ok', true,
    'branch_key', v_branch,
    'role_key', v_role,
    'can_tree', coalesce((v_gate->>'can_tree')::boolean, false),
    'can_events', coalesce((v_gate->>'can_events')::boolean, false),
    'can_phone', coalesce((v_gate->>'can_phone')::boolean, false),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from (
        select
          ar.id,
          ar.request_id,
          ar.kind,
          public.delegate_app_kind_lane_v1(ar.kind, ar.message) as lane,
          nullif(btrim(coalesce(ar.name, '')), '') as name,
          nullif(btrim(coalesce(ar.phone, '')), '') as phone,
          nullif(btrim(coalesce(ar.branch_key, '')), '') as branch_key,
          ar.created_at,
          ar.status,
          nullif(btrim(left(
            regexp_replace(
              split_part(coalesce(ar.message, ''), '__JSON__', 1),
              E'[\\n\\r]+',
              ' · ',
              'g'
            ),
            280
          )), '') as detail
        from public.approval_requests ar
        where coalesce(nullif(btrim(ar.status), ''), 'pending') = 'pending'
          and public.delegate_app_branch_key_v1(ar.branch_key) = v_branch
          and public.delegate_app_can_read_lane_v1(
            v_role,
            public.delegate_app_kind_lane_v1(ar.kind, ar.message)
          )
        order by ar.created_at desc nulls last
        limit 80
      ) r
    ), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.delegate_app_request_set_v1(
  p_phone text,
  p_request_id bigint,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_req public.approval_requests%rowtype;
  v_status text;
  v_lane text;
  v_branch text;
  v_role text;
  v_reviewer text;
  v_stamp text;
  v_msg text;
  v_n int := 0;
begin
  v_gate := public.delegate_app_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate;
  end if;
  v_status := case
    when lower(btrim(coalesce(p_status, ''))) = 'approved' then 'approved'
    when lower(btrim(coalesce(p_status, ''))) = 'rejected' then 'rejected'
    else null
  end;
  if v_status is null or p_request_id is null or p_request_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;

  select * into v_req from public.approval_requests where id = p_request_id limit 1;
  if not found or coalesce(nullif(btrim(v_req.status), ''), 'pending') is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_branch := v_gate->>'branch_key';
  v_role := v_gate->>'role_key';
  if public.delegate_app_branch_key_v1(v_req.branch_key) is distinct from v_branch then
    return jsonb_build_object('ok', false, 'error', 'wrong_branch');
  end if;
  v_lane := public.delegate_app_kind_lane_v1(v_req.kind, v_req.message);
  if v_lane = 'phone' then
    return jsonb_build_object('ok', false, 'error', 'bind_required');
  end if;
  if not public.delegate_app_can_write_lane_v1(v_role, v_lane) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  v_reviewer := nullif(btrim(coalesce(v_gate->>'name', '')), '');
  if v_reviewer is not null then
    v_stamp := E'\n---\nتمت مراجعة الطلب بواسطة المندوب: ' || v_reviewer || '.';
  else
    v_stamp := E'\n---\nتمت مراجعة الطلب بواسطة مندوب الفرع.';
  end if;
  v_msg := coalesce(v_req.message, '');
  if position('تمت مراجعة الطلب بواسطة' in v_msg) = 0 then
    v_msg := v_msg || v_stamp;
  end if;

  update public.approval_requests
  set status = v_status, message = v_msg
  where id = v_req.id
    and coalesce(nullif(btrim(status), ''), 'pending') = 'pending';
  get diagnostics v_n = row_count;
  if v_n < 1 then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'id', v_req.id, 'status', v_status);
end;
$fn$;

create or replace function public.delegate_app_search_people_v1(
  p_phone text,
  p_query text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_q text;
  v_branch text;
begin
  v_gate := public.delegate_app_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate || jsonb_build_object('rows', '[]'::jsonb);
  end if;
  if coalesce((v_gate->>'can_phone')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'rows', '[]'::jsonb);
  end if;
  v_branch := v_gate->>'branch_key';
  v_q := replace(replace(nullif(btrim(coalesce(p_query, '')), ''), '%', ''), '_', '');
  if v_q is null or char_length(v_q) < 2 then
    return jsonb_build_object('ok', true, 'need_query', true, 'rows', '[]'::jsonb);
  end if;
  if to_regclass('public.tree_children') is null then
    return jsonb_build_object('ok', false, 'error', 'sql_missing', 'rows', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.display_name)
      from (
        select
          c.id,
          c.person_id,
          c.branch_key,
          nullif(btrim(regexp_replace(coalesce(c.child_name, to_jsonb(c)->>'name', ''), '^.*/', '')), '') as display_name,
          nullif(btrim(coalesce(c.child_name, to_jsonb(c)->>'name', '')), '') as path,
          c.gender,
          coalesce(c.is_deceased, false) as is_deceased,
          mp.phone,
          mp.status
        from public.tree_children c
        left join lateral (
          select p.phone, p.status
          from public.member_profiles p
          where p.tree_child_id = c.id
             or (c.person_id is not null and p.person_id is not distinct from c.person_id)
          order by p.updated_at desc nulls last, p.id desc
          limit 1
        ) mp on true
        where public.delegate_app_branch_key_v1(c.branch_key) = v_branch
          and (
            position(v_q in coalesce(c.child_name, to_jsonb(c)->>'name', '')) > 0
            or coalesce(c.child_name, to_jsonb(c)->>'name', '') ilike '%' || v_q || '%'
          )
        order by c.id desc
        limit 40
      ) r
    ), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.delegate_app_request_bind_v1(
  p_phone text,
  p_request_id bigint,
  p_tree_child_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_gate jsonb;
  v_req public.approval_requests%rowtype;
  v_child public.tree_children%rowtype;
  v_lane text;
  v_branch text;
  v_member_phone text;
  v_bind jsonb;
  v_digits text;
  v_keep_id bigint;
  v_leaf text;
  v_other_pid text;
  v_reviewer text;
  v_stamp text;
  v_msg text;
begin
  v_gate := public.delegate_app_require_v1(p_phone);
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate;
  end if;
  if coalesce((v_gate->>'can_phone')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  if p_request_id is null or p_request_id < 1 or p_tree_child_id is null or p_tree_child_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_input');
  end if;

  select * into v_req from public.approval_requests where id = p_request_id limit 1;
  if not found or coalesce(nullif(btrim(v_req.status), ''), 'pending') is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_branch := v_gate->>'branch_key';
  v_lane := public.delegate_app_kind_lane_v1(v_req.kind, v_req.message);
  if v_lane is distinct from 'phone' then
    return jsonb_build_object('ok', false, 'error', 'not_phone');
  end if;
  if public.delegate_app_branch_key_v1(v_req.branch_key) is distinct from v_branch then
    return jsonb_build_object('ok', false, 'error', 'wrong_branch');
  end if;

  select * into v_child from public.tree_children where id = p_tree_child_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'person_not_found');
  end if;
  if public.delegate_app_branch_key_v1(v_child.branch_key) is distinct from v_branch then
    return jsonb_build_object('ok', false, 'error', 'wrong_branch');
  end if;

  v_member_phone := nullif(btrim(coalesce(v_req.phone, '')), '');
  if v_member_phone is null then
    return jsonb_build_object('ok', false, 'error', 'bad_phone');
  end if;

  if to_regprocedure('public.bind_sender_phone_to_person_v1(text, text, bigint)') is not null then
    v_bind := public.bind_sender_phone_to_person_v1(
      v_member_phone,
      coalesce(v_child.person_id::text, ''),
      v_child.id
    );
    if coalesce((v_bind->>'ok')::boolean, false) is not true then
      return jsonb_build_object('ok', false, 'error', coalesce(v_bind->>'error', 'bind_failed'), 'detail', v_bind);
    end if;
  else
    v_digits := public.delegate_app_phone_key_v1(v_member_phone);
    if v_digits is null then
      return jsonb_build_object('ok', false, 'error', 'bad_phone');
    end if;
    v_leaf := nullif(btrim(regexp_replace(coalesce(v_child.child_name, to_jsonb(v_child)->>'name', ''), '^.*/', '')), '');
    select nullif(btrim(coalesce(mp.person_id::text, '')), '')
      into v_other_pid
    from public.member_profiles mp
    where public.delegate_app_phone_key_v1(mp.phone) = v_digits
    order by mp.id
    limit 1;
    if v_other_pid is not null
       and v_child.person_id is not null
       and v_other_pid is distinct from v_child.person_id::text then
      return jsonb_build_object('ok', false, 'error', 'phone_conflict');
    end if;
    select mp.id into v_keep_id
    from public.member_profiles mp
    where mp.tree_child_id = v_child.id
       or (v_child.person_id is not null and mp.person_id is not distinct from v_child.person_id)
       or public.delegate_app_phone_key_v1(mp.phone) = v_digits
    order by (mp.tree_child_id is not distinct from v_child.id) desc, mp.id desc
    limit 1;
    if v_keep_id is not null then
      update public.member_profiles
      set
        phone = v_member_phone,
        branch_key = coalesce(nullif(btrim(coalesce(v_child.branch_key, '')), ''), branch_key),
        tree_child_id = v_child.id,
        person_id = v_child.person_id,
        display_name = coalesce(nullif(btrim(coalesce(display_name, '')), ''), v_leaf),
        status = 'active',
        updated_at = now()
      where id = v_keep_id;
    else
      insert into public.member_profiles (
        phone, branch_key, tree_child_id, person_id, display_name, status, created_at, updated_at
      ) values (
        v_member_phone, v_child.branch_key, v_child.id, v_child.person_id, v_leaf, 'active', now(), now()
      );
    end if;
  end if;

  update public.member_profiles
  set status = 'active', updated_at = now()
  where tree_child_id = v_child.id
     or (v_child.person_id is not null and person_id is not distinct from v_child.person_id);

  v_reviewer := nullif(btrim(coalesce(v_gate->>'name', '')), '');
  if v_reviewer is not null then
    v_stamp := E'\n---\nتمت مراجعة الطلب بواسطة المندوب: ' || v_reviewer || '.';
  else
    v_stamp := E'\n---\nتمت مراجعة الطلب بواسطة مندوب الفرع.';
  end if;
  v_msg := coalesce(v_req.message, '');
  if position('تمت مراجعة الطلب بواسطة' in v_msg) = 0 then
    v_msg := v_msg || v_stamp;
  end if;

  update public.approval_requests
  set status = 'approved', message = v_msg
  where id = v_req.id
    and coalesce(nullif(btrim(status), ''), 'pending') = 'pending';

  return jsonb_build_object('ok', true, 'id', v_req.id, 'tree_child_id', v_child.id);
end;
$fn$;

revoke all on function public.delegate_app_phone_key_v1(text) from public;
revoke all on function public.delegate_app_branch_key_v1(text) from public;
revoke all on function public.delegate_app_kind_lane_v1(text, text) from public;
revoke all on function public.delegate_app_can_read_lane_v1(text, text) from public;
revoke all on function public.delegate_app_can_write_lane_v1(text, text) from public;
revoke all on function public.delegate_app_session_v1(text) from public;
revoke all on function public.delegate_app_require_v1(text) from public;
revoke all on function public.delegate_app_requests_list_v1(text) from public;
revoke all on function public.delegate_app_request_set_v1(text, bigint, text) from public;
revoke all on function public.delegate_app_search_people_v1(text, text) from public;
revoke all on function public.delegate_app_request_bind_v1(text, bigint, bigint) from public;

grant execute on function public.delegate_app_session_v1(text) to anon, authenticated;
grant execute on function public.delegate_app_requests_list_v1(text) to anon, authenticated;
grant execute on function public.delegate_app_request_set_v1(text, bigint, text) to anon, authenticated;
grant execute on function public.delegate_app_search_people_v1(text, text) to anon, authenticated;
grant execute on function public.delegate_app_request_bind_v1(text, bigint, bigint) to anon, authenticated;

notify pgrst, 'reload schema';
select
  to_regprocedure('public.delegate_app_session_v1(text)') is not null as has_session,
  to_regprocedure('public.delegate_app_requests_list_v1(text)') is not null as has_list,
  to_regprocedure('public.delegate_app_request_set_v1(text, bigint, text)') is not null as has_set,
  to_regprocedure('public.delegate_app_request_bind_v1(text, bigint, bigint)') is not null as has_bind;


