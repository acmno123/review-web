/*
 * Supabase 設定
 *
 * 1. 到 Supabase 後台 → Project Settings → API，複製 Project URL 與 anon public key。
 * 2. 把下面兩個值換成你的。
 *
 * anon key 可以公開放在前端程式中，它的權限由 supabase/schema.sql 的 RLS 規則控管。
 * 絕對不要把 service_role key 放進這個檔案或任何前端程式。
 *
 * 留空時，網站會繼續使用本機瀏覽器儲存（localStorage）。
 */
window.SUPABASE_CONFIG = {
  url: "",       // 例如 "https://xxxxxxxxxxxx.supabase.co"
  anonKey: ""    // 例如 "eyJhbGciOi..."（anon public key）
};
