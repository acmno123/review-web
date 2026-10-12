/*
 * 社群頁面：社群列表、個人檔案、聊天室。
 * 需要 Supabase（window.CloudDB.ready 為 true），並已執行 supabase/03-social.sql。
 * 依賴 app.js 提供的 window.AppKit（在呼叫時才讀取，不在載入時讀取）。
 */
(function () {
  "use strict";

  var CHAT_POLL_MS = 5000;
  var chatTimer = null;

  function kit() { return window.AppKit; }
  function db() { return window.CloudDB; }
  function root() { return document.getElementById("app"); }
  function esc(s) { return kit().esc(s); }

  function notReady() {
    root().innerHTML = '<section class="panel"><h1>雲端功能尚未開啟</h1>' +
      '<p class="muted">社群與聊天室需要 Supabase。請先完成 js/supabase-config.js 的設定。</p></section>';
  }
  function loading() {
    root().innerHTML = '<section class="panel"><p class="muted">載入中…</p></section>';
  }
  function fail(msg) {
    root().innerHTML = '<section class="panel"><h1>讀取失敗</h1><p class="muted">' + esc(msg) + '</p></section>';
  }
  function needLogin() {
    root().innerHTML = '<section class="panel"><h1>請先登入</h1><p><a href="#/login">前往登入</a></p></section>';
  }
  function displayName(p) { return p.nickname || p.username; }
  function timeAgo(iso) {
    var d = Date.now() - Date.parse(iso), m = Math.floor(d / 60000);
    if (m < 1) return "剛剛";
    if (m < 60) return m + " 分鐘前";
    var h = Math.floor(m / 60);
    if (h < 24) return h + " 小時前";
    return kit().fmtDate(Date.parse(iso));
  }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }

  /* ---------- 社群列表 ---------- */
  async function community() {
    if (!db() || !db().ready) return notReady();
    loading();
    var r = await db().listPublicStats();
    if (r.error) return fail(r.error);
    var ids = r.data.map(function (x) { return x.user_id; });
    var pr = await db().getPublicProfilesByIds(ids);
    if (pr.error) return fail(pr.error);
    var byId = {};
    pr.data.forEach(function (p) { byId[p.id] = p; });

    var rows = r.data.filter(function (x) { return byId[x.user_id]; }).sort(function (a, b) {
      return (b.stats.completed || 0) - (a.stats.completed || 0);
    });

    var html = '<header class="page-head"><span class="eyebrow">Community</span><h1>社群</h1>' +
      '<p class="muted">看看大家的學習進度。點進個人檔案可以看到更多細節。</p></header>';
    if (!rows.length) html += '<section class="panel"><p class="muted">目前還沒有公開的學習紀錄。</p></section>';
    html += '<div class="people-grid">';
    rows.forEach(function (x) {
      var p = byId[x.user_id], st = x.stats || {};
      var total = st.total || 0, done = st.completed || 0;
      html += '<a class="person-card" href="#/u/' + encodeURIComponent(p.username) + '">' +
        '<div class="avatar">' + esc(displayName(p).charAt(0).toUpperCase()) + '</div>' +
        '<div class="person-main"><strong>' + esc(displayName(p)) + '</strong>' +
        '<span class="muted small-note">@' + esc(p.username) + '</span>' +
        '<div class="mini-stats"><span>🔥 ' + (st.streak || 0) + ' 天</span><span>✅ ' + done + '/' + total + '</span>' +
        '<span>🏅 ' + (st.achievements || 0) + '</span></div>' +
        '<div class="tile-bar"><span style="width:' + pct(done, total) + '%"></span></div></div></a>';
    });
    root().innerHTML = html + '</div>';
  }

  /* ---------- 個人檔案 ---------- */
  async function profile(username) {
    if (!db() || !db().ready) return notReady();
    if (!username) return fail("找不到使用者");
    loading();
    var p = await db().getPublicProfile(username);
    if (p.error) return fail(p.error);
    if (!p.data) return fail("找不到這個使用者");

    var me = await db().currentUserId();
    var isMe = me === p.data.id;
    var s = await db().getStatsFor(p.data.id);
    if (s.error) return fail(s.error);
    var stats = s.data && s.data.stats;
    var visible = s.data ? s.data.is_public : true;

    var html = '<header class="profile-hero"><div class="avatar big">' + esc(displayName(p.data).charAt(0).toUpperCase()) + '</div>' +
      '<div><span class="eyebrow">' + (p.data.role === "admin" ? "管理員" : "學習者") + '</span>' +
      '<h1>' + esc(displayName(p.data)) + '</h1><p class="muted">@' + esc(p.data.username) +
      ' ・ 加入於 ' + kit().fmtDate(Date.parse(p.data.created_at)) + '</p></div></header>';

    if (isMe) {
      html += '<section class="card-block"><label class="switch-row"><input type="checkbox" id="social-vis"' +
        (visible ? ' checked' : '') + '><span>公開我的學習狀況（其他人可以在社群看到）</span></label></section>';
    }

    if (!stats || (!visible && !isMe)) {
      html += '<section class="card-block"><p class="muted">' +
        (!stats ? "這位使用者還沒有學習紀錄。" : "這位使用者的學習狀況不公開。") + '</p></section>';
      root().innerHTML = html;
      return;
    }

    var total = stats.total || 0, done = stats.completed || 0;
    html += '<section class="profile-grid">' +
      '<div class="card-block ring-block"><div class="ring big" style="background:conic-gradient(var(--brand1) ' +
      (pct(done, total) * 3.6) + 'deg, var(--line) 0)" data-label="' + pct(done, total) + '%"></div>' +
      '<p>已確認複習 <strong>' + done + '</strong> / ' + total + ' 單元</p></div>' +
      '<div class="card-block"><div class="stat-row">' +
      '<div><span class="num">' + (stats.streak || 0) + '</span><span class="lbl">連續學習（天）</span></div>' +
      '<div><span class="num">' + (stats.correct || 0) + '</span><span class="lbl">練習答對</span></div>' +
      '<div><span class="num">' + (stats.mocks || 0) + '</span><span class="lbl">模擬考次數</span></div></div>' +
      '<p class="muted small-note">模擬考最高分：' + (stats.bestMock || 0) + ' 分　成就：' + (stats.achievements || 0) + ' 個</p></div>' +
      '</section>';

    html += '<section class="card-block"><h2>📚 各科進度</h2>';
    (stats.subjects || []).forEach(function (sub) {
      html += '<div class="subject-row"><span class="subject-name">' + (kit().ICON[sub.id] || "") + ' ' + esc(sub.name) + '</span>' +
        '<div class="bar"><div class="bar-fill" style="width:' + pct(sub.done, sub.total) + '%"></div></div>' +
        '<span class="subject-num">' + sub.done + ' / ' + sub.total + '</span></div>';
    });
    html += '</section>';
    root().innerHTML = html;
  }

  /* ---------- 聊天室 ---------- */
  async function chat() {
    if (!db() || !db().ready) return notReady();
    var me = await db().currentUserId();
    if (!me) return needLogin();
    root().innerHTML = '<header class="page-head"><span class="eyebrow">Chat</span><h1>聊天室</h1>' +
      '<p class="muted">所有登入的使用者都可以看到與發言。每 5 秒自動更新。</p></header>' +
      '<section class="chat-box"><div id="chat-list" class="chat-list"><p class="muted">載入中…</p></div>' +
      '<form class="chat-form" data-form="social-chat"><input type="text" name="body" maxlength="300" placeholder="說點什麼…" autocomplete="off">' +
      '<button class="btn btn-primary" type="submit">送出</button></form></section>';
    await refreshChat(me);
    clearInterval(chatTimer);
    chatTimer = setInterval(function () {
      if ((location.hash || "").indexOf("#/chat") !== 0) { clearInterval(chatTimer); return; }
      refreshChat(me);
    }, CHAT_POLL_MS);
  }

  async function refreshChat(me) {
    var list = document.getElementById("chat-list");
    if (!list) return;
    var r = await db().fetchChat(60);
    if (r.error) { list.innerHTML = '<p class="ng">' + esc(r.error) + '</p>'; return; }
    var msgs = r.data.slice().reverse();
    var ids = msgs.map(function (m) { return m.user_id; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var pr = await db().getPublicProfilesByIds(ids);
    var byId = {};
    (pr.data || []).forEach(function (p) { byId[p.id] = p; });

    var atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    if (!msgs.length) { list.innerHTML = '<p class="muted">還沒有訊息，來說第一句話吧！</p>'; return; }
    list.innerHTML = msgs.map(function (m) {
      var p = byId[m.user_id] || { username: "未知" };
      var mine = m.user_id === me;
      var time = new Date(m.created_at).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
      return '<div class="bubble-row' + (mine ? ' mine' : '') + '">' +
        (mine ? '' : '<div class="avatar sm">' + esc(displayName(p).charAt(0).toUpperCase()) + '</div>') +
        '<div class="bubble">' +
        (mine ? '' : '<div class="bubble-name">' + esc(displayName(p)) + '</div>') +
        '<div class="bubble-text">' + esc(m.body) + '</div>' +
        '<div class="bubble-meta">' + time +
        (mine ? ' <button class="linklike-sm" data-action="social-chat-del" data-id="' + m.id + '">收回</button>' : '') +
        '</div></div></div>';
    }).join("");
    if (atBottom) list.scrollTop = list.scrollHeight;
  }

  /* ---------- 事件 ---------- */
  document.addEventListener("submit", async function (e) {
    var form = e.target.closest && e.target.closest('[data-form="social-chat"]');
    if (!form) return;
    e.preventDefault();
    var body = form.body.value.trim();
    if (!body) return;
    var r = await db().sendChat(body);
    if (r.error) { kit().toast(r.error, true); return; }
    form.body.value = "";
    var me = await db().currentUserId();
    refreshChat(me);
  });

  document.addEventListener("click", async function (e) {
    var el = e.target.closest && e.target.closest('[data-action="social-chat-del"]');
    if (!el) return;
    var r = await db().deleteChat(el.getAttribute("data-id"));
    if (r.error) { kit().toast(r.error, true); return; }
    var me = await db().currentUserId();
    refreshChat(me);
  });

  document.addEventListener("change", async function (e) {
    if (e.target.id !== "social-vis") return;
    var r = await db().setPublicVisibility(e.target.checked);
    if (r.error) { kit().toast(r.error, true); e.target.checked = !e.target.checked; return; }
    kit().toast(e.target.checked ? "已公開學習狀況" : "已設為不公開");
  });

  window.Social = { community: community, profile: profile, chat: chat };
})();
