-- تحسين بحث إدارة العائلة في التطبيق: الاسم الثلاثي، الجزء الأخير من المسار، وكل كلمة.
-- شغّله في Supabase SQL Editor بعد COPY-ME-family-admin-app-v1.sql

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

notify pgrst, 'reload schema';
