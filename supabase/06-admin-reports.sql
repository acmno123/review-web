-- =====================================================================
-- 第六步：管理員處理檢舉（可以忽略檢舉）。已執行前五步的專案，請執行這個檔案。可以重複執行。
-- =====================================================================

drop policy if exists "reports_admin_delete" on public.reports;
create policy "reports_admin_delete" on public.reports for delete
  using (public.is_admin());
