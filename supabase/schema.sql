-- =====================================================================
-- 國中複習站 Supabase 資料庫結構
-- 在 Supabase 後台 → SQL Editor 貼上整段並執行（只需執行一次）。
-- =====================================================================

-- ---------- 使用者個人資料（對應 auth.users） ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  nickname text check (nickname is null or char_length(nickname) <= 12),
  role text not null default 'user' check (role in ('user', 'admin')),
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);
-- 帳號不分大小寫不可重複
create unique index if not exists profiles_username_lower on public.profiles (lower(username));

-- ---------- 學習紀錄 ----------
create table if not exists public.progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  unit_id text not null,
  review_count int not null default 0 check (review_count >= 0),
  completed boolean not null default false,
  correct_count int not null default 0 check (correct_count >= 0),
  last_reviewed timestamptz,
  note text not null default '',
  primary key (user_id, unit_id)
);

create table if not exists public.wrong_questions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  unit_id text,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now(),
  unique (user_id, question)
);

create table if not exists public.mock_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score int not null check (score between 0 and 100),
  scope text,
  created_at timestamptz not null default now()
);

-- ---------- 內容（由管理員維護，所有人可讀） ----------
create table if not exists public.custom_units (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.unit_overrides (
  id text primary key,
  data jsonb not null
);

create table if not exists public.hidden_units (
  id text primary key
);

create table if not exists public.videos (
  id bigint generated always as identity primary key,
  unit_id text not null,
  title text not null,
  url text not null
);

create table if not exists public.announcements (
  id int primary key default 1 check (id = 1),
  text text not null default ''
);
insert into public.announcements (id, text) values (1, '') on conflict (id) do nothing;

-- =====================================================================
-- 管理員判斷
-- =====================================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and disabled = false
  );
$$;

-- 一般使用者不能自己改 role、disabled、username（管理員與 SQL 編輯器可以改）
create or replace function public.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.disabled := old.disabled;
    new.username := old.username;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile
  before update on public.profiles
  for each row execute function public.protect_profile();

-- 註冊時自動建立 profiles（帳號與顯示名稱來自註冊時的 metadata）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, nickname)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    nullif(new.raw_user_meta_data->>'nickname', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 權限（Row Level Security）
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.wrong_questions enable row level security;
alter table public.mock_results enable row level security;
alter table public.custom_units enable row level security;
alter table public.unit_overrides enable row level security;
alter table public.hidden_units enable row level security;
alter table public.videos enable row level security;
alter table public.announcements enable row level security;

-- profiles：自己可讀寫自己的資料；管理員可讀全部
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "profiles_update_self" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_admin_update" on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());
create policy "profiles_admin_delete" on public.profiles for delete
  using (public.is_admin());

-- 個人紀錄：只能讀寫自己的；管理員可讀全部
create policy "progress_own" on public.progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "progress_admin_read" on public.progress for select
  using (public.is_admin());

create policy "wrong_own" on public.wrong_questions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "wrong_admin_read" on public.wrong_questions for select
  using (public.is_admin());

create policy "mock_own_read" on public.mock_results for select
  using (user_id = auth.uid() or public.is_admin());
create policy "mock_own_insert" on public.mock_results for insert
  with check (user_id = auth.uid());

-- 內容：所有人（包含未登入）可讀；只有管理員可寫
create policy "custom_units_read" on public.custom_units for select using (true);
create policy "custom_units_admin_write" on public.custom_units for all
  using (public.is_admin()) with check (public.is_admin());

create policy "overrides_read" on public.unit_overrides for select using (true);
create policy "overrides_admin_write" on public.unit_overrides for all
  using (public.is_admin()) with check (public.is_admin());

create policy "hidden_read" on public.hidden_units for select using (true);
create policy "hidden_admin_write" on public.hidden_units for all
  using (public.is_admin()) with check (public.is_admin());

create policy "videos_read" on public.videos for select using (true);
create policy "videos_admin_write" on public.videos for all
  using (public.is_admin()) with check (public.is_admin());

create policy "announce_read" on public.announcements for select using (true);
create policy "announce_admin_write" on public.announcements for all
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- 設定管理員（只需做一次）：
--   1. 先在網站用你要當管理員的帳號註冊一次。
--   2. 把下面的帳號名稱換成你的，再執行：
--
--   update public.profiles set role = 'admin' where lower(username) = 'your_admin_name';
--
-- 因為 SQL 編輯器的 auth.uid() 為空，觸發器不會擋這個更新。
-- =====================================================================
