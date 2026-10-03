-- Optional: run in Supabase SQL editor for shared family board.
-- Until this exists, the app stores posts locally on device.

create table if not exists public.family_board_posts (
  id text primary key,
  kind text not null check (kind in ('offer', 'request')),
  category text not null,
  title text not null,
  body text,
  place text,
  branch_key text,
  author_name text,
  author_phone text not null,
  created_at timestamptz not null default now(),
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  urgent boolean not null default false
);

alter table public.family_board_posts
  add column if not exists starts_at timestamptz;

alter table public.family_board_posts
  add column if not exists coming_count integer not null default 0;

alter table public.family_board_posts enable row level security;

create policy "family_board_posts_select_public"
  on public.family_board_posts for select
  using (is_active = true);

create policy "family_board_posts_insert_anon"
  on public.family_board_posts for insert
  with check (true);
