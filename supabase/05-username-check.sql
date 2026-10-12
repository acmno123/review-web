-- =====================================================================
-- 第五步：註冊時即時檢查帳號是否可用。已執行前四步的專案，請執行這個檔案。可以重複執行。
-- 這個函式只回傳 true / false，不會讓訪客看到其他使用者的資料。
-- =====================================================================

create or replace function public.username_available(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(p_name)
  );
$$;

grant execute on function public.username_available(text) to anon, authenticated;
