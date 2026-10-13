/*
 * 社群頁面：社群列表、個人檔案、聊天室。
 * 需要 Supabase（window.CloudDB.ready 為 true），並已執行 supabase/03-social.sql。
 * 依賴 app.js 提供的 window.AppKit（在呼叫時才讀取，不在載入時讀取）。
 */
(function () {
  "use strict";

  var CHAT_POLL_MS = 5000;
  var SEND_GAP_MS = 1500;     // 兩則訊息之間的最短間隔
  var lastSentAt = 0;
  // 不當字詞：命中時以「＊」遮蔽。可依需要自行增刪。
  var BLOCKED = ["幹", "靠北", "白痴", "智障", "去死", "fuck", "shit"];
  function maskText(text) {
    var out = text;
    BLOCKED.forEach(function (w) {
      out = out.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), function (m) { return "＊".repeat(m.length); });
    });
    return out;
  }
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
  var sortKey = "completed";
  var SORTS = [["completed", "完成單元"], ["streak", "連續學習"], ["correct", "答對題數"], ["best", "模擬考最高分"]];
  function sortVal(st, key) {
    if (key === "streak") return st.streak || 0;
    if (key === "correct") return st.correct || 0;
    if (key === "best") return st.bestMock || 0;
    return st.completed || 0;
  }
  function unitLabel(key, st) {
    if (key === "streak") return (st.streak || 0) + " 天";
    if (key === "correct") return (st.correct || 0) + " 題";
    if (key === "best") return (st.bestMock || 0) + " 分";
    return (st.completed || 0) + " 單元";
  }

  // 排行榜：可依不同指標排序
  async function community(key) {
    if (!db() || !db().ready) return notReady();
    if (key) sortKey = key;
    loading();
    var r = await db().listPublicStats();
    if (r.error) return fail(r.error);
    var ids = r.data.map(function (x) { return x.user_id; });
    var pr = await db().getPublicProfilesByIds(ids);
    if (pr.error) return fail(pr.error);
    var byId = {};
    pr.data.forEach(function (p) { byId[p.id] = p; });
    var rows = r.data.filter(function (x) { return byId[x.user_id]; }).sort(function (a, b) {
      return sortVal(b.stats, sortKey) - sortVal(a.stats, sortKey);
    });

    var medals = ["🥇", "🥈", "🥉"];
    var html = '<header class="page-head"><span class="eyebrow">Leaderboard</span><h1>社群排行榜</h1>' +
      '<p class="muted">依不同指標排序。點進個人檔案可以看到更多細節。</p></header>' +
      '<div class="chips">' + SORTS.map(function (s) {
        return '<button class="chip' + (s[0] === sortKey ? ' active' : '') + '" data-action="social-sort" data-key="' + s[0] + '">' + s[1] + '</button>';
      }).join("") + '</div>';
    if (!rows.length) html += '<section class="panel"><p class="muted">目前還沒有公開的學習紀錄。</p></section>';
    html += '<div class="people-grid">';
    rows.forEach(function (x, i) {
      var p = byId[x.user_id], st = x.stats || {};
      var total = st.total || 0, done = st.completed || 0;
      html += '<a class="person-card' + (i < 3 ? ' top-' + (i + 1) : '') + '" href="#/u/' + encodeURIComponent(p.username) + '">' +
        '<div class="rank">' + (i < 3 ? medals[i] : '#' + (i + 1)) + '</div>' +
        '<div class="avatar">' + esc(displayName(p).charAt(0).toUpperCase()) + '</div>' +
        '<div class="person-main"><strong>' + esc(displayName(p)) + '</strong>' +
        '<span class="muted small-note">@' + esc(p.username) + '</span>' +
        '<div class="mini-stats"><span>🔥 ' + (st.streak || 0) + ' 天</span><span>✅ ' + done + '/' + total + '</span>' +
        '<span>🏅 ' + (st.achievements || 0) + '</span></div>' +
        '<div class="tile-bar"><span style="width:' + pct(done, total) + '%"></span></div></div>' +
        '<div class="score-tag">' + esc(unitLabel(sortKey, st)) + '</div></a>';
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
        (mine || kit().isAdmin() ? ' <button class="linklike-sm" data-action="social-chat-del" data-id="' + m.id + '">' + (mine ? "收回" : "刪除（管理員）") + '</button>' : '') +
        (!mine ? ' <button class="linklike-sm" data-action="social-report" data-id="' + m.id + '">檢舉</button>' : '') +
        '</div></div></div>';
    }).join("");
    if (atBottom) list.scrollTop = list.scrollHeight;
  }

  /* ---------- 事件 ---------- */
  document.addEventListener("submit", async function (e) {
    var form = e.target.closest && e.target.closest('[data-form="social-chat"]');
    if (!form) return;
    e.preventDefault();
    var body = maskText(form.body.value.trim());
    var nowMs = Date.now();
    if (nowMs - lastSentAt < SEND_GAP_MS) { kit().toast("發言太快了，請稍等一下", true); return; }
    lastSentAt = nowMs;
    if (!body) return;
    var r = await db().sendChat(body);
    if (r.error) { kit().toast(r.error, true); return; }
    form.body.value = "";
    var me = await db().currentUserId();
    refreshChat(me);
  });

  document.addEventListener("click", async function (e) {
    var sortEl = e.target.closest && e.target.closest('[data-action="social-sort"]');
    if (sortEl) { community(sortEl.getAttribute("data-key")); return; }
    var rep = e.target.closest && e.target.closest('[data-action="social-report"]');
    if (rep) {
      if (!confirm("確定檢舉這則訊息？管理員會收到通知。")) return;
      var rr = await db().reportMessage(rep.getAttribute("data-id"), "聊天室檢舉");
      kit().toast(rr.error ? rr.error : "已送出檢舉，謝謝你幫忙維護聊天室", !!rr.error);
      return;
    }
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

  /* ---------- 好友 ---------- */
  function friendErr(msg) {
    var m = String(msg || "");
    if (/duplicate key|already exists/i.test(m)) return "已經送出過邀請，或你們已經是好友";
    if (/row-level security/i.test(m)) return "沒有權限執行這個操作";
    return m;
  }

  async function friends() {
    if (!db() || !db().ready) return notReady();
    var me = await db().currentUserId();
    if (!me) return needLogin();
    loading();
    var f = await db().listFriendships();
    if (f.error) return fail(f.error);
    var rows = f.data || [];
    var otherOf = function (x) { return x.requester === me ? x.addressee : x.requester; };
    var pr = await db().getPublicProfilesByIds(rows.map(otherOf));
    var byId = {};
    (pr.data || []).forEach(function (p) { byId[p.id] = p; });
    var un = await db().unreadSenders();
    var unread = {};
    (un.data || []).forEach(function (x) { unread[x.sender] = (unread[x.sender] || 0) + 1; });

    var incoming = rows.filter(function (x) { return x.status === "pending" && x.addressee === me; });
    var outgoing = rows.filter(function (x) { return x.status === "pending" && x.requester === me; });
    var accepted = rows.filter(function (x) { return x.status === "accepted"; });

    var name = function (id) { return byId[id] ? displayName(byId[id]) : "（未知）"; };
    var html = '<header class="page-head"><span class="eyebrow">Friends</span><h1>好友</h1>' +
      '<p class="muted">邀請朋友加入，就能一對一私訊、一起看進度。</p></header>' +
      '<section class="card-block"><h2>➕ 加好友</h2>' +
      '<form class="friend-add" data-form="social-add"><input type="text" name="username" placeholder="輸入對方的帳號" maxlength="20" autocomplete="off">' +
      '<button class="btn btn-primary" type="submit">送出邀請</button></form></section>';

    if (incoming.length) {
      html += '<section class="card-block"><h2>📩 收到的邀請（' + incoming.length + '）</h2>' + incoming.map(function (x) {
        return '<div class="friend-row"><div class="avatar sm">' + esc(name(x.requester).charAt(0).toUpperCase()) + '</div>' +
          '<strong>' + esc(name(x.requester)) + '</strong><div class="friend-actions">' +
          '<button class="btn btn-sm btn-primary" data-action="social-accept" data-id="' + x.requester + '">接受</button>' +
          '<button class="btn btn-sm btn-ghost" data-action="social-remove" data-id="' + x.requester + '">拒絕</button></div></div>';
      }).join("") + '</section>';
    }
    if (outgoing.length) {
      html += '<section class="card-block"><h2>📤 等待對方回覆（' + outgoing.length + '）</h2>' + outgoing.map(function (x) {
        return '<div class="friend-row"><div class="avatar sm">' + esc(name(x.addressee).charAt(0).toUpperCase()) + '</div>' +
          '<strong>' + esc(name(x.addressee)) + '</strong><div class="friend-actions">' +
          '<button class="btn btn-sm btn-ghost" data-action="social-remove" data-id="' + x.addressee + '">取消邀請</button></div></div>';
      }).join("") + '</section>';
    }
    html += '<section class="card-block"><h2>👫 我的好友（' + accepted.length + '）</h2>';
    if (!accepted.length) html += '<p class="muted">還沒有好友，輸入帳號送出邀請吧。</p>';
    accepted.forEach(function (x) {
      var other = otherOf(x), n = unread[other] || 0;
      html += '<div class="friend-row"><div class="avatar sm">' + esc(name(other).charAt(0).toUpperCase()) + '</div>' +
        '<div><strong>' + esc(name(other)) + '</strong>' + (n ? ' <span class="unread-pill">' + n + ' 則新訊息</span>' : '') + '</div>' +
        '<div class="friend-actions"><a class="btn btn-sm btn-primary" href="#/dm/' + other + '">私訊</a>' +
        '<a class="btn btn-sm btn-ghost" href="#/u/' + encodeURIComponent(byId[other] ? byId[other].username : "") + '">檔案</a>' +
        '<button class="btn btn-sm btn-danger" data-action="social-remove" data-id="' + other + '">解除</button></div></div>';
    });
    root().innerHTML = html + '</section>';
  }

  /* ---------- 私訊 ---------- */
  var dmTimer = null;
  function dmBubble(m, me) {
    var mine = m.sender === me;
    var time = new Date(m.created_at).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
    return '<div class="bubble-row' + (mine ? ' mine' : '') + '"><div class="bubble"><div class="bubble-text">' + esc(m.body) +
      '</div><div class="bubble-meta">' + time + (mine && m.read_at ? ' ・ 已讀' : '') + '</div></div></div>';
  }
  async function refreshDM(me, otherId) {
    var list = document.getElementById("dm-list");
    if (!list) return;
    var r = await db().fetchDM(otherId);
    if (r.error) { list.innerHTML = '<p class="ng">' + esc(friendErr(r.error)) + '</p>'; return; }
    await db().markDMRead(otherId);
    var msgs = r.data.slice().reverse();
    list.innerHTML = msgs.length ? msgs.map(function (m) { return dmBubble(m, me); }).join("") :
      '<p class="muted">還沒有私訊，打聲招呼吧 👋</p>';
    list.scrollTop = list.scrollHeight;
  }
  async function dm(otherId) {
    if (!db() || !db().ready) return notReady();
    var me = await db().currentUserId();
    if (!me) return needLogin();
    var pr = await db().getPublicProfilesByIds([otherId]);
    var p = pr.data && pr.data[0];
    if (!p) return fail("找不到這位使用者，或你們還不是好友");
    root().innerHTML = '<header class="page-head"><span class="eyebrow">Direct message</span>' +
      '<h1>與 ' + esc(displayName(p)) + ' 的私訊</h1><p class="muted"><a href="#/friends">← 返回好友</a></p></header>' +
      '<section class="chat-box"><div id="dm-list" class="chat-list"><p class="muted">載入中…</p></div>' +
      '<form class="chat-form" data-form="social-dm" data-to="' + p.id + '">' +
      '<input type="text" name="body" maxlength="500" placeholder="輸入訊息…" autocomplete="off"><button class="btn btn-primary" type="submit">送出</button></form></section>';
    await refreshDM(me, otherId);
    clearInterval(dmTimer);
    dmTimer = setInterval(function () {
      if ((location.hash || "").indexOf("#/dm/") !== 0) { clearInterval(dmTimer); return; }
      refreshDM(me, otherId);
    }, 4000);
  }

  // 好友與私訊的表單與按鈕
  document.addEventListener("submit", async function (e) {
    var form = e.target.closest && e.target.closest('[data-form="social-add"], [data-form="social-dm"]');
    if (!form) return;
    e.preventDefault();
    if (!db() || !db().ready) return;
    if (form.getAttribute("data-form") === "social-add") {
      var uname = form.username.value.trim();
      if (!uname) return;
      var p = await db().getPublicProfile(uname);
      if (p.error) return kit().toast(p.error, true);
      if (!p.data) return kit().toast("找不到這個帳號", true);
      var me1 = await db().currentUserId();
      if (p.data.id === me1) return kit().toast("不能加自己為好友", true);
      var r = await db().sendFriendRequest(p.data.id);
      if (r.error) return kit().toast(friendErr(r.error), true);
      kit().toast("已送出好友邀請");
      form.username.value = "";
      friends();
      return;
    }
    var body = form.body.value.trim();
    if (!body) return;
    var to = form.getAttribute("data-to");
    var rr = await db().sendDM(to, body);
    if (rr.error) return kit().toast(friendErr(rr.error), true);
    form.body.value = "";
    var me2 = await db().currentUserId();
    refreshDM(me2, to);
  });

  document.addEventListener("click", async function (e) {
    var el = e.target.closest && e.target.closest('[data-action="social-accept"], [data-action="social-remove"]');
    if (!el || !db() || !db().ready) return;
    var id = el.getAttribute("data-id");
    var r = el.getAttribute("data-action") === "social-accept"
      ? await db().acceptFriend(id)
      : await db().removeFriendship(id);
    if (r.error) return kit().toast(friendErr(r.error), true);
    kit().toast(el.getAttribute("data-action") === "social-accept" ? "已成為好友 🎉" : "已更新好友關係");
    friends();
  });

  /* ---------- 私訊收件匣 ---------- */
  async function inbox() {
    if (!db() || !db().ready) return notReady();
    var me = await db().currentUserId();
    if (!me) return needLogin();
    loading();
    var r = await db().recentDM(300);
    if (r.error) return fail(r.error);
    var f = await db().listFriendships();
    if (f.error) return fail(f.error);

    var convo = {};
    (r.data || []).forEach(function (m) {
      var other = m.sender === me ? m.recipient : m.sender;
      if (!convo[other]) convo[other] = { last: m, unread: 0 };
      if (m.recipient === me && !m.read_at) convo[other].unread += 1;
    });
    (f.data || []).forEach(function (x) {
      if (x.status !== "accepted") return;
      var other = x.requester === me ? x.addressee : x.requester;
      if (!convo[other]) convo[other] = { last: null, unread: 0 };
    });
    var ids = Object.keys(convo);
    var pr = await db().getPublicProfilesByIds(ids);
    var byId = {};
    (pr.data || []).forEach(function (p) { byId[p.id] = p; });

    var list = ids.map(function (id) { return { id: id, c: convo[id] }; }).sort(function (a, b) {
      if (!!b.c.unread !== !!a.c.unread) return b.c.unread ? 1 : -1;
      var ta = a.c.last ? Date.parse(a.c.last.created_at) : 0, tb = b.c.last ? Date.parse(b.c.last.created_at) : 0;
      return tb - ta;
    });
    var totalUnread = list.reduce(function (n, x) { return n + x.c.unread; }, 0);

    var html = '<header class="page-head"><span class="eyebrow">Inbox</span><h1>私訊' +
      (totalUnread ? ' <span class="unread-pill big">' + totalUnread + ' 則未讀</span>' : '') + '</h1>' +
      '<p class="muted">只能和好友私訊。<a href="#/friends">管理好友 →</a></p></header>';
    if (!list.length) {
      html += '<section class="card-block empty-state"><div class="empty-ico">💌</div><h2>還沒有好友</h2>' +
        '<p class="muted">先加一位好友，就能開始私訊了。</p><a class="btn btn-primary" href="#/friends">前往好友頁面</a></section>';
    } else {
      html += '<section class="inbox">' + list.map(function (x) {
        var p = byId[x.id], name = p ? displayName(p) : "（未知）";
        var preview = x.c.last ? (x.c.last.sender === me ? "你：" : "") + x.c.last.body : "還沒有訊息，打聲招呼吧";
        var time = x.c.last ? timeAgo(x.c.last.created_at) : "";
        return '<a class="inbox-row' + (x.c.unread ? ' has-unread' : '') + '" href="#/dm/' + x.id + '">' +
          '<div class="avatar">' + esc(name.charAt(0).toUpperCase()) + '</div>' +
          '<div class="inbox-main"><strong>' + esc(name) + '</strong><span class="inbox-prev">' +
          esc(preview.length > 40 ? preview.slice(0, 40) + "…" : preview) + '</span></div>' +
          '<div class="inbox-side"><small>' + esc(time) + '</small>' +
          (x.c.unread ? '<span class="unread-pill">' + x.c.unread + '</span>' : '') + '</div></a>';
      }).join("") + '</section>';
    }
    root().innerHTML = html;
  }

  window.Social = { community: community, profile: profile, chat: chat, friends: friends, dm: dm, inbox: inbox };
})();
