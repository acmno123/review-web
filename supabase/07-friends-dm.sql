-- =====================================================================
-- 第七步：好友與私訊。已執行前六步的專案，請執行這個檔案。可以重複執行。
-- 只有雙方成為好友（accepted）後才能互傳私訊。
-- =====================================================================

-- ---------- 好友關係 ----------
create table if not exists public.friendships (
  requester uuid not null references public.profiles(id) on delete cascade,
  addressee uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

alter table public.friendships enable row level security;

drop policy if exists "friend_read" on public.friendships;
create policy "friend_read" on public.friendships for select
  to authenticated using (requester = auth.uid() or addressee = auth.uid());

drop policy if exists "friend_request" on public.friendships;
create policy "friend_request" on public.friendships for insert
  to authenticated with check (requester = auth.uid() and status = 'pending');

-- 只有被邀請的一方可以接受
drop policy if exists "friend_accept" on public.friendships;
create policy "friend_accept" on public.friendships for update
  to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid());

-- 雙方都可以刪除（拒絕、取消邀請或解除好友）
drop policy if exists "friend_remove" on public.friendships;
create policy "friend_remove" on public.friendships for delete
  to authenticated using (requester = auth.uid() or addressee = auth.uid());

-- ---------- 私訊 ----------
create table if not exists public.direct_messages (
  id bigint generated always as identity primary key,
  sender uuid not null references public.profiles(id) on delete cascade,
  recipient uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists dm_pair_time on public.direct_messages (sender, recipient, created_at desc);

alter table public.direct_messages enable row level security;

drop policy if exists "dm_read" on public.direct_messages;
create policy "dm_read" on public.direct_messages for select
  to authenticated using (sender = auth.uid() or recipient = auth.uid());

-- 只能傳給已經是好友的人
drop policy if exists "dm_send" on public.direct_messages;
create policy "dm_send" on public.direct_messages for insert
  to authenticated with check (
    sender = auth.uid() and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = sender and f.addressee = recipient) or (f.requester = recipient and f.addressee = sender))
    )
  );

-- 收件人可以標記已讀
drop policy if exists "dm_mark_read" on public.direct_messages;
create policy "dm_mark_read" on public.direct_messages for update
  to authenticated using (recipient = auth.uid()) with check (recipient = auth.uid());

-- 自己的訊息可以收回
drop policy if exists "dm_delete_own" on public.direct_messages;
create policy "dm_delete_own" on public.direct_messages for delete
  to authenticated using (sender = auth.uid());
