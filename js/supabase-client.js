/*
 * Supabase 連線模組：提供 window.CloudDB 給 app.js 使用。
 * 需要先在 index.html 載入 supabase-js（見 index.html 的註解）。
 *
 * 帳號說明：Supabase 登入需要 email，這裡以「帳號@users.review.local」當作內部
 * 登入名稱，使用者只需要輸入帳號與密碼。請在 Supabase 關閉 Email 確認信，
 * 否則註冊後無法直接登入。
 */
(function () {
  "use strict";

  var cfg = window.SUPABASE_CONFIG || {};
  var lib = window.supabase;
  var ready = !!(cfg.url && cfg.anonKey && lib && lib.createClient);
  var client = ready ? lib.createClient(cfg.url, cfg.anonKey) : null;

  function emailFor(username) {
    return String(username).trim().toLowerCase() + "@users.review.local";
  }

  function need() {
    if (!client) throw new Error("尚未設定 Supabase，請先填寫 js/supabase-config.js");
  }

  // 統一回傳格式：{ data, error }，錯誤時 error 為可顯示的文字
  function wrap(p) {
    return p.then(function (res) {
      if (res.error) return { data: null, error: res.error.message || "發生錯誤" };
      return { data: res.data, error: null };
    }).catch(function (err) {
      return { data: null, error: err.message || "發生錯誤" };
    });
  }

  async function currentUserId() {
    var r = await client.auth.getUser();
    return r.data && r.data.user ? r.data.user.id : null;
  }

  window.CloudDB = {
    ready: ready,

    /* ---------- 帳號 ---------- */
    signUp: function (username, password, nickname) {
      need();
      return wrap(client.auth.signUp({
        email: emailFor(username),
        password: password,
        options: { data: { username: username, nickname: nickname || "" } }
      }));
    },

    signIn: function (username, password) {
      need();
      return wrap(client.auth.signInWithPassword({ email: emailFor(username), password: password }));
    },

    signOut: function () {
      need();
      return wrap(client.auth.signOut());
    },

    // 目前登入者的 profile（含 role），未登入回傳 null
    currentProfile: async function () {
      need();
      var id = await currentUserId();
      if (!id) return { data: null, error: null };
      return wrap(client.from("profiles").select("*").eq("id", id).single());
    },

    /* ---------- 個人學習紀錄 ---------- */
    // 讀取全部單元紀錄，格式與 app.js 的 data.units 相同
    loadProgress: async function () {
      need();
      var id = await currentUserId();
      if (!id) return { data: {}, error: null };
      var res = await wrap(client.from("progress").select("*").eq("user_id", id));
      if (res.error) return res;
      var units = {};
      res.data.forEach(function (r) {
        units[r.unit_id] = {
          review: r.review_count,
          completed: r.completed,
          correct: r.correct_count,
          lastReviewed: r.last_reviewed ? Date.parse(r.last_reviewed) : 0,
          note: r.note || ""
        };
      });
      return { data: units, error: null };
    },

    // 寫入單一單元紀錄（upsert）
    saveUnitRecord: async function (unitId, rec) {
      need();
      var id = await currentUserId();
      if (!id) return { data: null, error: "請先登入" };
      return wrap(client.from("progress").upsert({
        user_id: id,
        unit_id: unitId,
        review_count: rec.review || 0,
        completed: !!rec.completed,
        correct_count: rec.correct || 0,
        last_reviewed: rec.lastReviewed ? new Date(rec.lastReviewed).toISOString() : null,
        note: rec.note || ""
      }, { onConflict: "user_id,unit_id" }));
    },

    // 錯題本：整批取代（避免重複）
    loadWrong: async function () {
      need();
      return wrap(client.from("wrong_questions").select("question,answer,unit_id").order("created_at", { ascending: true }));
    },

    addWrong: async function (item) {
      need();
      var id = await currentUserId();
      if (!id) return { data: null, error: "請先登入" };
      return wrap(client.from("wrong_questions").upsert({
        user_id: id, question: item.q, answer: item.a, unit_id: item.unitId || null
      }, { onConflict: "user_id,question" }));
    },

    removeWrong: function (question) {
      need();
      return wrap(client.from("wrong_questions").delete().eq("question", question));
    },

    addMock: async function (score, scope) {
      need();
      var id = await currentUserId();
      if (!id) return { data: null, error: "請先登入" };
      return wrap(client.from("mock_results").insert({ user_id: id, score: score, scope: scope }));
    },

    /* ---------- 內容（所有人可讀，管理員可寫） ---------- */
    loadContent: async function () {
      need();
      var custom = await wrap(client.from("custom_units").select("id,data"));
      var overrides = await wrap(client.from("unit_overrides").select("id,data"));
      var hidden = await wrap(client.from("hidden_units").select("id"));
      var videos = await wrap(client.from("videos").select("unit_id,title,url").order("id", { ascending: true }));
      var notice = await wrap(client.from("announcements").select("text").eq("id", 1).single());
      var firstError = custom.error || overrides.error || hidden.error || videos.error || notice.error;
      if (firstError) return { data: null, error: firstError };
      return {
        data: {
          custom: custom.data.map(function (r) { return r.data; }),
          overrides: overrides.data.reduce(function (o, r) { o[r.id] = r.data; return o; }, {}),
          hidden: hidden.data.map(function (r) { return r.id; }),
          videos: videos.data.reduce(function (o, r) {
            (o[r.unit_id] = o[r.unit_id] || []).push({ title: r.title, url: r.url });
            return o;
          }, {}),
          announcement: notice.data ? notice.data.text : ""
        },
        error: null
      };
    },

    upsertCustomUnit: function (unit) {
      need();
      return wrap(client.from("custom_units").upsert({ id: unit.id, data: unit }));
    },

    deleteCustomUnit: function (id) {
      need();
      return wrap(client.from("custom_units").delete().eq("id", id));
    },

    setOverride: function (id, data) {
      need();
      return wrap(client.from("unit_overrides").upsert({ id: id, data: data }));
    },

    setHidden: function (id, hidden) {
      need();
      if (hidden) return wrap(client.from("hidden_units").upsert({ id: id }));
      return wrap(client.from("hidden_units").delete().eq("id", id));
    },

    addVideo: function (unitId, title, url) {
      need();
      return wrap(client.from("videos").insert({ unit_id: unitId, title: title, url: url }));
    },

    setAnnouncement: function (text) {
      need();
      return wrap(client.from("announcements").upsert({ id: 1, text: text }));
    }
    ,

    /* ---------- 使用者整體狀態（user_state） ---------- */
    loadUserState: async function () {
      need();
      var id = await currentUserId();
      if (!id) return { data: null, error: "請先登入" };
      var res = await wrap(client.from("user_state").select("data").eq("user_id", id).maybeSingle());
      if (res.error) return res;
      return { data: res.data ? res.data.data : null, error: null };
    },

    saveUserState: async function (data) {
      need();
      var id = await currentUserId();
      if (!id) return { data: null, error: "請先登入" };
      return wrap(client.from("user_state").upsert({ user_id: id, data: data, updated_at: new Date().toISOString() }));
    },

    /* ---------- 管理員：帳號列表與停用 ---------- */
    listProfiles: function () {
      need();
      return wrap(client.from("profiles").select("id,username,nickname,role,disabled,created_at").order("created_at", { ascending: true }));
    },

    setDisabled: function (profileId, flag) {
      need();
      return wrap(client.from("profiles").update({ disabled: !!flag }).eq("id", profileId));
    },

    /* ---------- 管理員：內容整表取代（新增或更新，並刪除本機已移除的項目） ---------- */
    replaceCustom: function (list) {
      need();
      return replaceRows("custom_units", (list || []).map(function (u) { return { id: u.id, data: u }; }), "id");
    },

    replaceOverrides: function (obj) {
      need();
      return replaceRows("unit_overrides", Object.keys(obj || {}).map(function (id) { return { id: id, data: obj[id] }; }), "id");
    },

    replaceHidden: function (arr) {
      need();
      return replaceRows("hidden_units", (arr || []).map(function (id) { return { id: id }; }), "id");
    },

    replaceVideos: async function (obj) {
      need();
      var del = await client.from("videos").delete().gt("id", 0);
      if (del.error) return { data: null, error: del.error.message };
      var rows = [];
      Object.keys(obj || {}).forEach(function (uid) {
        (obj[uid] || []).forEach(function (v) { rows.push({ unit_id: uid, title: v.title, url: v.url }); });
      });
      if (!rows.length) return { data: null, error: null };
      return wrap(client.from("videos").insert(rows));
    }
  };

  // 新增或更新 rows，再刪除資料庫中不在 rows 裡的列
  async function replaceRows(table, rows, idCol) {
    if (rows.length) {
      var up = await client.from(table).upsert(rows);
      if (up.error) return { data: null, error: up.error.message };
    }
    var keep = {};
    rows.forEach(function (r) { keep[r[idCol]] = true; });
    var ex = await client.from(table).select(idCol);
    if (ex.error) return { data: null, error: ex.error.message };
    var errors = [];
    for (var i = 0; i < ex.data.length; i++) {
      var id = ex.data[i][idCol];
      if (!keep[id]) {
        var d = await client.from(table).delete().eq(idCol, id);
        if (d.error) errors.push(d.error.message);
      }
    }
    return { data: null, error: errors.length ? errors[0] : null };
  }
})();
