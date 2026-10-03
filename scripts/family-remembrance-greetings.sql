-- ذكريات اليوم: تهنئة الميلاد ودعاء الوفاة تصل لأهل الشخص.
-- شغّله مرة واحدة في محرر SQL. بدونه تظهر الأسماء، والتهنئة ما تنتقل بين الجوالات.

create table if not exists public.family_remembrance_greetings (
  id text primary key,
  person_id bigint not null,
  kind text not null check (kind in ('birth', 'death')),
  day_key text not null,
  sender_phone text not null,
  sender_name text,
  phrase text not null check (phrase in ('مبروك', 'اللهم ارحمه')),
  created_at timestamptz not null default now()
);

create unique index if not exists family_remembrance_greetings_once
  on public.family_remembrance_greetings (person_id, kind, day_key, sender_phone);

create index if not exists family_remembrance_greetings_day
  on public.family_remembrance_greetings (day_key);

alter table public.family_remembrance_greetings enable row level security;

drop policy if exists "family_remembrance_greetings_select" on public.family_remembrance_greetings;
create policy "family_remembrance_greetings_select"
  on public.family_remembrance_greetings for select
  using (true);

drop policy if exists "family_remembrance_greetings_insert" on public.family_remembrance_greetings;
create policy "family_remembrance_greetings_insert"
  on public.family_remembrance_greetings for insert
  with check (
    char_length(btrim(sender_phone)) > 0
    and kind in ('birth', 'death')
    and phrase in ('مبروك', 'اللهم ارحمه')
  );

grant select, insert on public.family_remembrance_greetings to anon, authenticated;
