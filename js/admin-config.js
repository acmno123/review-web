/*
 * 管理員設定（只有你能設定）
 *
 * 1. 用瀏覽器打開 tools/make-admin.html
 * 2. 輸入管理員帳號與密碼（至少 8 字元）
 * 3. 把產生的內容完整複製，取代本檔案的內容
 *
 * 密碼不會以明文存放；只有 SHA-256 雜湊與隨機鹽。
 * hash 留空時，代表尚未設定管理員，任何人都無法進入後台。
 */
window.ADMIN_CONFIG = {
  username: "admin",
  salt: "",
  hash: ""
};
