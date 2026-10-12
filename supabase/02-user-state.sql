-- =====================================================================
-- 第二步：使用者整體狀態（單元進度、錯題、成就、筆記、每日目標、模擬考紀錄等）
-- 已執行過 schema.sql 的專案，請只執行這個檔案。可以重複執行。
-- =====================================================================

create table if not exists public.user_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "user_state_own" on public.user_state;
create policy "user_state_own" on public.user_state for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user_state_admin_read" on public.user_state;
create policy "user_state_admin_read" on public.user_state for select
  using (public.is_admin());
