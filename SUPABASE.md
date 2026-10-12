# 連接 Supabase 的步驟

## 1. 建立專案
1. 到 https://supabase.com 註冊並建立新專案（Region 選離你近的，例如 Singapore）。
2. 等專案建立完成後，到 **Project Settings → API**，複製：
   - **Project URL**
   - **anon public** key（不是 service_role！）

## 2. 關閉 Email 確認
網站以「帳號@users.review.local」作為內部登入名稱，所以必須關閉確認信：
**Authentication → Providers → Email**，關閉 **Confirm email**，儲存。
（若想允許任何人註冊，保持 **Allow new users to sign up** 開啟。）

## 3. 建立資料表與權限
1. 到 **SQL Editor → New query**。
2. 打開本專案的 `supabase/schema.sql`，整段貼上，按 **Run**。
3. 若出現錯誤，把錯誤訊息貼給我，我再修正。

## 4. 設定管理員（在後台改權限）
1. 在網站上用你要當管理員的帳號註冊一次（任何人都能註冊）。
2. 到 Supabase 後台 **Table Editor → profiles**。
3. 找到你的帳號那一列，把 `role` 從 `user` 改成 `admin`，儲存。
4. 重新整理網站，導覽列會出現「管理後台」。

## 5. 填入連線設定
編輯 `js/supabase-config.js`，把 `url` 與 `anonKey` 換成第 1 步複製的值。

## 6. 檢查
- 打開瀏覽器的開發者工具（F12）→ Console，應該沒有紅色錯誤。
- 在 Console 輸入 `window.CloudDB.ready`，應顯示 `true`。

## 安全注意事項
- **anon key 可以公開**，它的權限由資料表的 RLS 規則控制。
- **service_role key 絕對不可以放進前端或 GitHub**。
- 管理員身分只由資料庫的 `profiles.role` 決定，一般使用者無法自行改成管理員。網站原始碼中沒有任何管理員密碼。

## 第二步：執行 user_state 資料表（已執行過 schema.sql 的專案）
到 SQL Editor 執行 `supabase/02-user-state.sql`。這個檔案存放每位使用者的學習資料（單元進度、錯題、成就、筆記、每日目標、模擬考紀錄）。新專案若是先執行 schema.sql，也要執行這個檔案。

## 運作方式
- 網站仍然先讀寫瀏覽器的本機快取，所以畫面速度不受影響。
- 學習資料會在修改後約 0.8 秒自動同步到 Supabase。
- 開啟網站或登入時，會從 Supabase 把資料拉回本機。
- 未設定 `js/supabase-config.js` 時，網站完全使用本機模式。

## 已知限制（請留意）
- **同一帳號多台裝置同時修改**：後儲存的會覆蓋先儲存的，因為整份資料一起存。一般單人使用沒有問題。
- **雲端模式下的管理功能**：可以停用或啟用帳號；重設密碼與刪除帳號需要 Supabase Edge Function（需要 service_role，不能放在前端），目前請在 Supabase 後台的 Authentication 頁面處理。
- **內容管理**：管理員在網站上的新增、修改、隱藏會同步到雲端，所有人都能看到。
- **離線**：沒有網路時仍可使用，之後連上網路會再同步。

## 目前狀態
網站已接上 Supabase。實際能否運作，請依照上面的步驟檢查：
開啟開發者工具（F12）→ Console，輸入 `window.CloudDB.ready`，應顯示 `true`。

## 第三步：社群功能（個人檔案、社群、聊天室）
到 SQL Editor 執行 `supabase/03-social.sql`（需先完成前兩步）。
- **社群**：可以看到所有公開學習狀況的使用者，依完成單元數排序。
- **個人檔案**：點導覽列的「個人檔案」，可以勾選或取消「公開我的學習狀況」。
- **聊天室**：所有登入的使用者都可以發言，每 5 秒自動更新。可以收回自己的訊息；管理員可以刪除任何訊息（需在資料庫的 `chat_messages` 上操作，網站目前只提供收回自己的訊息）。

## 第四步：部署管理員 Edge Function（重設密碼、刪除帳號）
重設密碼與刪除帳號需要服務金鑰，所以放在 Supabase Edge Function 中執行，網頁不會接觸到服務金鑰。

**方法一：用 Supabase 後台（不需要安裝任何工具）**
1. 到 **Edge Functions** → **Deploy a new function** → 選 **Via editor**。
2. 函式名稱填 `admin-users`。
3. 把 `supabase/functions/admin-users/index.ts` 的內容整段貼上，按 **Deploy**。
4. 不需要另外設定密鑰；`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 會由 Supabase 自動提供。

**方法二：用 CLI**
```bash
supabase functions deploy admin-users
```

部署後，管理後台的帳號列表就能重設密碼與刪除帳號。函式會再次確認呼叫者是 `role = 'admin'` 且未停用，一般使用者即使知道這個網址也無法使用。

## 第五步：聊天室檢舉
到 SQL Editor 執行 `supabase/04-reports.sql`。之後聊天室中別人的訊息會出現「檢舉」按鈕，檢舉紀錄可以在 Supabase 後台的 **Table Editor → reports** 查看（只有管理員能讀取）。
