/*
 * Supabase 設定
 *
 * url：Project URL（Project Settings → API）
 * anonKey：anon public key（同一頁面，不是 service_role）
 *
 * anon key 可以公開放在前端；資料權限由 supabase/schema.sql 的 RLS 規則控管。
 * 絕對不要把 service_role key 放進這個檔案或任何前端程式。
 *
 * 留空時，網站會使用本機瀏覽器儲存（localStorage）。
 */
window.SUPABASE_CONFIG = {
  url: "https://mycukmsycuksegquinar.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15Y3VrbXN5Y3Vrc2VncXVpbmFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MDQ4MjAsImV4cCI6MjEwNzM4MDgyMH0.9yy9tU2NkOyAVNdULGyJff0v6EwF-37FqfgSPnRbtOI"
};
