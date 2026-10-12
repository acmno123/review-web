-- =====================================================================
-- 第三步：社群功能（個人檔案、公開學習狀況、聊天室）
-- 已執行過 schema.sql 與 02-user-state.sql 的專案，請執行這個檔案。可以重複執行。
-- =====================================================================

-- ---------- 公開的基本資料（不含 disabled、建立時間以外的敏感欄位） ----------
-- 用 view 只露出需要公開的欄位；view 以資料表擁有者身分執行，因此只列出安全欄位。
create or replace view public.public_profiles as
  select id, username, nickname, role, created_at
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;

-- ---------- 公開的學習狀況摘要 ----------
create table if not exists public.public_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_public boolean not null default true,
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.public_stats enable row level security;

drop policy if exists "stats_read" on public.public_stats;
create policy "stats_read" on public.public_stats for select
  using (is_public = true or user_id = auth.uid() or public.is_admin());

drop policy if exists "stats_own_write" on public.public_stats;
create policy "stats_own_write" on public.public_stats for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- 聊天室 ----------
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_created on public.chat_messages (created_at desc);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_read" on public.chat_messages;
create policy "chat_read" on public.chat_messages for select
  to authenticated using (true);

drop policy if exists "chat_insert_own" on public.chat_messages;
create policy "chat_insert_own" on public.chat_messages for insert
  to authenticated with check (user_id = auth.uid());

-- 自己的訊息可以收回，管理員可以刪除任何訊息
drop policy if exists "chat_delete" on public.chat_messages;
create policy "chat_delete" on public.chat_messages for delete
  to authenticated using (user_id = auth.uid() or public.is_admin());
