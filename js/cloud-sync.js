/*
 * 雲端同步：讓 app.js 維持同步的 localStorage 介面，同時把資料同步到 Supabase。
 *
 * 運作方式：
 * - app.js 照常讀寫 localStorage（本機快取）。
 * - 寫入 crs_data:<帳號> 或內容相關的 key 時，會自動排程（0.8 秒防抖動）同步到 Supabase。
 * - 網站開啟時，從 Supabase 把資料拉回本機快取。
 * - 若未設定 Supabase（CloudDB.ready 為 false），完全只使用本機，行為與之前相同。
 */
(function () {
  "use strict";

  var K_SESSION = "crs_session";
  var K_ROLE = "crs_cloud_role";
  var K_DATA = "crs_data:";
  var K_USERS_CACHE = "crs_cloud_users";
  var CONTENT_KEYS = { crs_custom_units: 1, crs_overrides: 1, crs_hidden: 1, crs_videos: 1, crs_announce: 1 };
  var DEBOUNCE_MS = 800;

  var rawSet = Storage.prototype.setItem;
  var rawGet = Storage.prototype.getItem;
  var timers = {};
  var cloudName = null; // 目前雲端登入者的帳號

  function enabled() { return !!(window.CloudDB && window.CloudDB.ready); }

  function put(key, val) { rawSet.call(window.localStorage, key, JSON.stringify(val)); }
  function get(key, def) {
    try {
      var v = rawGet.call(window.localStorage, key);
      return v === null ? def : JSON.parse(v);
    } catch (e) { return def; }
  }

  function schedule(name, fn) {
    clearTimeout(timers[name]);
    timers[name] = setTimeout(fn, DEBOUNCE_MS);
  }

  function warn(label, r) {
    if (r && r.error) console.warn("[雲端同步] " + label + " 失敗：", r.error);
  }

  /* ---------- 寫入本機時，自動排程雲端同步 ---------- */
  Storage.prototype.setItem = function (key, value) {
    rawSet.call(this, key, value);
    if (this !== window.localStorage || !enabled()) return;
    if (cloudName && key === K_DATA + cloudName) {
      schedule("user", flushUser);
    } else if (CONTENT_KEYS[key]) {
      schedule("content", flushContent);
    }
  };

  function flushUser() {
    if (!cloudName) return;
    var data = get(K_DATA + cloudName, null);
    if (!data) return;
    window.CloudDB.saveUserState(data).then(function (r) { warn("儲存學習紀錄", r); });
  }

  // 管理員內容：整表取代（非管理員的寫入會被資料庫權限拒絕，屬正常情況）
  function flushContent() {
    Promise.all([
      window.CloudDB.replaceCustom(get("crs_custom_units", [])),
      window.CloudDB.replaceOverrides(get("crs_overrides", {})),
      window.CloudDB.replaceHidden(get("crs_hidden", [])),
      window.CloudDB.replaceVideos(get("crs_videos", {})),
      window.CloudDB.setAnnouncement(get("crs_announce", ""))
    ]).then(function (rs) {
      rs.forEach(function (r) { warn("同步內容", r); });
    });
  }

  /* ---------- 從雲端拉取 ---------- */
  async function pullContent() {
    var r = await window.CloudDB.loadContent();
    if (r.error) { warn("讀取內容", r); return; }
    put("crs_custom_units", r.data.custom);
    put("crs_overrides", r.data.overrides);
    put("crs_hidden", r.data.hidden);
    put("crs_videos", r.data.videos);
    put("crs_announce", r.data.announcement);
  }

  async function pullUserState(username) {
    var st = await window.CloudDB.loadUserState();
    if (!st.error && st.data) put(K_DATA + username, st.data);
    else if (!st.error && get(K_DATA + username, null)) {
      // 雲端尚無資料：把這台裝置上的資料上傳，避免遺失
      window.CloudDB.saveUserState(get(K_DATA + username, {})).then(function (r) { warn("首次上傳", r); });
    }
  }

  function clearSession() {
    cloudName = null;
    localStorage.removeItem(K_SESSION);
    localStorage.removeItem(K_ROLE);
  }

  /* ---------- 公開介面 ---------- */
  var CloudSync = {
    enabled: enabled,

    // 網站開啟時呼叫：先拉取內容，再確認是否已登入
    boot: async function () {
      if (!enabled()) return;
      await pullContent();
      var p = await window.CloudDB.currentProfile();
      if (p.error || !p.data) { clearSession(); return; }
      if (p.data.disabled) { await window.CloudDB.signOut(); clearSession(); return; }
      cloudName = p.data.username;
      put(K_SESSION, cloudName);
      put(K_ROLE, p.data.role);
      await pullUserState(cloudName);
    },

    signUp: async function (username, password, nickname) {
      var r = await window.CloudDB.signUp(username, password, nickname);
      if (r.error) return { error: friendly(r.error) };
      return { error: null };
    },

    signIn: async function (username, password) {
      var r = await window.CloudDB.signIn(username, password);
      if (r.error) return { error: friendly(r.error) };
      var p = await window.CloudDB.currentProfile();
      if (p.error || !p.data) return { error: "讀取帳號資料失敗，請稍後再試" };
      if (p.data.disabled) {
        await window.CloudDB.signOut();
        return { error: "此帳號已被停用，請聯絡管理員" };
      }
      cloudName = p.data.username;
      put(K_SESSION, cloudName);
      put(K_ROLE, p.data.role);
      await pullUserState(cloudName);
      return { error: null, role: p.data.role };
    },

    signOut: function () {
      clearSession();
      if (enabled()) window.CloudDB.signOut();
    },

    // 管理員：重新讀取帳號列表到本機快取
    refreshUsers: async function () {
      var r = await window.CloudDB.listProfiles();
      if (r.error) { warn("讀取帳號列表", r); return; }
      put(K_USERS_CACHE, r.data);
    },

    users: function () { return get(K_USERS_CACHE, []); },

    setDisabled: async function (profileId, flag) {
      var r = await window.CloudDB.setDisabled(profileId, flag);
      warn("停用／啟用帳號", r);
      return r;
    }
  };

  // 把 Supabase 的英文錯誤轉成較易懂的中文
  function friendly(msg) {
    var m = String(msg || "");
    if (/Invalid login credentials/i.test(m)) return "帳號或密碼錯誤";
    if (/Email not confirmed/i.test(m)) return "此帳號尚未完成驗證，請到 Supabase 關閉 Confirm email";
    if (/already registered|already been registered|User already registered/i.test(m)) return "此帳號已被使用";
    if (/Password should be at least/i.test(m)) return "密碼太短，請使用更長的密碼";
    if (/duplicate key|profiles_username_lower/i.test(m)) return "此帳號已被使用";
    return m;
  }

  window.CloudSync = CloudSync;
})();
