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
    ,

    /* ---------- 社群：公開個人資料與學習狀況 ---------- */
    getPublicProfile: function (username) {
      need();
      return wrap(client.from("public_profiles").select("id,username,nickname,role,created_at").ilike("username", username).maybeSingle());
    },

    getPublicProfilesByIds: function (ids) {
      need();
      if (!ids.length) return Promise.resolve({ data: [], error: null });
      return wrap(client.from("public_profiles").select("id,username,nickname,role,created_at").in("id", ids));
    },

    getStatsFor: function (userId) {
      need();
      return wrap(client.from("public_stats").select("is_public,stats,updated_at").eq("user_id", userId).maybeSingle());
    },

    listPublicStats: function () {
      need();
      return wrap(client.from("public_stats").select("user_id,stats,updated_at").eq("is_public", true).order("updated_at", { ascending: false }).limit(100));
    },

    // 寫入自己的學習摘要（只更新 stats 與時間，不改變公開設定）
    savePublicStats: async function (stats) {
      need();
      var id = await currentUserId();
      if (!id) return { data: null, error: "請先登入" };
      return wrap(client.from("public_stats").upsert({ user_id: id, stats: stats, updated_at: new Date().toISOString() }, { onConflict: "user_id" }));
    },

    setPublicVisibility: async function (flag) {
      need();
      var id = await currentUserId();
      if (!id) return { data: null, error: "請先登入" };
      return wrap(client.from("public_stats").upsert({ user_id: id, is_public: !!flag }, { onConflict: "user_id" }));
    },

    /* ---------- 聊天室 ---------- */
    fetchChat: function (limit) {
      need();
      return wrap(client.from("chat_messages").select("id,user_id,body,created_at").order("created_at", { ascending: false }).limit(limit || 60));
    },

    sendChat: async function (body) {
      need();
      var id = await currentUserId();
      if (!id) return { data: null, error: "請先登入" };
      return wrap(client.from("chat_messages").insert({ user_id: id, body: body }));
    },

    deleteChat: function (msgId) {
      need();
      return wrap(client.from("chat_messages").delete().eq("id", msgId));
    },

    currentUserId: function () { need(); return currentUserId(); }
    ,

    /* ---------- 管理員：重設密碼、刪除帳號（透過 Edge Function，服務金鑰只在伺服器端） ---------- */
    adminUser: async function (action, userId, password) {
      need();
      var res = await client.functions.invoke("admin-users", {
        body: { action: action, userId: userId, password: password || "" }
      });
      if (res.error) {
        var msg = res.error.message || "操作失敗";
        try {
          var ctx = res.error.context && (await res.error.context.json());
          if (ctx && ctx.error) msg = ctx.error;
        } catch (e) { /* 忽略解析錯誤，使用預設訊息 */ }
        return { data: null, error: msg };
      }
      if (res.data && res.data.error) return { data: null, error: res.data.error };
      return { data: res.data, error: null };
    }
    ,

    reportMessage: async function (msgId, reason) {
      need();
      var id = await currentUserId();
      if (!id) return { data: null, error: "請先登入" };
      return wrap(client.from("reports").insert({ reporter: id, message_id: Number(msgId), reason: String(reason || "") }));
    }
    ,

    // 註冊時即時檢查帳號是否可用（需執行 supabase/05-username-check.sql）
    usernameAvailable: function (name) {
      need();
      return wrap(client.rpc("username_available", { p_name: String(name) }));
    }
    ,

    listReports: function () {
      need();
      return wrap(client.from("reports").select("id,reason,created_at,message_id,reporter").order("created_at", { ascending: false }).limit(100));
    },

    getMessages: function (ids) {
      need();
      if (!ids.length) return Promise.resolve({ data: [], error: null });
      return wrap(client.from("chat_messages").select("id,body,user_id,created_at").in("id", ids));
    },

    dismissReport: function (id) {
      need();
      return wrap(client.from("reports").delete().eq("id", id));
    }
    ,

    /* ---------- 好友 ---------- */
    sendFriendRequest: async function (targetId) {
      need();
      var me = await currentUserId();
      if (!me) return { data: null, error: "請先登入" };
      return wrap(client.from("friendships").insert({ requester: me, addressee: targetId, status: "pending" }));
    },

    // RLS 只會回傳與自己有關的好友關係
    listFriendships: function () {
      need();
      return wrap(client.from("friendships").select("requester,addressee,status"));
    },

    acceptFriend: async function (requesterId) {
      need();
      var me = await currentUserId();
      return wrap(client.from("friendships").update({ status: "accepted" }).eq("requester", requesterId).eq("addressee", me));
    },

    removeFriendship: async function (otherId) {
      need();
      var me = await currentUserId();
      if (!me) return { data: null, error: "請先登入" };
      return wrap(client.from("friendships").delete().or(
        "and(requester.eq." + me + ",addressee.eq." + otherId + "),and(requester.eq." + otherId + ",addressee.eq." + me + ")"));
    },

    /* ---------- 私訊 ---------- */
    fetchDM: async function (otherId) {
      need();
      var me = await currentUserId();
      if (!me) return { data: [], error: "請先登入" };
      return wrap(client.from("direct_messages").select("id,sender,recipient,body,created_at,read_at")
        .or("and(sender.eq." + me + ",recipient.eq." + otherId + "),and(sender.eq." + otherId + ",recipient.eq." + me + ")")
        .order("created_at", { ascending: false }).limit(80));
    },

    sendDM: async function (otherId, body) {
      need();
      var me = await currentUserId();
      if (!me) return { data: null, error: "請先登入" };
      return wrap(client.from("direct_messages").insert({ sender: me, recipient: otherId, body: body }));
    },

    markDMRead: async function (otherId) {
      need();
      var me = await currentUserId();
      if (!me) return { data: null, error: null };
      return wrap(client.from("direct_messages").update({ read_at: new Date().toISOString() })
        .eq("sender", otherId).eq("recipient", me).is("read_at", null));
    },

    // 尚未讀取的私訊，依寄件人統計數量
    unreadSenders: async function () {
      need();
      var me = await currentUserId();
      if (!me) return { data: [], error: null };
      return wrap(client.from("direct_messages").select("sender").eq("recipient", me).is("read_at", null));
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
