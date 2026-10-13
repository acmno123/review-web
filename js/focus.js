/*
 * 專注計時器（番茄鐘）：專注與休息交替，記錄今天完成了幾次專注。
 * 資料只存在這台裝置（localStorage），不會上傳。
 */
(function () {
  "use strict";

  var KEY = "crs_focus";
  var PRESETS = [
    { id: "25", label: "25 分鐘專注", focus: 25, rest: 5 },
    { id: "50", label: "50 分鐘專注", focus: 50, rest: 10 },
    { id: "15", label: "15 分鐘短專注", focus: 15, rest: 3 }
  ];

  var st = { preset: "25", mode: "focus", left: 25 * 60, running: false, timer: null };

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { day: "", count: 0 }; }
    catch (e) { return { day: "", count: 0 }; }
  }
  function write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* 無法儲存時忽略 */ } }
  function today() { return new Date().toDateString(); }
  function todayCount() { var r = read(); return r.day === today() ? r.count : 0; }
  function addDone() {
    var r = read();
    var count = (r.day === today() ? r.count : 0) + 1;
    write({ day: today(), count: count });
  }

  function preset() { return PRESETS.filter(function (p) { return p.id === st.preset; })[0]; }
  function fmt(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }
  function total() {
    var p = preset();
    return (st.mode === "focus" ? p.focus : p.rest) * 60;
  }

  function notify(msg) {
    if (window.Notification && Notification.permission === "granted") {
      try { new Notification("專注計時器", { body: msg }); } catch (e) { /* 忽略 */ }
    }
    if (window.AppKit) window.AppKit.toast(msg);
  }

  function tick() {
    st.left -= 1;
    if (st.left <= 0) {
      if (st.mode === "focus") {
        addDone();
        st.mode = "rest";
        notify("專注完成！休息一下吧 ☕");
      } else {
        st.mode = "focus";
        notify("休息結束，開始下一輪專注 🎯");
      }
      st.left = total();
    }
    draw();
  }

  function start() {
    if (st.running) return;
    st.running = true;
    st.timer = setInterval(tick, 1000);
    draw();
  }
  function pause() {
    st.running = false;
    clearInterval(st.timer);
    draw();
  }
  function reset() {
    pause();
    st.mode = "focus";
    st.left = total();
    draw();
  }
  function setPreset(id) {
    st.preset = id;
    pause();
    st.mode = "focus";
    st.left = total();
    draw();
  }

  function draw() {
    var box = document.getElementById("focus-box");
    if (!box) return;
    var p = preset(), t = total(), pct = Math.round((1 - st.left / t) * 100);
    box.querySelector(".fc-time").textContent = fmt(st.left);
    box.querySelector(".fc-mode").textContent = st.mode === "focus" ? "專注中" : "休息中";
    box.querySelector(".fc-ring").style.background =
      "conic-gradient(" + (st.mode === "focus" ? "#8b9bff" : "#34d399") + " " + (pct * 3.6) + "deg, var(--line) 0)";
    box.querySelector(".fc-count").textContent = todayCount();
    box.querySelector(".fc-toggle").textContent = st.running ? "⏸ 暫停" : "▶ 開始";
    Array.prototype.forEach.call(box.querySelectorAll("[data-preset]"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-preset") === st.preset);
    });
    if (p) box.querySelector(".fc-desc").textContent = "每 " + p.focus + " 分鐘專注後休息 " + p.rest + " 分鐘";
  }

  function render() {
    var app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = '<header class="page-head"><span class="eyebrow">Focus timer</span><h1>專注計時</h1>' +
      '<p class="muted">用番茄鐘把時間切成一段段專注，每完成一次就累積一次。</p></header>' +
      '<section class="focus-box" id="focus-box">' +
      '<div class="fc-ring"><div class="fc-inner"><span class="fc-mode"></span><span class="fc-time"></span></div></div>' +
      '<p class="fc-desc muted"></p>' +
      '<div class="seg">' + PRESETS.map(function (p) {
        return '<button class="seg-btn" data-preset="' + p.id + '">' + p.label + '</button>';
      }).join("") + '</div>' +
      '<div class="actions fc-actions"><button class="btn btn-primary btn-lg fc-toggle">▶ 開始</button>' +
      '<button class="btn fc-reset">↺ 重設</button></div>' +
      '<p class="fc-stat">今天已完成 <strong class="fc-count">0</strong> 次專注</p>' +
      '</section>';
    draw();
  }

  document.addEventListener("click", function (e) {
    var box = document.getElementById("focus-box");
    if (!box) return;
    var t = e.target.closest && e.target.closest(".fc-toggle");
    if (t) { st.running ? pause() : start(); return; }
    var r = e.target.closest && e.target.closest(".fc-reset");
    if (r) { reset(); return; }
    var p = e.target.closest && e.target.closest("[data-preset]");
    if (p) setPreset(p.getAttribute("data-preset"));
  });

  window.addEventListener("hashchange", function () {
    if ((location.hash || "").indexOf("#/focus") !== 0) pause();
  });

  window.FocusPage = { render: render };
})();
