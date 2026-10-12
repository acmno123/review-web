-- =====================================================================
-- 第四步：聊天室檢舉。已執行過前三步的專案，請執行這個檔案。可以重複執行。
-- 檢舉紀錄只有管理員可以讀取（可在 Supabase 後台 Table Editor 查看）。
-- =====================================================================

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references public.profiles(id) on delete cascade,
  message_id bigint not null references public.chat_messages(id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  unique (reporter, message_id)
);

alter table public.reports enable row level security;

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports for insert
  to authenticated with check (reporter = auth.uid());

drop policy if exists "reports_admin_read" on public.reports;
create policy "reports_admin_read" on public.reports for select
  using (public.is_admin());
