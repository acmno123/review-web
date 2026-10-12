(function () {
  "use strict";

  var CloudSync = window.CloudSync || {
    enabled: function () { return false; },
    boot: function () { return Promise.resolve(); },
    signIn: function () { return Promise.resolve({ error: "尚未載入雲端模組" }); },
    signUp: function () { return Promise.resolve({ error: "尚未載入雲端模組" }); },
    signOut: function () {},
    refreshUsers: function () { return Promise.resolve(); },
    users: function () { return []; },
    setDisabled: function () { return Promise.resolve({ error: null }); }
  };
  var GRADES = window.GRADES;
  var SUBJECTS = window.SUBJECTS;
  var QUIZ = window.QUIZ;
  var LESSONS = window.LESSONS || {};

  var app = document.getElementById("app");
  var nav = document.getElementById("nav");
  var toastBox = document.getElementById("toasts");

  var K_USERS = "crs_users";
  var K_SESSION = "crs_session";
  var K_DATA = "crs_data:";
  var K_CUSTOM = "crs_custom_units";
  var K_VIDEOS = "crs_videos";
  var K_ANNOUNCE = "crs_announce";
  var K_THEME = "crs_theme";
  var K_OVR = "crs_overrides";
  var K_HIDDEN = "crs_hidden";
  var REVIEW_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
  var REVIEW_QUESTIONS = 3;
  var MAX_WRONG = 200;
  var MAX_MOCK_HISTORY = 20;

  var ICON = { math: "📐", science: "🔬", social: "🌏", chinese: "📖", english: "🔤", ja: "🇯🇵" };
  var COLOR = { math: "#6366f1", science: "#10b981", social: "#f59e0b", chinese: "#ef4444", english: "#0ea5e9", ja: "#e11d48" };
  var LV_NAME = { 1: "基礎", 2: "進階", 3: "困難", 4: "魔王" };

  /* 記憶體中的狀態 */
  var practice = null, practiceLevel = 0, reviewState = null;
  var mockCfg = { grade: "all", subject: "all", lang: "all", qlang: "zh", count: 10, level: 0 };
  var qLang = "zh"; // 單元練習的題目語言：zh 中文 / ja 日文版
  var mockState = null;

  /* ---------- 工具 ---------- */
  function load(key, def) {
    try { var v = localStorage.getItem(key); return v === null ? def : JSON.parse(v); }
    catch (e) { return def; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toast(msg, isError) {
    var d = document.createElement("div");
    d.className = "flash" + (isError ? " error" : "");
    d.textContent = msg;
    toastBox.appendChild(d);
    setTimeout(function () { d.remove(); }, 3200);
  }
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }
  function fmtDate(ts) { return new Date(ts).toLocaleDateString("zh-TW"); }
  function lvBadge(lv) { return lv ? '<span class="lv l' + lv + '">' + LV_NAME[lv] + '</span>' : '<span class="lv mix">混合</span>'; }
  function today() { return new Date().toDateString(); }
  function yesterday() { return new Date(Date.now() - 864e5).toDateString(); }
  function download(name, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  /* ---------- 內容：官方單元 + 管理員新增的單元 ---------- */
  var CUSTOM = load(K_CUSTOM, []);
  var VIDEOS = load(K_VIDEOS, {});
  var ALL_UNITS = [];

  function findSubject(id) { return SUBJECTS.find(function (s) { return s.id === id; }); }

  function buildUnits() {
    buildUnitsRaw();
    applyOverrides();
  }
  // 套用管理員的修改（更改提示等），並移除被隱藏的單元
  function applyOverrides() {
    var ovr = load(K_OVR, {}), hidden = load(K_HIDDEN, []);
    ALL_UNITS = ALL_UNITS.filter(function (u) { return hidden.indexOf(u.id) === -1; });
    ALL_UNITS.forEach(function (u) { if (ovr[u.id]) Object.assign(u, ovr[u.id]); });
  }
  // 題庫文字解析：每行「題目 ## 答案」，可選「## 難度(1-4)」
  function parseBank(text) {
    return text.split("\n").map(function (line) {
      var p = line.split("##").map(function (x) { return x.trim(); });
      if (p.length < 2 || !p[0] || !p[1]) return null;
      var lv = Number(p[2]);
      return (lv >= 1 && lv <= 4) ? [p[0], p[1], lv] : [p[0], p[1]];
    }).filter(Boolean);
  }
  function buildUnitsRaw() {
    ALL_UNITS = [];
    SUBJECTS.forEach(function (s) {
      Object.keys(s.chapters).forEach(function (g) {
        s.chapters[g].forEach(function (ch) {
          ch.units.forEach(function (u) {
            var lesson = LESSONS[u.id] || {};
            ALL_UNITS.push(Object.assign({}, u, {
              subjectId: s.id, subjectName: s.name, grade: Number(g), chapterTitle: ch.title,
              hook: u.hook || lesson.hook || "", fun: u.fun || lesson.fun || "", custom: false
            }));
          });
        });
      });
    });
    CUSTOM.forEach(function (c) {
      var s = findSubject(c.subjectId);
      if (!s) return;
      if (s.grades.indexOf(c.grade) === -1) s.grades.push(c.grade);
      ALL_UNITS.push(Object.assign({}, c, { subjectName: s.name, gen: c.gen || [], custom: true }));
    });
  }
  buildUnits();

  function findUnit(id) { return ALL_UNITS.find(function (u) { return u.id === id; }); }

  // 某科某年級的章節（官方章節 + 管理員新增的章節）
  function chaptersOf(s, grade) {
    var list = (s.chapters[grade] || []).map(function (ch) { return { title: ch.title, units: ch.units.slice() }; });
    CUSTOM.filter(function (c) { return c.subjectId === s.id && c.grade === grade; }).forEach(function (c) {
      var ch = list.find(function (x) { return x.title === c.chapterTitle; });
      if (!ch) { ch = { title: c.chapterTitle, units: [] }; list.push(ch); }
      ch.units.push(c);
    });
    var hiddenIds = load(K_HIDDEN, []);
    list.forEach(function (ch) {
      ch.units = ch.units.map(function (u) { return findUnit(u.id) || u; })
        .filter(function (u) { return hiddenIds.indexOf(u.id) === -1; });
    });
    return list.filter(function (ch) { return ch.units.length; });
  }

  /* ---------- 影片 ---------- */
  function ytId(url) {
    var m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  function ytSearchUrl(u) {
    return "https://www.youtube.com/results?search_query=" +
      encodeURIComponent("國中 " + u.subjectName + " " + u.grade + "年級 " + u.title);
  }
  function videosHtml(u) {
    var list = VIDEOS[u.id] || [];
    var html = '<section class="panel"><h2>🎬 影片教學</h2>';
    if (list.length) {
      html += '<div class="video-grid">' + list.map(function (v) {
        var id = ytId(v.url);
        return '<div>' + (id
          ? '<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/' + id +
            '" title="' + esc(v.title) + '" loading="lazy" allowfullscreen></iframe></div>'
          : '') +
          '<p class="video-cap">' + esc(v.title) + '</p></div>';
      }).join("") + '</div>';
    }
    html += '<a class="yt-link" href="' + ytSearchUrl(u) + '" target="_blank" rel="noopener">' +
      '<span class="yt">▶</span><span>在 YouTube 搜尋「' + esc(u.title) + '」的教學影片</span></a>' +
      '<p class="muted" style="margin:8px 0 0">點擊會開新分頁，搜尋結果由 YouTube 提供。</p></section>';
    return html;
  }

  /* ---------- 使用者與管理員 ---------- */
  function getUsers() { return load(K_USERS, {}); }
  function setUsers(u) { save(K_USERS, u); }
  function currentUser() { return load(K_SESSION, null); }
  function isAdmin() {
    var u = currentUser();
    if (!u) return false;
    var cloudAdmin = load("crs_cloud_role", "") === "admin";
    return cloudAdmin;
  }
  // 雲端同步後重新載入內容（管理員可能在別處修改過）
  function reloadContent() {
    CUSTOM = load(K_CUSTOM, []);
    VIDEOS = load(K_VIDEOS, {});
    buildUnits();
  }
  function displayName(user) {
    var rec = getUsers()[user];
    return (rec && rec.nickname) ? rec.nickname : user;
  }
  function getData(user) {
    var d = load(K_DATA + user, null) || {};
    d.units = d.units || {};
    d.earned = d.earned || [];
    d.wrong = d.wrong || [];
    d.mocks = d.mocks || [];
    d.notes = d.notes || {};
    d.goal = d.goal || 5;
    d.today = d.today || { day: "", count: 0 };
    d.streak = d.streak || { day: "", count: 0 };
    d.bestMock = d.bestMock || 0;
    return d;
  }
  function setData(user, data) { save(K_DATA + user, data); }
  function unitRecord(data, unitId) {
    return data.units[unitId] || { review: 0, completed: false, correct: 0, lastReviewed: 0 };
  }
  function touchStreak(data) {
    if (data.streak.day === today()) return;
    data.streak = { day: today(), count: data.streak.day === yesterday() ? data.streak.count + 1 : 1 };
  }
  function currentStreak(data) {
    return (data.streak.day === today() || data.streak.day === yesterday()) ? data.streak.count : 0;
  }
  function addToday(data, n) {
    if (data.today.day !== today()) data.today = { day: today(), count: 0 };
    data.today.count += n || 1;
  }
  function todayCount(data) { return data.today.day === today() ? data.today.count : 0; }
  function addWrong(data, unit, q, a) {
    if (data.wrong.some(function (w) { return w.q === q; })) return;
    data.wrong.push({ q: q, a: a, unitId: unit.id, title: unit.title });
    if (data.wrong.length > MAX_WRONG) data.wrong = data.wrong.slice(-MAX_WRONG);
  }

  /* ---------- 統計與成就 ---------- */
  function computeStats(data) {
    var st = {
      completed: 0, reviews: 0, correct: 0, streak: currentStreak(data),
      mocks: data.mocks.length, bestMock: data.bestMock, bySubject: {}, totalBySubject: {}
    };
    SUBJECTS.forEach(function (s) {
      st.bySubject[s.id] = 0;
      st.totalBySubject[s.id] = ALL_UNITS.filter(function (u) { return u.subjectId === s.id; }).length;
    });
    ALL_UNITS.forEach(function (u) {
      var p = data.units[u.id];
      if (!p) return;
      st.reviews += p.review || 0;
      st.correct += p.correct || 0;
      if (p.completed) { st.completed += 1; st.bySubject[u.subjectId] += 1; }
    });
    return st;
  }
  var ACHIEVEMENTS = [
    { id: "first_unit", name: "初次學習", desc: "完成第 1 個單元的複習", test: function (s) { return s.completed >= 1; } },
    { id: "five_units", name: "穩定進步", desc: "完成 5 個單元的複習", test: function (s) { return s.completed >= 5; } },
    { id: "ten_units", name: "學習達人", desc: "完成 10 個單元的複習", test: function (s) { return s.completed >= 10; } },
    { id: "review_3", name: "溫故知新", desc: "累積複習確認 3 次", test: function (s) { return s.reviews >= 3; } },
    { id: "review_20", name: "複習狂人", desc: "累積複習確認 20 次", test: function (s) { return s.reviews >= 20; } },
    { id: "practice_20", name: "練習入門", desc: "累計練習答對 20 題", test: function (s) { return s.correct >= 20; } },
    { id: "practice_100", name: "百題斬", desc: "累計練習答對 100 題", test: function (s) { return s.correct >= 100; } },
    { id: "streak_3", name: "持之以恆", desc: "連續學習 3 天", test: function (s) { return s.streak >= 3; } },
    { id: "streak_7", name: "七天挑戰", desc: "連續學習 7 天", test: function (s) { return s.streak >= 7; } },
    { id: "mock_1", name: "模擬考初體驗", desc: "完成 1 次模擬考", test: function (s) { return s.mocks >= 1; } },
    { id: "mock_90", name: "考場高手", desc: "模擬考拿到 90 分以上", test: function (s) { return s.bestMock >= 90; } }
  ];
  SUBJECTS.forEach(function (s) {
    ACHIEVEMENTS.push({
      id: "master_" + s.id, name: s.name + "小達人", desc: "完成" + s.name + "所有單元的複習",
      test: function (st) { var t = st.totalBySubject[s.id]; return t > 0 && st.bySubject[s.id] === t; }
    });
  });
  function checkAchievements(user) {
    var data = getData(user), st = computeStats(data), newly = [];
    ACHIEVEMENTS.forEach(function (a) {
      if (data.earned.indexOf(a.id) === -1 && a.test(st)) { data.earned.push(a.id); newly.push(a); }
    });
    setData(user, data);
    newly.forEach(function (a) { toast("🏅 獲得成就：" + a.name); });
  }
  function reviewStatus(rec) {
    if (!rec || !rec.completed) return { key: "todo", label: "未複習", cls: "" };
    if (Date.now() - (rec.lastReviewed || 0) > REVIEW_INTERVAL_MS) return { key: "due", label: "該再複習了", cls: "due" };
    return { key: "done", label: "已確認 ✅", cls: "done" };
  }
  function recordReview(unitId) {
    var user = currentUser();
    if (!user) return false;
    var data = getData(user), rec = unitRecord(data, unitId);
    rec.completed = true;
    rec.review = (rec.review || 0) + 1;
    rec.lastReviewed = Date.now();
    data.units[unitId] = rec;
    touchStreak(data);
    setData(user, data);
    checkAchievements(user);
    return true;
  }

  /* ---------- 密碼雜湊 ---------- */
  function randomHex(bytes) {
    var arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return hex(arr);
  }
  async function hashPassword(password, salt) {
    if (!window.crypto || !crypto.subtle) {
      throw new Error("此瀏覽器無法進行加密，請改用 Chrome、Edge 或 Firefox 的最新版本。");
    }
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + password));
    return hex(buf);
  }
  async function makeCredential(password) {
    var salt = randomHex(16);
    return { salt: salt, hash: await hashPassword(password, salt) };
  }

  /* ---------- 主題 ---------- */
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", load(K_THEME, "light"));
  }
  function toggleTheme() {
    save(K_THEME, load(K_THEME, "light") === "dark" ? "light" : "dark");
    applyTheme();
    render();
  }

  /* ---------- 導覽列 ---------- */
  function renderNav() {
    var user = currentUser(), theme = load(K_THEME, "light");
    var html = '<a href="#/review">複習</a><a href="#/mock">模擬考</a><a href="#/lang/en">英文題庫</a><a href="#/lang/ja">日文題庫</a><a href="#/wrong">錯題本</a><a href="#/people">社群</a><a href="#/chat">聊天室</a>';
    if (user) {
      html += '<a href="#/dashboard">我的學習</a><a href="#/u/' + encodeURIComponent(user) + '">個人檔案</a>';
      if (isAdmin()) html += '<a href="#/admin">管理後台</a>';
      html += '<span class="user">👋 ' + esc(displayName(user)) + '</span><button class="linklike" data-action="logout">登出</button>';
    } else {
      html += '<a href="#/login">登入</a><a class="btn-small" href="#/register">註冊</a>';
    }

    html += '<button class="linklike icon-btn" data-action="theme" title="切換主題">' + (theme === "dark" ? "☀️" : "🌙") + '</button>';
    nav.innerHTML = html;
  }

  /* ---------- 講解與練習 ---------- */
  function lessonInner(u) {
    var h = "";
    if (u.hook) h += '<div class="hook">💡 ' + esc(u.hook) + '</div>';
    h += '<ul class="points">' + u.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join("") + '</ul>';
    if (u.fun) h += '<div class="fun"><strong>🤓 你知道嗎？</strong><br>' + esc(u.fun) + '</div>';
    return h;
  }
  // 出題並避免本次練習已出現過的題目（最多重試 10 次）
  function pickNew(unit, lastQ, seen) {
    var item = null;
    for (var i = 0; i < 10; i++) {
      item = QUIZ.next(unit, lastQ, practiceLevel, qLang);
      if (item.missing || !seen[item.q]) break;
    }
    seen[item.q] = true;
    return item;
  }
  function newPractice(unit) {
    var seen = {};
    var item = pickNew(unit, null, seen);
    return { unit: unit, q: item.q, a: item.a, lv: item.lv, status: "", seen: seen };
  }
  // 作答方式：type 輸入、choice 選擇題
  var answerMode = "type";

  function shuffleArr(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // 產生 4 個選項（1 正解 + 3 干擾），資料不足時回傳 null（改用輸入作答）
  function makeOptions(a, unit) {
    var main = String(a).split("|")[0].trim();
    var alts = String(a).split("|").map(function (x) { return x.trim().toLowerCase(); });
    var out = [];
    if (/^-?\d+(\.\d+)?$/.test(main)) {
      var n = Number(main), dec = (main.split(".")[1] || "").length;
      var step = Math.max(1, Math.round(Math.abs(n) * 0.2));
      var cands = [n + step, n - step, n + 2 * step, n - 2 * step, n + 1, n - 1, n * 2, Math.round(n / 2) + 1];
      cands.forEach(function (c) {
        var t = dec ? c.toFixed(dec) : String(Math.round(c));
        if (out.length < 3 && t !== main && alts.indexOf(t.toLowerCase()) === -1 && out.indexOf(t) === -1) out.push(t);
      });
    } else {
      var pool = [];
      var source = (unit.bank || []).concat(ALL_UNITS.filter(function (u) { return u.subjectId === unit.subjectId; })
        .reduce(function (acc, u) { return acc.concat(u.bank || []); }, []));
      source.forEach(function (b) {
        var t = String(b[1]).split("|")[0].trim();
        if (t && t !== main && alts.indexOf(t.toLowerCase()) === -1 && t.length <= 24 && pool.indexOf(t) === -1) pool.push(t);
      });
      out = shuffleArr(pool).slice(0, 3);
    }
    if (out.length < 3) return null;
    return shuffleArr(out.concat([main]));
  }

  // 統一的答題判斷：答對與答錯都在這裡處理
  function gradeAnswer(val) {
    if (!practice || practice.status === "correct") return;
    var user = currentUser();
    if (QUIZ.check(val, practice.a)) {
      practice.status = "correct";
      if (window.FX) FX.burst(document.querySelector("#practice-box .pq"));
      if (user) {
        var data = getData(user), rec = unitRecord(data, practice.unit.id);
        rec.correct = (rec.correct || 0) + 1;
        data.units[practice.unit.id] = rec;
        data.wrong = data.wrong.filter(function (w) { return w.q !== practice.q; });
        addToday(data);
        touchStreak(data);
        setData(user, data);
        checkAchievements(user);
        render();
        return;
      }
      renderPractice();
      return;
    }
    practice.status = "wrong";
    if (answerMode === "choice" && practice.opts) {
      var idx = practice.opts.indexOf(val);
      practice.badIdx = practice.badIdx || [];
      if (idx !== -1 && practice.badIdx.indexOf(idx) === -1) practice.badIdx.push(idx);
    }
    if (user) {
      var d2 = getData(user);
      addWrong(d2, practice.unit, practice.q, practice.a);
      setData(user, d2);
    }
    renderPractice();
    if (window.FX) FX.shake(document.querySelector("#practice-box .pq"));
  }

  function renderPractice() {
    var box = document.getElementById("practice-box");
    if (!box || !practice) return;
    var st = practice.status, done = st === "correct";

    var html = '<div class="chips mode-chips"><span class="muted" style="align-self:center">作答方式：</span>' +
      [["type", "✍️ 輸入作答"], ["choice", "🎯 選擇題"]].map(function (c) {
        return '<button class="chip' + (answerMode === c[0] ? ' active' : '') + '" data-action="amode" data-mode="' + c[0] + '">' + c[1] + '</button>';
      }).join("") + '</div>';

    html += '<div class="q-stage"><p class="pq">' + lvBadge(practice.lv) + esc(practice.q) + '</p></div>';
    if (st === "revealed") html += '<p class="answer fx-in">答案：' + esc(practice.a.split("|")[0]) + '</p>';

    if (answerMode === "choice" && practice.opts === undefined) practice.opts = makeOptions(practice.a, practice.unit);
    var useChoice = answerMode === "choice" && practice.opts;

    if (useChoice) {
      practice.badIdx = practice.badIdx || [];
      html += '<div class="opt-grid">' + practice.opts.map(function (o, i) {
        var cls = "opt", locked = done || practice.badIdx.indexOf(i) !== -1;
        if (practice.badIdx.indexOf(i) !== -1) cls += " bad";
        if (done && QUIZ.check(o, practice.a)) cls += " good";
        return '<button class="' + cls + ' fx-in" style="animation-delay:' + (i * 60) + 'ms" data-action="pick" data-idx="' + i + '"' +
          (locked ? ' disabled' : '') + '><span class="opt-k">' + "ABCD".charAt(i) + '</span><span>' + esc(o) + '</span></button>';
      }).join("") + '</div>';
    } else {
      if (answerMode === "choice") html += '<p class="muted small-note">此題沒有足夠的選項，改用輸入作答。</p>';
      html += '<div class="pa-row"><input id="practice-input" type="text" autocomplete="off" placeholder="輸入答案"' +
        (done ? ' disabled' : '') + '><button class="btn btn-primary" data-action="check"' + (done ? ' disabled' : '') + '>檢查</button></div>';
    }

    if (done) html += '<p class="ok fx-in">✅ 答對了！</p>';
    if (st === "wrong") html += '<p class="ng fx-in">❌ 不對，再試一次，或按「看答案」。</p>';
    html += '<div class="actions"><button class="btn" data-action="next">換一題</button>' +
      '<button class="btn btn-ghost" data-action="reveal">看答案</button></div>';

    box.innerHTML = html;
    var inp = document.getElementById("practice-input");
    if (inp && !inp.disabled) inp.focus();
  }

  function makeReviewItems(u) {
    var items = [], seen = {}, tries = 0;
    while (items.length < REVIEW_QUESTIONS && tries < 40) {
      tries++;
      var it = QUIZ.next(u, null, 0);
      if (!seen[it.q]) { seen[it.q] = true; items.push({ q: it.q, a: it.a, lv: it.lv, ok: false }); }
    }
    return items;
  }
  function renderReview() {
    var box = document.getElementById("review-box");
    if (!box || !reviewState) return;
    var st = reviewState, html = "";
    st.items.forEach(function (it, i) {
      html += '<div class="rq"><p>' + lvBadge(it.lv) + '<strong>第 ' + (i + 1) + ' 題：</strong>' + esc(it.q) + '</p>';
      if (it.ok) html += '<p class="ok">✅ 答對了</p>';
      else html += '<div class="pa-row"><input id="rin-' + i + '" type="text" autocomplete="off" placeholder="輸入答案">' +
        '<button class="btn btn-primary" data-action="rcheck" data-idx="' + i + '">檢查</button></div>';
      html += '</div>';
    });
    if (st.done) {
      html += st.saved ? '<p class="ok">🎉 全部答對，已確認複習！</p>' : '<p class="ng">🎉 全部答對！登入後即可把這次複習記錄下來。</p>';
      html += '<div class="actions"><button class="btn" data-action="rrestart">再練一次</button>' +
        '<a class="btn btn-primary" href="#/review">回到複習中心</a></div>';
    } else {
      var ok = st.items.filter(function (x) { return x.ok; }).length;
      html += '<p class="muted">已答對 ' + ok + ' / ' + st.items.length + ' 題</p>';
    }
    box.innerHTML = html;
    var first = box.querySelector("input");
    if (first) first.focus();
  }

  /* ---------- 頁面：首頁與搜尋 ---------- */
  function notFound() { app.innerHTML = '<div class="panel"><h1>找不到這個頁面</h1><p><a href="#/">回到首頁</a></p></div>'; }

  function langChips() {
    return '<div class="chips"><span class="muted" style="align-self:center">題目語言：</span>' +
      [["zh", "中文"], ["ja", "日文版"]].map(function (c) {
        return '<button class="chip' + (qLang === c[0] ? ' active' : '') + '" data-action="qlang" data-lang="' + c[0] + '">' + c[1] + '</button>';
      }).join("") + '</div>';
  }

  function levelChips() {
    return '<div class="chips">' + [[0, "混合"], [1, "基礎"], [2, "進階"], [3, "困難"], [4, "魔王"]].map(function (c) {
      return '<button class="chip' + (practiceLevel === c[0] ? ' active' : '') + '" data-action="level" data-lv="' + c[0] + '">' + c[1] + '</button>';
    }).join("") + '</div>';
  }

  function viewLang(lang) {
    var isJa = lang === "ja";
    var bank = (window.LANG_BANK && window.LANG_BANK[lang]) || [];
    var unit = { id: "lang-" + lang, title: isJa ? "日文題庫" : "英文題庫", subjectName: isJa ? "日文" : "英文",
      grade: 0, chapterTitle: "", points: [], gen: [], genFns: (window.LANG_GENS && window.LANG_GENS[lang]) || [],
      bank: bank, custom: false };
    qLang = "zh";
    if (!practice || practice.unit.id !== unit.id) practice = newPractice(unit);
    app.innerHTML = '<section class="hero hero-compact"><div><span class="eyebrow">' + (isJa ? "🇯🇵 日本語" : "🔤 English") + '</span>' +
      '<h1>' + (isJa ? "日文題庫" : "英文題庫") + '</h1>' +
      '<p>整批練習，題目全部是' + (isJa ? "日文" : "英文") + '，依難度隨機出題。' +
      (isJa ? "包含五十音、數字、動詞變化等 " : "包含不規則動詞、比較級、複數等 ") + unit.genFns.length + ' 種題型，本次練習不會重複出題。</p></div></section>' +
      '<section class="panel"><h2>✏️ 練習</h2>' + levelChips() + '<div id="practice-box"></div></section>';
    renderPractice();
  }

  function viewHome() {
    var user = currentUser();
    var data = user ? getData(user) : { units: {}, wrong: [], mocks: [], bestMock: 0, streak: { day: "", count: 0 }, today: { day: "", count: 0 }, goal: 5 };
    var st = computeStats(data);
    var announce = load(K_ANNOUNCE, "");

    var html = '<section class="hero"><div>' +
      '<span class="eyebrow">108 課綱・國一至國三</span>' +
      '<h1>國中複習站</h1>' +
      '<p>趣味講解、無限練習、模擬考與錯題本。答錯的題目會自動收進錯題本，' +
      '還能切換日文版題目與魔王級挑戰。</p>' +
      '<div class="hero-actions">' +
      '<a class="btn btn-light" href="#/review">開始複習</a>' +
      '<a class="btn btn-ghost-light" href="#/mock">模擬考</a>' +
      '<a class="btn btn-ghost-light" href="#/lang/en">英文題庫</a>' +
      '<a class="btn btn-ghost-light" href="#/lang/ja">日文題庫</a>' +
      '</div></div></section>';

    if (announce) html += '<div class="announce">📢 ' + esc(announce) + '</div>';
    html += '<form class="search" data-form="search"><input type="text" name="q" placeholder="搜尋單元，例如：方程式、密度、現在式">' +
      '<button class="btn btn-primary" type="submit">搜尋</button></form>';

    html += '<div class="stats">' +
      '<div class="stat"><div class="num">' + ALL_UNITS.length + '</div><div class="lbl">收錄單元</div></div>' +
      '<div class="stat"><div class="num">' + st.completed + '</div><div class="lbl">已確認複習</div></div>' +
      '<div class="stat"><div class="num">' + st.streak + '</div><div class="lbl">連續學習（天）</div></div>' +
      '<div class="stat"><div class="num">' + (user ? data.wrong.length : 0) + '</div><div class="lbl">錯題本題數</div></div></div>';

    GRADES.forEach(function (g) {
      html += '<section class="grade-block"><h2>' + g.label + '</h2><div class="tile-grid">';
      var any = false;
      SUBJECTS.forEach(function (s) {
        if (s.grades.indexOf(g.num) === -1) return;
        any = true;
        var total = ALL_UNITS.filter(function (u) { return u.subjectId === s.id && u.grade === g.num; }).length;
        var done = ALL_UNITS.filter(function (u) { return u.subjectId === s.id && u.grade === g.num && data.units[u.id] && data.units[u.id].completed; }).length;
        var pct = total ? Math.round(done / total * 100) : 0;
        html += '<a class="tile" style="--c:' + (COLOR[s.id] || "#6366f1") + '" href="#/grade/' + g.num + '/' + s.id + '">' +
          '<span class="tile-icon">' + (ICON[s.id] || "📘") + '</span>' +
          '<span class="tile-name">' + esc(s.name) + '</span>' +
          '<span class="tile-meta">' + total + ' 單元' + (user ? '・已複習 ' + done : '') + '</span>' +
          '<span class="tile-bar"><span style="width:' + pct + '%"></span></span></a>';
      });
      if (!any) html += '<p class="muted">內容製作中，敬請期待。</p>';
      html += '</div></section>';
    });
    app.innerHTML = html;
  }

  function viewSearch(q) {
    var key = q.trim().toLowerCase();
    var hits = ALL_UNITS.filter(function (u) {
      var text = [u.title, u.hook, u.fun, u.chapterTitle, u.subjectName].concat(u.points).join(" ").toLowerCase();
      return key && text.indexOf(key) !== -1;
    });
    var html = '<h1>搜尋：' + esc(q) + '</h1><p class="muted">找到 ' + hits.length + ' 個單元</p>';
    if (!hits.length) html += '<section class="panel"><p>沒有找到相關單元，試試其他關鍵字。</p></section>';
    html += '<section class="panel"><ul class="unit-list">' + hits.map(function (u) {
      return '<li><a href="#/unit/' + esc(u.id) + '">' + esc(u.subjectName) + '・' + u.grade + ' 年級・' + esc(u.title) + '</a></li>';
    }).join("") + '</ul></section>';
    app.innerHTML = html;
  }

  function viewSubject(grade, subjectId) {
    var s = findSubject(subjectId);
    if (!s || s.grades.indexOf(grade) === -1) return notFound();
    var chapters = chaptersOf(s, grade);
    var html = '<nav class="breadcrumb"><a href="#/">首頁</a> / ' + esc(s.name) + '（' + grade + ' 年級）</nav>' +
      '<h1>' + (ICON[s.id] || "") + ' ' + esc(s.name) + '　' + grade + ' 年級</h1>';
    if (!chapters.length) html += '<p class="muted">本科此年級內容製作中。</p>';
    chapters.forEach(function (ch) {
      html += '<section class="chapter"><h2>' + esc(ch.title) + '</h2><ul class="unit-list">' +
        ch.units.map(function (u) { return '<li><a href="#/unit/' + esc(u.id) + '">' + esc(u.title) + '</a></li>'; }).join("") +
        '</ul></section>';
    });
    app.innerHTML = html;
  }

  /* ---------- 頁面：單元 ---------- */
  function statRow(rec) {
    return '<div class="stat-row">' +
      '<div><span class="num">' + rec.review + '</span><span class="lbl">複習確認</span></div>' +
      '<div><span class="num">' + rec.correct + '</span><span class="lbl">練習答對</span></div>' +
      '<div><span class="num small">' + (rec.lastReviewed ? fmtDate(rec.lastReviewed) : "—") + '</span><span class="lbl">上次確認</span></div>' +
      '</div>';
  }

  function notesBlock(u, data) {
    return '<section class="card-block"><h2>📝 我的筆記</h2>' +
      '<textarea id="note-box" placeholder="寫下心得、容易忘記的地方…">' + esc((data.notes || {})[u.id] || "") + '</textarea>' +
      '<div class="actions"><button class="btn btn-primary" data-action="savenote" data-unit="' + esc(u.id) + '">儲存筆記</button></div></section>';
  }

  function viewUnit(unitId) {
    var u = findUnit(unitId);
    if (!u) return notFound();
    var user = currentUser();
    var data = user ? getData(user) : null;
    var rec = data ? unitRecord(data, unitId) : null;
    if (!practice || practice.unit.id !== u.id) practice = newPractice(u);
    var color = COLOR[u.subjectId] || "#6366f1";

    var html = '<nav class="crumbs"><a href="#/">首頁</a><span>›</span>' +
      '<a href="#/grade/' + u.grade + '/' + u.subjectId + '">' + esc(u.subjectName) + '　' + u.grade + ' 年級</a>' +
      '<span>›</span><b>' + esc(u.title) + '</b></nav>' +
      '<header class="unit-hero" style="--c:' + color + '"><div>' +
      '<span class="eyebrow">' + (ICON[u.subjectId] || "📘") + ' ' + esc(u.subjectName) + '・' + u.grade + ' 年級</span>' +
      '<h1>' + esc(u.title) + (u.custom ? ' <span class="badge">自訂</span>' : '') + '</h1>' +
      '<p class="muted">' + esc(u.chapterTitle) + '</p></div>' +
      '<div class="unit-hero-side">' + (user
        ? '<span class="rstatus ' + reviewStatus(rec).cls + '">' + reviewStatus(rec).label + '</span>'
        : '<a class="btn btn-sm" href="#/login">登入以記錄進度</a>') + '</div></header>';

    html += '<div class="unit-grid"><div class="unit-col">' +
      '<section class="card-block lesson"><h2>📘 重點講解</h2>' + lessonInner(u) + '</section>' +
      videosHtml(u) + '</div>' +
      '<aside class="unit-col">' +
      '<section class="card-block"><h2>📊 我的紀錄</h2>' + (user
        ? statRow(rec) + '<div class="actions"><a class="btn btn-primary" href="#/review/' + u.id + '">前往複習</a></div>'
        : '<p class="muted">登入後可記錄複習與練習成績。不登入也能直接練習。</p>') + '</section>' +
      (user ? notesBlock(u, data) : '') +
      '</aside></div>';

    html += '<section class="card-block practice-block"><div class="block-head"><h2>✏️ 無限練習</h2>' +
      levelChips() + '</div>' + langChips() + '<div id="practice-box"></div></section>';
    app.innerHTML = html;
    renderPractice();
  }

  function viewReview(unitId) {
    var u = findUnit(unitId);
    if (!u) return notFound();
    var user = currentUser();
    var rec = user ? unitRecord(getData(user), unitId) : null;
    if (!reviewState || reviewState.unit.id !== u.id) {
      reviewState = { unit: u, items: makeReviewItems(u), done: false, saved: false };
    }
    app.innerHTML = '<nav class="breadcrumb"><a href="#/review">複習中心</a> / ' + esc(u.title) + '</nav>' +
      '<h1>複習：' + esc(u.title) + '</h1>' +
      '<p class="muted">' + esc(u.subjectName) + '（' + u.grade + ' 年級）・' + esc(u.chapterTitle) + '</p>' +
      '<section class="panel lesson"><h2>步驟 1　閱讀講解</h2>' + lessonInner(u) + '</section>' +
      '<section class="panel"><h2>步驟 2　回答 ' + reviewState.items.length + ' 題確認複習</h2>' +
      '<p class="muted">全部答對後，這個單元會記為已複習。題目難度混合。</p><div id="review-box"></div>' +
      (rec && rec.lastReviewed ? '<p class="muted">上次確認：' + fmtDate(rec.lastReviewed) + '</p>' : '') + '</section>';
    renderReview();
  }

  function viewReviewList() {
    var user = currentUser();
    var data = user ? getData(user) : { units: {} };
    var total = ALL_UNITS.length, done = 0, due = 0;
    ALL_UNITS.forEach(function (u) {
      var s = reviewStatus(data.units[u.id]);
      if (s.key === "done") done++;
      if (s.key === "due") due++;
    });
    var pct = total ? Math.round(done / total * 100) : 0;
    var html = '<h1>複習中心</h1><p class="muted">閱讀講解後回答題目就能確認複習。確認後超過 7 天，會提醒你再複習。</p>' +
      '<section class="panel progress-hero"><div class="ring" style="background:conic-gradient(#6366f1 ' + pct + '%, var(--line) 0)" data-label="' + pct + '%"></div>' +
      '<div><p>已確認 <strong>' + done + '</strong> / ' + total + ' 個單元</p><p>需要再複習：<strong>' + due + '</strong> 個</p>' +
      (user ? '' : '<p class="muted"><a href="#/login">登入</a>後，複習紀錄才會被保存。</p>') + '</div></section>';

    SUBJECTS.forEach(function (s) {
      html += '<section class="panel"><h2>' + (ICON[s.id] || "") + ' ' + esc(s.name) + '</h2>';
      s.grades.slice().sort().forEach(function (g) {
        var units = [];
        chaptersOf(s, g).forEach(function (ch) { units = units.concat(ch.units); });
        if (!units.length) return;
        html += '<h3>' + g + ' 年級</h3><ul class="review-list">' + units.map(function (u) {
          var st = reviewStatus(data.units[u.id]);
          return '<li><a href="#/review/' + esc(u.id) + '">' + esc(u.title) + '</a><span class="rstatus ' + st.cls + '">' + st.label + '</span></li>';
        }).join("") + '</ul>';
      });
      html += '</section>';
    });
    app.innerHTML = html;
  }

  /* ---------- 頁面：模擬考 ---------- */
  function viewMock() {
    if (!mockState || mockState.phase === "setup") return viewMockSetup();
    if (mockState.phase === "test") return viewMockTest();
    return viewMockResult();
  }
  function selectOpt(name, value, options) {
    return '<select data-cfg="' + name + '">' + options.map(function (o) {
      return '<option value="' + o[0] + '"' + (String(o[0]) === String(value) ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join("") + '</select>';
  }
  function mockHistoryTable(list) {
    if (!list.length) return '<p class="muted">還沒有模擬考紀錄。</p>';
    return '<div class="table-wrap"><table class="table"><tr><th>日期</th><th>範圍</th><th>分數</th></tr>' +
      list.map(function (m) {
        return '<tr><td>' + fmtDate(m.date) + '</td><td>' + esc(m.scope) + '</td><td><strong>' + m.score + '</strong> 分</td></tr>';
      }).join("") + '</table></div>';
  }
  function seg(key, current, items) {
    return '<div class="seg">' + items.map(function (it) {
      var on = String(it[0]) === String(current);
      return '<button class="seg-btn' + (on ? ' on' : '') + '" data-action="mset" data-key="' + key +
        '" data-val="' + it[0] + '">' + it[1] + '</button>';
    }).join("") + '</div>';
  }

  function viewMockSetup() {
    var subj = [["all", "全部科目"]].concat(SUBJECTS.map(function (x) { return [x.id, (ICON[x.id] || "") + " " + x.name]; }));
    var scope = (mockCfg.grade === "all" ? "全部年級" : mockCfg.grade + " 年級") + "・" +
      (mockCfg.subject === "all" ? "全部科目" : findSubject(mockCfg.subject).name) + "・" +
      (mockCfg.qlang === "ja" ? "日文版" : "中文") + "・" + (["混合", "基礎", "進階", "困難", "魔王"][mockCfg.level]) + "難度・" + mockCfg.count + " 題";
    var html = '<header class="page-head"><span class="eyebrow">Mock Exam</span><h1>模擬考</h1>' +
      '<p class="muted">從收錄的單元隨機抽題，模擬會考的作答感覺。題目依課綱原創，與真正會考題不同。</p></header>' +
      '<div class="setup-grid">' +
      '<section class="card-block"><h2><span class="step">1</span>年級</h2>' +
        seg("grade", mockCfg.grade, [["all", "全部"], [7, "七年級"], [8, "八年級"], [9, "九年級"]]) + '</section>' +
      '<section class="card-block"><h2><span class="step">2</span>科目</h2>' +
        '<div class="seg wrap">' + subj.map(function (x) {
          return '<button class="seg-btn' + (mockCfg.subject === x[0] ? ' on' : '') + '" data-action="mset" data-key="subject" data-val="' + x[0] + '">' + x[1] + '</button>';
        }).join("") + '</div></section>' +
      '<section class="card-block"><h2><span class="step">3</span>題目語言</h2>' +
        seg("qlang", mockCfg.qlang, [["zh", "中文"], ["ja", "日文版"]]) +
        '<p class="muted small-note">日文版只會出現有日文版的單元。</p></section>' +
      '<section class="card-block"><h2><span class="step">4</span>難度</h2>' +
        seg("level", mockCfg.level, [[0, "混合"], [1, "基礎"], [2, "進階"], [3, "困難"], [4, "魔王 🔥"]]) + '</section>' +
      '<section class="card-block"><h2><span class="step">5</span>題數</h2>' +
        seg("count", mockCfg.count, [[10, "10 題"], [15, "15 題"], [20, "20 題"]]) + '</section>' +
      '<section class="card-block start-card"><div><span class="eyebrow">本次設定</span><p>' + esc(scope) + '</p></div>' +
        '<button class="btn btn-primary btn-lg" data-action="mstart">開始模擬考</button></section>' +
      '</div>';
    var user = currentUser();
    if (user) html += '<section class="card-block"><h2>最近的成績</h2>' + mockHistoryTable(getData(user).mocks.slice(-5).reverse()) + '</section>';
    app.innerHTML = html;
  }

  function startMock() {
    var pool = ALL_UNITS.filter(function (u) {
      return (mockCfg.grade === "all" || u.grade === Number(mockCfg.grade)) &&
             (mockCfg.subject === "all" || u.subjectId === mockCfg.subject) &&
             (mockCfg.lang === "all" || (mockCfg.lang === "japanese" ? u.subjectId === "ja" : u.subjectId === "english"));
    });
    if (!pool.length) { toast("這個範圍目前沒有單元", true); return; }
    var count = Number(mockCfg.count), questions = [], seen = {}, tries = 0, lastQ = null;
    while (questions.length < count && tries < count * 10) {
      tries++;
      var u = pool[Math.floor(Math.random() * pool.length)];
      var item = QUIZ.next(u, lastQ, Number(mockCfg.level), mockCfg.qlang === "ja" ? "ja" : "zh");
      if (item.missing) continue;
      if (seen[item.q]) continue;
      seen[item.q] = true; lastQ = item.q;
      questions.push({ unit: u, q: item.q, a: item.a, lv: item.lv });
    }
    var subj = mockCfg.subject === "all" ? "全部科目" : findSubject(mockCfg.subject).name;
    var grade = mockCfg.grade === "all" ? "全部年級" : mockCfg.grade + " 年級";
    mockState = { phase: "test", questions: questions, results: [], score: 0, scope: grade + "・" + subj };
    render();
  }
  function viewMockTest() {
    var n = mockState.questions.length;
    var html = '<header class="page-head mock-head"><div><span class="eyebrow">進行中</span><h1>' + esc(mockState.scope) + '</h1>' +
      '<p class="muted">共 ' + n + ' 題。全部作答後按下交卷。</p></div></header>';
    html += '<div class="q-list">';
    mockState.questions.forEach(function (it, i) {
      html += '<article class="q-card"><div class="q-no">' + (i + 1) + '</div><div class="q-body">' +
        '<p>' + lvBadge(it.lv) + '<span class="q-text">' + esc(it.q) + '</span></p>' +
        '<input id="mi-' + i + '" type="text" autocomplete="off" placeholder="輸入答案"></div></article>';
    });
    html += '</div><div class="sticky-foot"><button class="btn btn-primary btn-lg" data-action="msubmit">交卷</button>' +
      '<button class="btn btn-ghost" data-action="mcancel">放棄本次</button></div>';
    app.innerHTML = html;
  }

  function viewMockResult() {
    var total = mockState.questions.length, pct = Math.round(mockState.score / total * 100);
    var html = '<section class="result-hero"><div class="ring big" style="background:conic-gradient(var(--brand1) ' +
      (pct * 3.6) + 'deg, var(--line) 0)" data-label="' + pct + '"></div>' +
      '<div><span class="eyebrow">模擬考結果</span><h1>' + (pct >= 90 ? "太厲害了！" : pct >= 60 ? "不錯，繼續加油" : "別灰心，來看看錯題") + '</h1>' +
      '<p class="muted">' + esc(mockState.scope) + '</p><p>答對 <strong>' + mockState.score + '</strong> / ' + total + ' 題</p>' +
      '<div class="actions"><button class="btn btn-primary" data-action="mreset">再考一次</button>' +
      '<a class="btn" href="#/wrong">查看錯題本</a></div></div></section>';
    html += '<div class="q-list">';
    mockState.questions.forEach(function (it, i) {
      var r = mockState.results[i];
      html += '<article class="q-card ' + (r.ok ? 'is-ok' : 'is-ng') + '"><div class="q-no">' + (i + 1) + '</div><div class="q-body">' +
        '<p>' + lvBadge(it.lv) + '<span class="q-text">' + esc(it.q) + '</span></p>' +
        '<p>你的答案：<strong>' + esc(r.input || "（未作答）") + '</strong>　' +
        (r.ok ? '<span class="ok">✅ 正確</span>' : '<span class="ng">❌ 正確答案：' + esc(it.a.split("|")[0]) + '</span>') + '</p>' +
        '<p class="muted small-note">' + esc(it.unit.title) + '</p></div></article>';
    });
    app.innerHTML = html + '</div>';
  }

  function submitMock() {
    var total = mockState.questions.length, score = 0, user = currentUser();
    mockState.results = mockState.questions.map(function (it, i) {
      var inp = document.getElementById("mi-" + i), val = inp ? inp.value : "";
      var ok = val.trim() !== "" && QUIZ.check(val, it.a);
      if (ok) score++;
      return { input: val, ok: ok };
    });
    mockState.score = score;
    var pct = Math.round(score / total * 100);
    if (user) {
      var data = getData(user);
      mockState.results.forEach(function (r, i) {
        var it = mockState.questions[i];
        if (r.ok) {
          var rec = unitRecord(data, it.unit.id);
          rec.correct = (rec.correct || 0) + 1;
          data.units[it.unit.id] = rec;
          addToday(data);
        } else {
          addWrong(data, it.unit, it.q, it.a);
        }
      });
      data.mocks.push({ date: Date.now(), score: pct, scope: mockState.scope });
      if (data.mocks.length > MAX_MOCK_HISTORY) data.mocks = data.mocks.slice(-MAX_MOCK_HISTORY);
      data.bestMock = Math.max(data.bestMock, pct);
      touchStreak(data);
      setData(user, data);
      checkAchievements(user);
    } else {
      toast("登入後，模擬考成績與錯題會被保存");
    }
    mockState.phase = "result";
    render();
  }

  /* ---------- 頁面：錯題本、儀表板 ---------- */
  function viewWrong() {
    var user = currentUser();
    if (!user) { app.innerHTML = '<h1>錯題本</h1><section class="panel"><p><a href="#/login">登入</a>後，答錯的題目會自動收錄在這裡。</p></section>'; return; }
    var data = getData(user);
    var html = '<h1>錯題本</h1><p class="muted">答錯的題目會自動收進來。在這裡重新作答，答對後就會移出錯題本。</p>';
    if (!data.wrong.length) {
      html += '<section class="panel"><p>目前沒有錯題，太棒了！🎉</p></section>';
    } else {
      html += '<section class="panel"><p>共 <strong>' + data.wrong.length + '</strong> 題</p>';
      data.wrong.forEach(function (w, i) {
        html += '<div class="rq"><p><strong>' + esc(w.title) + '</strong></p><p class="pq">' + esc(w.q) + '</p>' +
          '<div class="pa-row"><input id="win-' + i + '" type="text" autocomplete="off" placeholder="輸入答案">' +
          '<button class="btn btn-primary" data-action="wcheck" data-idx="' + i + '">檢查</button>' +
          '<button class="btn btn-ghost" data-action="wreveal" data-idx="' + i + '">看答案</button></div>' +
          '<p class="answer" id="wans-' + i + '" style="display:none">答案：' + esc(w.a.split("|")[0]) + '</p></div>';
      });
      html += '</section>';
    }
    app.innerHTML = html;
  }

  function viewAuth(mode) {
    var isLogin = mode === "login";
    app.innerHTML = '<div class="auth-box"><h1>' + (isLogin ? "登入" : "註冊") + '</h1>' +
      '<form data-form="' + mode + '"><label>帳號（3–20 字，英數字或底線）<input type="text" name="username" required autofocus maxlength="20"></label>' +
      (isLogin ? '' : '<label>顯示名稱（選填，最多 12 字）<input type="text" name="nickname" maxlength="12"></label>') +
      '<label>密碼' + (isLogin ? '' : '（至少 6 個字元）') + '<input type="password" name="password" required' +
      (isLogin ? '' : ' minlength="6"') + '></label><div class="msg" id="auth-msg"></div>' +
      '<button type="submit" class="btn btn-primary btn-block">' + (isLogin ? "登入" : "建立帳號") + '</button></form>' +
      '<p class="muted">' + (isLogin ? '還沒有帳號？<a href="#/register">立即註冊</a>' : '已經有帳號？<a href="#/login">前往登入</a>') + '</p></div>';
  }

  function viewDashboard(user) {
    var data = getData(user), st = computeStats(data), total = ALL_UNITS.length;
    var pct = total ? Math.round(st.completed / total * 100) : 0;
    var goal = data.goal, doneToday = todayCount(data), gpct = Math.min(100, Math.round(doneToday / goal * 100));
    var html = '<h1>我的學習</h1>' +
      '<section class="panel progress-hero"><div class="ring" style="background:conic-gradient(#6366f1 ' + pct + '%, var(--line) 0)" data-label="' + pct + '%"></div>' +
      '<div><p>已確認複習 <strong>' + st.completed + '</strong> / ' + total + ' 個單元</p>' +
      '<p>連續學習 <strong>' + st.streak + '</strong> 天　累計練習答對 <strong>' + st.correct + '</strong> 題</p>' +
      '<p>錯題本 <strong>' + data.wrong.length + '</strong> 題　模擬考 <strong>' + data.mocks.length + '</strong> 次</p></div></section>' +
      '<section class="panel"><h2>🎯 今日目標</h2><p>今天已答對 <strong>' + doneToday + '</strong> / ' + goal + ' 題</p>' +
      '<div class="bar"><div class="bar-fill" style="width:' + gpct + '%"></div></div>' +
      '<form data-form="goal" class="inline" style="margin-top:14px"><label style="margin:0">每日目標題數 <input type="number" name="goal" min="1" max="100" value="' + goal + '"></label>' +
      '<button class="btn btn-sm" type="submit">設定</button></form></section>' +
      '<section class="panel"><h2>各科進度</h2>';
    SUBJECTS.forEach(function (s) {
      var t = st.totalBySubject[s.id], d = st.bySubject[s.id], p = t ? Math.round(d / t * 100) : 0;
      html += '<div class="subject-row"><span class="subject-name">' + (ICON[s.id] || "") + ' ' + esc(s.name) + '</span>' +
        '<div class="bar"><div class="bar-fill" style="width:' + p + '%"></div></div><span class="subject-num">' + d + ' / ' + t + '</span></div>';
    });
    html += '</section><section class="panel"><h2>模擬考紀錄</h2>' + mockHistoryTable(data.mocks.slice(-5).reverse()) + '</section>';
    html += '<section class="panel"><h2>💾 備份與還原</h2><p class="muted">資料只存在這台瀏覽器。定期下載備份，換電腦或清除瀏覽器資料時可以還原。</p>' +
      '<div class="actions"><button class="btn" data-action="export-user">下載我的學習資料</button>' +
      '<label class="btn" style="margin:0;cursor:pointer">匯入備份<input type="file" id="import-file" accept="application/json" hidden></label></div></section>';
    html += '<section class="panel"><h2>🏅 成就</h2><div class="achievement-grid">';
    ACHIEVEMENTS.forEach(function (a) {
      var earned = data.earned.indexOf(a.id) !== -1;
      html += '<div class="achievement ' + (earned ? "earned" : "locked") + '"><div class="ach-icon">' + (earned ? "🏅" : "🔒") +
        '</div><div class="ach-name">' + esc(a.name) + '</div><div class="ach-desc">' + esc(a.desc) + '</div></div>';
    });
    app.innerHTML = html + '</div></section>';
  }

  /* ---------- 頁面：管理後台 ---------- */
  function viewAdmin(tab, arg) {
    if (!isAdmin()) { toast("需要管理員權限", true); location.hash = "#/login"; return; }
    tab = tab || "users";
    if (tab !== "users") window.__usersFresh = false;
    if (CloudSync.enabled() && tab === "users" && !window.__usersFresh) {
      window.__usersFresh = true;
      CloudSync.refreshUsers().then(render);
    }
    var side = [["users", "👥", "帳號管理"], ["units", "📚", "單元管理"], ["content", "➕", "新增單元"],
      ["videos", "🎬", "影片管理"], ["announce", "📢", "公告"], ["system", "⚙️", "系統"]];
    var main;
    if (tab === "users") main = adminUsers();
    else if (tab === "units") main = arg ? adminUnitEdit(arg) : adminUnits();
    else if (tab === "content") main = adminContent();
    else if (tab === "videos") main = adminVideos();
    else if (tab === "announce") main = adminAnnounce();
    else main = adminSystem();
    app.innerHTML = '<div class="admin-layout"><aside class="admin-side"><div class="admin-brand">管理後台 <span class="admin-badge">ADMIN</span></div>' +
      side.map(function (t) {
        return '<a class="side-link' + (t[0] === tab ? ' active' : '') + '" href="#/admin/' + t[0] + '"><span>' + t[1] + '</span>' + t[2] + '</a>';
      }).join("") + '</aside><div class="admin-main">' + main + '</div></div>';
  }

  function rawUnit(id) {
    var found = null;
    SUBJECTS.forEach(function (s) {
      Object.keys(s.chapters).forEach(function (g) {
        s.chapters[g].forEach(function (ch) {
          ch.units.forEach(function (u) { if (u.id === id) found = u; });
        });
      });
    });
    return found || CUSTOM.find(function (c) { return c.id === id; }) || null;
  }

  function adminUnits() {
    var hidden = load(K_HIDDEN, []);
    var html = '<section class="panel"><h2>單元管理</h2><p class="muted">修改單元的開場提示、重點、冷知識與題庫（更改提示）。' +
      '隱藏的單元不會出現在學生端。自訂單元可直接刪除。</p>';
    SUBJECTS.forEach(function (s) {
      s.grades.slice().sort().forEach(function (g) {
        var rows = [];
        (s.chapters[g] || []).forEach(function (ch) {
          ch.units.forEach(function (u) { rows.push({ id: u.id, title: u.title, custom: false }); });
        });
        CUSTOM.forEach(function (c, idx) {
          if (c.subjectId === s.id && c.grade === Number(g)) rows.push({ id: c.id, title: c.title, custom: true, idx: idx });
        });
        if (!rows.length) return;
        html += '<h3>' + esc(s.name) + '・' + g + ' 年級</h3><ul class="review-list">';
        rows.forEach(function (r) {
          var isHidden = hidden.indexOf(r.id) !== -1;
          html += '<li><span>' + esc(r.title) + (isHidden ? ' <span class="badge">已隱藏</span>' : '') + '</span>' +
            '<span class="inline"><a class="btn btn-sm" href="#/admin/units/' + esc(r.id) + '">編輯</a>' +
            '<button class="btn btn-sm" data-action="uhide" data-id="' + esc(r.id) + '">' + (isHidden ? '顯示' : '隱藏') + '</button>' +
            (r.custom ? '<button class="btn btn-sm btn-danger" data-action="cdel" data-i="' + r.idx + '">刪除</button>' : '') +
            '</span></li>';
        });
        html += '</ul>';
      });
    });
    return html + '</section>';
  }

  function adminUnitEdit(id) {
    var raw = rawUnit(id);
    if (!raw) return '<section class="panel"><p>找不到這個單元。</p><p><a href="#/admin/units">返回單元列表</a></p></section>';
    var base = findUnit(id) || raw;
    var o = Object.assign({}, base, load(K_OVR, {})[id] || {});
    var bankText = (o.bank || []).map(function (b) {
      return b[0] + ' ## ' + b[1] + (b[2] ? ' ## ' + b[2] : '');
    }).join('\n');
    return '<section class="panel"><p><a href="#/admin/units">← 返回單元列表</a></p><h2>編輯：' + esc(raw.title) + '</h2>' +
      '<p class="muted">單元編號：' + esc(id) + '。題庫每行「題目 ## 答案」，想指定難度可再加「 ## 數字」（1 基礎、2 進階、3 困難、4 魔王）。</p>' +
      '<form data-form="uedit" data-id="' + esc(id) + '">' +
      '<label>單元名稱<input type="text" name="title" value="' + esc(o.title || '') + '" required></label>' +
      '<label>開場提示<input type="text" name="hook" value="' + esc(o.hook || '') + '"></label>' +
      '<label>重點（每行一點）<textarea name="points">' + esc((o.points || []).join('\n')) + '</textarea></label>' +
      '<label>你知道嗎？<input type="text" name="fun" value="' + esc(o.fun || '') + '"></label>' +
      '<label>題庫<textarea name="bank">' + esc(bankText) + '</textarea></label>' +
      '<button class="btn btn-primary" type="submit">儲存修改</button></form></section>';
  }

  function adminUsersCloud() {
    var list = CloudSync.users(), me = currentUser();
    var html = '<section class="panel"><h2>帳號列表（雲端）</h2><p class="muted">共 ' + list.length +
      ' 個帳號。可以停用、啟用、重設密碼或刪除帳號（你自己的帳號無法操作）。</p>' +
      '<div class="table-wrap"><table class="table"><tr><th>帳號</th><th>暱稱</th><th>身分</th><th>建立日期</th><th>狀態</th><th>操作</th></tr>';
    list.forEach(function (p, i) {
      var ops = p.username === me ? '<span class="muted">（目前登入）</span>' :
        '<div class="inline">' +
        '<button class="btn btn-sm" data-action="cuser-toggle" data-i="' + i + '">' + (p.disabled ? "啟用" : "停用") + '</button>' +
        '<input type="password" id="cnp-' + i + '" placeholder="新密碼" style="max-width:130px">' +
        '<button class="btn btn-sm" data-action="cuser-reset" data-i="' + i + '">重設密碼</button>' +
        '<button class="btn btn-sm btn-danger" data-action="cuser-del" data-i="' + i + '">刪除</button></div>';
      html += '<tr><td><strong>' + esc(p.username) + '</strong></td><td>' + esc(p.nickname || "—") + '</td><td>' +
        (p.role === "admin" ? '<span class="admin-badge">管理員</span>' : '一般') + '</td><td>' +
        (p.created_at ? fmtDate(Date.parse(p.created_at)) : "-") + '</td><td>' +
        (p.disabled ? '<span class="badge">已停用</span>' : '<span class="rstatus done">正常</span>') + '</td><td>' +
        ops + '</td></tr>';
    });
    return html + '</table></div></section>';
  }

  function adminUsers() {
    if (CloudSync.enabled()) return adminUsersCloud();
    var users = getUsers(), names = Object.keys(users).sort(), me = currentUser();
    var html = '<section class="panel"><h2>帳號列表（本瀏覽器）</h2><p class="muted">共 ' + names.length +
      ' 個帳號。管理員只能管理這台裝置上的帳號資料。</p><div class="table-wrap"><table class="table"><tr>' +
      '<th>帳號</th><th>身分</th><th>建立日期</th><th>完成單元</th><th>模擬考</th><th>狀態</th><th>操作</th></tr>';
    names.forEach(function (n, i) {
      var rec = users[n], d = getData(n), st = computeStats(d);
      var ops = n === me ? '<span class="muted">（目前登入）</span>' :
        '<div class="inline"><button class="btn btn-sm" data-action="auser-toggle" data-i="' + i + '">' + (rec.disabled ? "啟用" : "停用") + '</button>' +
        '<input type="password" id="np-' + i + '" placeholder="新密碼" style="max-width:130px">' +
        '<button class="btn btn-sm" data-action="auser-reset" data-i="' + i + '">重設密碼</button>' +
        '<button class="btn btn-sm btn-danger" data-action="auser-del" data-i="' + i + '">刪除</button></div>';
      html += '<tr><td><strong>' + esc(n) + '</strong></td><td>' + (rec.role === "admin" ? '<span class="admin-badge">管理員</span>' : '一般') +
        '</td><td>' + (rec.createdAt ? fmtDate(rec.createdAt) : "-") + '</td><td>' + st.completed + '</td><td>' + d.mocks.length +
        '</td><td>' + (rec.disabled ? '<span class="badge">已停用</span>' : '<span class="rstatus done">正常</span>') +
        '</td><td>' + ops + '</td></tr>';
    });
    return html + '</table></div></section>';
  }

  function adminContent() {
    var subjOpts = SUBJECTS.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join("");
    var html = '<section class="panel"><h2>新增單元</h2><p class="muted">新增的單元會出現在對應科目與年級。題庫每行一題，格式為「題目 ## 答案」，至少需要 3 題，讓複習能出題。</p>' +
      '<form data-form="unit">' +
      '<div class="field-row"><label>科目<select name="subjectId">' + subjOpts + '</select></label>' +
      '<label>年級<select name="grade"><option value="7">七年級</option><option value="8">八年級</option><option value="9">九年級</option></select></label>' +
      '<label>章節名稱<input type="text" name="chapterTitle" required></label></div>' +
      '<label>單元名稱<input type="text" name="title" required></label>' +
      '<label>開場提示（生活情境）<input type="text" name="hook"></label>' +
      '<label>重點（每行一點）<textarea name="points" required></textarea></label>' +
      '<label>你知道嗎？（冷知識）<input type="text" name="fun"></label>' +
      '<label>題庫（每行「題目 ## 答案」）<textarea name="bank" placeholder="2 + 3 = ? ## 5"></textarea></label>' +
      '<button class="btn btn-primary" type="submit">新增單元</button></form></section>';
    html += '<section class="panel"><h2>已新增的單元</h2>';
    if (!CUSTOM.length) html += '<p class="muted">還沒有新增任何單元。</p>';
    CUSTOM.forEach(function (c, i) {
      html += '<div class="inline" style="justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--line)">' +
        '<span>' + esc(c.title) + '　<span class="muted">' + esc(findSubject(c.subjectId).name) + ' ' + c.grade + ' 年級</span></span>' +
        '<button class="btn btn-sm btn-danger" data-action="cdel" data-i="' + i + '">刪除</button></div>';
    });
    return html + '</section>';
  }

  function adminVideos() {
    var html = '<section class="panel"><h2>新增影片</h2><p class="muted">貼上確認過的 YouTube 影片網址，會嵌入到該單元。單元編號可在單元頁網址中找到（例如 math-7-1）。</p>' +
      '<form data-form="video"><div class="field-row"><label>單元編號<input type="text" name="unitId" list="unit-ids" required></label>' +
      '<label>影片標題<input type="text" name="title" required></label></div>' +
      '<label>YouTube 網址<input type="text" name="url" placeholder="https://www.youtube.com/watch?v=..." required></label>' +
      '<button class="btn btn-primary" type="submit">加入影片</button></form>' +
      '<datalist id="unit-ids">' + ALL_UNITS.map(function (u) { return '<option value="' + esc(u.id) + '">' + esc(u.title) + '</option>'; }).join("") + '</datalist></section>';
    html += '<section class="panel"><h2>已加入的影片</h2>';
    var any = false;
    Object.keys(VIDEOS).forEach(function (uid) {
      (VIDEOS[uid] || []).forEach(function (v, i) {
        any = true;
        html += '<div class="inline" style="justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--line)">' +
          '<span><strong>' + esc(uid) + '</strong>　' + esc(v.title) + '</span>' +
          '<button class="btn btn-sm btn-danger" data-action="vdel" data-unit="' + esc(uid) + '" data-i="' + i + '">刪除</button></div>';
      });
    });
    if (!any) html += '<p class="muted">還沒有加入影片。</p>';
    return html + '</section>';
  }

  function adminAnnounce() {
    return '<section class="panel"><h2>公告</h2><p class="muted">會顯示在首頁頂部。留空並儲存即可取消公告。</p>' +
      '<form data-form="announce"><textarea name="text" placeholder="例如：本週六開放模擬考，歡迎參加！">' + esc(load(K_ANNOUNCE, "")) + '</textarea>' +
      '<div class="actions"><button class="btn btn-primary" type="submit">儲存公告</button></div></form></section>';
  }

  function adminSystem() {
    return '<section class="panel"><h2>系統</h2><div class="stat-mini">' +
      '<span>帳號數：' + Object.keys(getUsers()).length + '</span>' +
      '<span>自訂單元：' + CUSTOM.length + '</span>' +
      '<span>影片數：' + Object.keys(VIDEOS).reduce(function (n, k) { return n + (VIDEOS[k] || []).length; }, 0) + '</span></div>' +
      '<div class="actions"><button class="btn" data-action="export-all">下載全部本機資料（JSON）</button>' +
      '<button class="btn btn-danger" data-action="reset-content">清除自訂單元、影片與公告</button></div>' +
      '<p class="muted">清除只會移除管理員新增的內容，不會刪除帳號與學習紀錄。</p></section>';
  }

  /* ---------- 路由 ---------- */
  function render() {
    applyTheme();
    renderNav();
    var path = (location.hash || "#/").replace(/^#\/?/, "").split("/");
    var user = currentUser();
    if (path[0] === "grade") return viewSubject(Number(path[1]), path[2]);
    if (path[0] === "unit") return viewUnit(path[1]);
    if (path[0] === "review") return path[1] ? viewReview(path[1]) : viewReviewList();
    if (path[0] === "mock") return viewMock();
    if (path[0] === "wrong") return viewWrong();
    if (path[0] === "people") return window.Social ? window.Social.community() : notFound();
    if (path[0] === "u") return window.Social ? window.Social.profile(decodeURIComponent(path[1] || "")) : notFound();
    if (path[0] === "chat") return window.Social ? window.Social.chat() : notFound();
    if (path[0] === "lang") return viewLang(path[1] === "ja" ? "ja" : "en");
    if (path[0] === "search") return viewSearch(decodeURIComponent(path.slice(1).join("/")));
    if (path[0] === "login") return viewAuth("login");
    if (path[0] === "register") return viewAuth("register");
    if (path[0] === "admin") return viewAdmin(path[1], path[2]);
    if (path[0] === "dashboard") {
      if (!user) { toast("請先登入", true); location.hash = "#/login"; return; }
      return viewDashboard(user);
    }
    if (path[0] === "" || path[0] === undefined) return viewHome();
    return notFound();
  }

  /* ---------- 管理員動作 ---------- */
  async function adminResetPassword(i) {
    var names = Object.keys(getUsers()).sort(), n = names[i];
    var pw = document.getElementById("np-" + i).value;
    if (!n) return;
    if (pw.length < 6) { toast("新密碼至少 6 個字元", true); return; }
    var users = getUsers();
    users[n] = Object.assign(users[n], await makeCredential(pw));
    setUsers(users);
    toast("已重設「" + n + "」的密碼");
    render();
  }

  function adminDeleteUser(i) {
    var names = Object.keys(getUsers()).sort(), n = names[i];
    if (!n) return;
    if (!confirm("確定刪除帳號「" + n + "」？該帳號的所有學習紀錄會一併刪除，無法復原。")) return;
    var users = getUsers();
    delete users[n];
    setUsers(users);
    localStorage.removeItem(K_DATA + n);
    toast("已刪除帳號「" + n + "」");
    render();
  }

  /* ---------- 事件：按鈕 ---------- */
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var action = el.getAttribute("data-action");

    if (action === "logout") {
      CloudSync.signOut();
      window.__usersFresh = false;
      localStorage.removeItem(K_SESSION);
      practice = null; reviewState = null; mockState = null;
      toast("已登出");
      location.hash = "#/";
      render();
      return;
    }
    if (action === "theme") { toggleTheme(); return; }

    /* 無限練習 */
    if (action === "qlang") {
      qLang = el.getAttribute("data-lang");
      if (practice) practice = newPractice(practice.unit);
      render();
      return;
    }
    if (action === "level") {
      practiceLevel = Number(el.getAttribute("data-lv"));
      if (practice) practice = newPractice(practice.unit);
      render();
      return;
    }
    if (action === "amode") {
      answerMode = el.getAttribute("data-mode") === "choice" ? "choice" : "type";
      renderPractice();
      return;
    }
    if (action === "check") {
      var inp = document.getElementById("practice-input"), val = inp ? inp.value : "";
      if (!val.trim()) { toast("請先輸入答案", true); return; }
      gradeAnswer(val);
      return;
    }
    if (action === "pick") {
      if (!practice || !practice.opts) return;
      gradeAnswer(practice.opts[Number(el.getAttribute("data-idx"))]);
      return;
    }
    if (action === "next") {
      if (!practice) return;
      var item = pickNew(practice.unit, practice.q, practice.seen || {});
      practice.q = item.q; practice.a = item.a; practice.lv = item.lv; practice.status = ""; delete practice.opts; practice.badIdx = [];
      renderPractice();
      return;
    }
    if (action === "reveal") {
      if (!practice || practice.status === "correct") return;
      practice.status = "revealed";
      renderPractice();
      return;
    }
    if (action === "savenote") {
      var nUser = currentUser();
      if (!nUser) return;
      var nd = getData(nUser);
      nd.notes[el.getAttribute("data-unit")] = document.getElementById("note-box").value;
      setData(nUser, nd);
      toast("筆記已儲存");
      return;
    }

    /* 複習確認 */
    if (action === "rcheck") {
      if (!reviewState || reviewState.done) return;
      var idx = Number(el.getAttribute("data-idx")), it = reviewState.items[idx];
      var rin = document.getElementById("rin-" + idx), v = rin ? rin.value : "";
      if (!v.trim()) { toast("請先輸入答案", true); return; }
      if (QUIZ.check(v, it.a)) {
        it.ok = true;
        var ru = currentUser();
        if (ru) { var rd = getData(ru); addToday(rd); setData(ru, rd); }
        if (reviewState.items.every(function (x) { return x.ok; })) {
          reviewState.done = true;
          reviewState.saved = recordReview(reviewState.unit.id);
          toast(reviewState.saved ? "已確認複習！" : "請登入以儲存複習紀錄");
        }
        renderReview();
      } else {
        var u2 = currentUser();
        if (u2) { var d3 = getData(u2); addWrong(d3, reviewState.unit, it.q, it.a); setData(u2, d3); }
        toast("答案不對，已收進錯題本", true);
      }
      return;
    }
    if (action === "rrestart") { reviewState = null; render(); return; }

    /* 錯題本 */
    if (action === "wcheck") {
      var wu = currentUser();
      if (!wu) return;
      var wi = Number(el.getAttribute("data-idx")), wd = getData(wu), w = wd.wrong[wi];
      if (!w) return;
      var wv = document.getElementById("win-" + wi), wval = wv ? wv.value : "";
      if (!wval.trim()) { toast("請先輸入答案", true); return; }
      if (QUIZ.check(wval, w.a)) {
        wd.wrong.splice(wi, 1);
        setData(wu, wd);
        toast("答對了，已移出錯題本 ✅");
        render();
      } else {
        toast("還不對，再試一次", true);
      }
      return;
    }
    if (action === "wreveal") {
      var ans = document.getElementById("wans-" + el.getAttribute("data-idx"));
      if (ans) ans.style.display = "block";
      return;
    }

    /* 模擬考 */
    if (action === "mset") {
      var key = el.getAttribute("data-key"), val = el.getAttribute("data-val");
      mockCfg[key] = (key === "count" || key === "level") ? Number(val) : val;
      render();
      return;
    }
    if (action === "mstart") { startMock(); return; }
    if (action === "msubmit") { submitMock(); return; }
    if (action === "mcancel") { mockState = null; render(); return; }
    if (action === "mreset") { mockState = { phase: "setup" }; render(); return; }

    /* 管理員 */
    if (action === "cuser-reset" || action === "cuser-del") {
      var tp = CloudSync.users()[Number(el.getAttribute("data-i"))];
      if (!tp || tp.username === currentUser()) return;
      if (action === "cuser-reset") {
        var npw = document.getElementById("cnp-" + el.getAttribute("data-i"));
        var pw = npw ? npw.value : "";
        if (pw.length < 6) { toast("新密碼至少 6 個字元", true); return; }
        CloudSync.adminUser("reset", tp.id, pw).then(function (r) {
          if (r.error) { toast(r.error, true); return; }
          toast("已重設「" + tp.username + "」的密碼");
          if (npw) npw.value = "";
        });
        return;
      }
      if (!confirm("確定刪除帳號「" + tp.username + "」？學習紀錄會一併刪除，無法復原。")) return;
      CloudSync.adminUser("delete", tp.id).then(function (r) {
        if (r.error) { toast(r.error, true); return; }
        toast("已刪除帳號「" + tp.username + "」");
        window.__usersFresh = false;
        CloudSync.refreshUsers().then(render);
      });
      return;
    }
    if (action === "cuser-toggle") {
      var cp = CloudSync.users()[Number(el.getAttribute("data-i"))];
      if (!cp || cp.username === currentUser()) return;
      CloudSync.setDisabled(cp.id, !cp.disabled).then(function () {
        window.__usersFresh = false;
        CloudSync.refreshUsers().then(function () { toast("已更新帳號狀態"); render(); });
      });
      return;
    }
    if (action === "auser-toggle") {
      var tn = Object.keys(getUsers()).sort()[Number(el.getAttribute("data-i"))];
      var tu = getUsers();
      if (!tn || tn === currentUser()) return;
      tu[tn].disabled = !tu[tn].disabled;
      setUsers(tu);
      toast((tu[tn].disabled ? "已停用 " : "已啟用 ") + tn);
      render();
      return;
    }
    if (action === "auser-reset") { adminResetPassword(Number(el.getAttribute("data-i"))); return; }
    if (action === "auser-del") { adminDeleteUser(Number(el.getAttribute("data-i"))); return; }
    if (action === "uhide") {
      var hid = load(K_HIDDEN, []), uh = el.getAttribute("data-id"), hi = hid.indexOf(uh);
      if (hi === -1) hid.push(uh); else hid.splice(hi, 1);
      save(K_HIDDEN, hid);
      buildUnits();
      toast(hi === -1 ? "已隱藏單元" : "已顯示單元");
      render();
      return;
    }
    if (action === "cdel") {
      var ci = Number(el.getAttribute("data-i"));
      if (!confirm("確定刪除這個自訂單元？")) return;
      CUSTOM.splice(ci, 1);
      save(K_CUSTOM, CUSTOM);
      buildUnits();
      toast("已刪除單元");
      render();
      return;
    }
    if (action === "vdel") {
      var vu = el.getAttribute("data-unit"), vi = Number(el.getAttribute("data-i"));
      if (VIDEOS[vu]) { VIDEOS[vu].splice(vi, 1); if (!VIDEOS[vu].length) delete VIDEOS[vu]; }
      save(K_VIDEOS, VIDEOS);
      toast("已刪除影片");
      render();
      return;
    }
    if (action === "reset-content") {
      if (!confirm("確定清除所有管理員新增的單元、影片與公告？")) return;
      CUSTOM = []; VIDEOS = {};
      save(K_CUSTOM, CUSTOM); save(K_VIDEOS, VIDEOS); save(K_ANNOUNCE, "");
      buildUnits();
      toast("已清除自訂內容");
      render();
      return;
    }
    if (action === "export-all") {
      var all = {};
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf("crs_") === 0) all[k] = load(k, null); });
      download("review-all-backup.json", all);
      return;
    }
    if (action === "export-user") {
      var eu = currentUser();
      if (eu) download("review-" + eu + "-backup.json", getData(eu));
      return;
    }
  });

  /* 模擬考設定 */
  document.addEventListener("change", function (e) {
    var el = e.target;
    if (el.id === "import-file") {
      var f = el.files && el.files[0];
      var iu = currentUser();
      if (!f || !iu) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var obj = JSON.parse(reader.result);
          if (!obj || typeof obj !== "object" || !obj.units) { toast("檔案格式不正確", true); return; }
          setData(iu, obj);
          toast("已匯入學習資料");
          render();
        } catch (err) { toast("匯入失敗，檔案無法讀取", true); }
      };
      reader.readAsText(f);
      return;
    }
    if (!el.getAttribute || !el.getAttribute("data-cfg")) return;
    var key = el.getAttribute("data-cfg");
    mockCfg[key] = (key === "count" || key === "level") ? Number(el.value) : el.value;
  });

  /* Enter 送出答案 */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || !e.target || e.target.tagName !== "INPUT") return;
    var row = e.target.parentElement;
    var btn = row && row.querySelector("[data-action='check'], [data-action='rcheck'], [data-action='wcheck']");
    if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
  });

  /* ---------- 事件：表單 ---------- */
  document.addEventListener("submit", async function (e) {
    var form = e.target.closest("[data-form]");
    if (!form) return;
    e.preventDefault();
    var mode = form.getAttribute("data-form");
    if (mode.indexOf("social-") === 0) return; // 社群表單由 social.js 處理
    var msg = document.getElementById("auth-msg");
    try {
      if (mode === "search") {
        var q = form.q.value.trim();
        if (q) location.hash = "#/search/" + encodeURIComponent(q);
        return;
      }
      if (mode === "goal") {
        var gu = currentUser();
        if (!gu) return;
        var gd = getData(gu);
        gd.goal = Math.max(1, Math.min(100, Number(form.goal.value) || 5));
        setData(gu, gd);
        toast("已設定每日目標");
        render();
        return;
      }
      if (mode === "unit") {
        if (!isAdmin()) return;
        var points = form.points.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
        var bank = form.bank.value.split("\n").map(function (line) {
          var p = line.split("##");
          return p.length >= 2 && p[0].trim() && p[1].trim() ? [p[0].trim(), p[1].trim()] : null;
        }).filter(Boolean);
        if (!points.length) { toast("請至少填寫一個重點", true); return; }
        if (bank.length < 3) { toast("題庫至少需要 3 題（每行「題目 ## 答案」）", true); return; }
        var cid = "c" + Date.now().toString(36);
        CUSTOM.push({
          id: cid, title: form.elements.title.value.trim(), subjectId: form.subjectId.value,
          grade: Number(form.grade.value), chapterTitle: form.chapterTitle.value.trim(),
          hook: form.hook.value.trim(), fun: form.fun.value.trim(), points: points, bank: bank, gen: []
        });
        save(K_CUSTOM, CUSTOM);
        buildUnits();
        toast("已新增單元");
        location.hash = "#/admin/content";
        render();
        return;
      }
      if (mode === "uedit") {
        if (!isAdmin()) return;
        var eid = form.getAttribute("data-id");
        var epoints = form.elements.points.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
        var ebank = parseBank(form.elements.bank.value);
        if (!epoints.length) { toast("請至少填寫一個重點", true); return; }
        if (ebank.length < 3) { toast("題庫至少需要 3 題", true); return; }
        var ovr = load(K_OVR, {});
        ovr[eid] = {
          title: form.elements.title.value.trim(), hook: form.elements.hook.value.trim(),
          fun: form.elements.fun.value.trim(), points: epoints, bank: ebank
        };
        save(K_OVR, ovr);
        buildUnits();
        toast("已儲存單元修改");
        location.hash = "#/admin/units";
        return;
      }
      if (mode === "video") {
        if (!isAdmin()) return;
        var uid = form.unitId.value.trim(), url = form.url.value.trim();
        if (!findUnit(uid)) { toast("找不到這個單元編號", true); return; }
        if (!ytId(url)) { toast("網址不是有效的 YouTube 影片連結", true); return; }
        VIDEOS[uid] = VIDEOS[uid] || [];
        VIDEOS[uid].push({ title: form.elements.title.value.trim(), url: url });
        save(K_VIDEOS, VIDEOS);
        toast("已加入影片");
        render();
        return;
      }
      if (mode === "announce") {
        if (!isAdmin()) return;
        save(K_ANNOUNCE, form.text.value.trim());
        toast("公告已更新");
        render();
        return;
      }

      var username = form.username.value.trim();
      var password = form.password.value;
      if (msg) msg.textContent = "";
      if (!username || !password) { if (msg) msg.textContent = "帳號與密碼不可為空"; return; }
      if (CloudSync.enabled()) {
        if (mode === "register") {
          if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) { msg.textContent = "帳號需為 3–20 個英數字或底線"; return; }
          if (password.length < 6) { msg.textContent = "密碼至少需要 6 個字元"; return; }
          var cnick = (form.nickname ? form.nickname.value : "").trim();
          var rr = await CloudSync.signUp(username, password, cnick);
          if (rr.error) { msg.textContent = rr.error; return; }
          toast("註冊成功，請登入");
          location.hash = "#/login";
          return;
        }
        var lr = await CloudSync.signIn(username, password);
        if (lr.error) { msg.textContent = lr.error; return; }
        practice = null; reviewState = null; mockState = null;
        toast("歡迎回來，" + username);
        location.hash = lr.role === "admin" ? "#/admin" : "#/dashboard";
        return;
      }
      var users = getUsers();

      if (mode === "register") {
        if (password.length < 6) { msg.textContent = "密碼至少需要 6 個字元"; return; }
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) { msg.textContent = "帳號需為 3–20 個英數字或底線"; return; }
        var lowerTaken = Object.keys(users).some(function (k) { return k.toLowerCase() === username.toLowerCase(); });
        if (lowerTaken) { msg.textContent = "此帳號已被使用"; return; }
        var nick = (form.nickname ? form.nickname.value : "").trim();
        users[username] = Object.assign({ role: "user", createdAt: Date.now(), disabled: false, nickname: nick }, await makeCredential(password));
        setUsers(users);
        toast("註冊成功，請登入");
        location.hash = "#/login";
        return;
      }
      /* 登入 */
      var record = users[username];
      if (!record) { msg.textContent = "帳號或密碼錯誤"; return; }
      if (record.disabled) { msg.textContent = "此帳號已被停用，請聯絡管理員"; return; }
      var h = await hashPassword(password, record.salt);
      if (h !== record.hash) { msg.textContent = "帳號或密碼錯誤"; return; }
      save(K_SESSION, username);
      practice = null; reviewState = null; mockState = null;
      toast("歡迎回來，" + username);
      location.hash = record.role === "admin" ? "#/admin" : "#/dashboard";
    } catch (err) {
      if (msg) msg.textContent = err.message || "發生錯誤，請稍後再試";
      else toast(err.message || "發生錯誤", true);
    }
  });

  // 公開學習摘要：寫入雲端 public_stats，供社群頁顯示
  window.computePublicStats = function (data) {
    var st = computeStats(data);
    return {
      completed: st.completed, total: ALL_UNITS.length, correct: st.correct, reviews: st.reviews,
      streak: currentStreak(data), mocks: data.mocks.length, bestMock: data.bestMock,
      achievements: data.earned.length,
      subjects: SUBJECTS.map(function (s) {
        return { id: s.id, name: s.name, done: st.bySubject[s.id], total: st.totalBySubject[s.id] };
      })
    };
  };
  window.AppKit = {
    esc: esc, toast: toast, render: render, ICON: ICON, COLOR: COLOR, fmtDate: fmtDate, isAdmin: isAdmin
  };

  window.addEventListener("hashchange", render);
  render();
  CloudSync.boot().then(function () {
    reloadContent();
    render();
  });
})();
