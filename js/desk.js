/*
 * 工作桌面：像電腦系統一樣，多個視窗可以同時開啟、拖拉、縮放、最大化、最小化。
 * 每個視窗內是一個站內頁面（以 iframe 嵌入，並加上 embed=1 隱藏外層導覽）。
 */
(function () {
  "use strict";

  // 嵌入模式：在視窗內載入時，隱藏外層的導覽與背景
  if (/(^|[?&])embed=1/.test(location.search)) document.documentElement.classList.add("embed");

  var APPS = [
    ["#/review", "📝", "複習中心"], ["#/map", "🌌", "知識星圖"], ["#/mock", "🎯", "模擬考"],
    ["#/wrong", "📕", "錯題本"], ["#/lang/en", "🔤", "英文題庫"], ["#/lang/ja", "🇯🇵", "日文題庫"],
    ["#/dashboard", "📊", "我的學習"], ["#/people", "🏆", "排行榜"], ["#/friends", "👫", "好友"],
    ["#/inbox", "💌", "私訊"], ["#/chat", "💬", "聊天室"], ["#/focus", "⏱️", "專注計時"]
  ];

  var wins = [], zTop = 20, seq = 0, drag = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function area() { return document.getElementById("desk-area"); }
  function taskbar() { return document.getElementById("taskbar"); }

  function render() {
    var app = document.getElementById("app");
    app.innerHTML = '<section class="desk">' +
      '<div class="desk-icons">' + APPS.map(function (a, i) {
        return '<button class="desk-icon" data-open="' + i + '"><span class="di-ico">' + a[1] + '</span><span class="di-txt">' + esc(a[2]) + '</span></button>';
      }).join("") + '</div>' +
      '<div id="desk-area" class="desk-area"><div class="desk-hint">點左側圖示開啟視窗，可以拖拉標題列移動、拉右下角縮放。</div></div>' +
      '<div id="taskbar" class="taskbar"></div></section>';
    wins.forEach(function (w) { mount(w); });
    renderTaskbar();
  }

  function mount(w) {
    var el = document.createElement("div");
    el.className = "win" + (w.min ? " min" : "") + (w.max ? " max" : "");
    el.id = w.id;
    el.style.left = w.x + "px"; el.style.top = w.y + "px";
    el.style.width = w.w + "px"; el.style.height = w.h + "px";
    el.style.zIndex = w.z;
    el.innerHTML = '<div class="win-bar"><span class="win-dot"></span><strong class="win-title">' + esc(w.title) + '</strong>' +
      '<div class="win-ctrl">' +
      '<button data-w="min" title="最小化">–</button><button data-w="max" title="最大化">▢</button><button data-w="close" title="關閉">✕</button>' +
      '</div></div>' +
      '<iframe src="index.html?embed=1' + w.hash + '" title="' + esc(w.title) + '" loading="lazy"></iframe>' +
      '<div class="win-grip" data-w="grip"></div>';
    area().appendChild(el);
  }

  function openWindow(title, hash) {
    if (!area()) return;
    var n = wins.length;
    var w = { id: "win" + (++seq), title: title, hash: hash, x: 60 + (n % 6) * 30, y: 30 + (n % 6) * 26,
      w: Math.min(760, area().clientWidth - 90), h: Math.min(480, area().clientHeight - 60), z: ++zTop, min: false, max: false };
    wins.push(w);
    mount(w);
    renderTaskbar();
    focus(w);
  }

  function find(id) { return wins.filter(function (w) { return w.id === id; })[0]; }
  function el(w) { return document.getElementById(w.id); }

  function focus(w) {
    w.z = ++zTop;
    var node = el(w);
    if (node) {
      node.style.zIndex = w.z;
      document.querySelectorAll(".win").forEach(function (n) { n.classList.toggle("active", n === node); });
    }
    renderTaskbar();
  }

  function closeWin(w) {
    wins = wins.filter(function (x) { return x !== w; });
    var node = el(w);
    if (node) node.remove();
    renderTaskbar();
  }

  function minimize(w) {
    w.min = true;
    var node = el(w); if (node) node.classList.add("min");
    renderTaskbar();
  }

  function restore(w) {
    w.min = false;
    var node = el(w); if (node) node.classList.remove("min");
    focus(w);
  }

  function toggleMax(w) {
    w.max = !w.max;
    var node = el(w); if (node) node.classList.toggle("max", w.max);
  }

  function renderTaskbar() {
    var tb = taskbar();
    if (!tb) return;
    tb.innerHTML = wins.map(function (w) {
      return '<button class="tb-item' + (w.min ? '' : ' on') + '" data-tb="' + w.id + '">' + esc(w.title) + '</button>';
    }).join("") || '<span class="tb-empty">工作列（開啟視窗後會顯示在這裡）</span>';
  }

  function startDrag(w, e) {
    var node = el(w), r = node.getBoundingClientRect();
    drag = { w: w, mode: "move", ox: e.clientX - r.left, oy: e.clientY - r.top };
    area().classList.add("is-busy");
  }
  function startResize(w, e) {
    drag = { w: w, mode: "resize", sx: e.clientX, sy: e.clientY, sw: w.w, sh: w.h };
    area().classList.add("is-busy");
  }

  document.addEventListener("pointerdown", function (e) {
    var node = e.target.closest && e.target.closest(".win");
    if (node) {
      var w = find(node.id);
      if (!w) return;
      focus(w);
      var ctl = e.target.closest("[data-w]");
      var act = ctl ? ctl.getAttribute("data-w") : (e.target.closest(".win-bar") ? "drag" : null);
      if (act === "close") closeWin(w);
      else if (act === "min") minimize(w);
      else if (act === "max") toggleMax(w);
      else if (act === "drag" && !w.max) startDrag(w, e);
      else if (act === "grip" && !w.max) startResize(w, e);
      return;
    }
    var tb = e.target.closest && e.target.closest("[data-tb]");
    if (tb) {
      var tw = find(tb.getAttribute("data-tb"));
      if (!tw) return;
      if (tw.min) restore(tw); else minimize(tw);
    }
  });

  document.addEventListener("pointermove", function (e) {
    if (!drag || !area()) return;
    var a = area().getBoundingClientRect(), w = drag.w, node = el(w);
    if (!node) return;
    if (drag.mode === "move") {
      w.x = Math.max(0, Math.min(e.clientX - a.left - drag.ox, a.width - 120));
      w.y = Math.max(0, Math.min(e.clientY - a.top - drag.oy, a.height - 40));
      node.style.left = w.x + "px"; node.style.top = w.y + "px";
    } else {
      w.w = Math.max(360, drag.sw + (e.clientX - drag.sx));
      w.h = Math.max(240, drag.sh + (e.clientY - drag.sy));
      node.style.width = w.w + "px"; node.style.height = w.h + "px";
    }
  });

  document.addEventListener("pointerup", function () {
    if (!drag) return;
    drag = null;
    if (area()) area().classList.remove("is-busy");
  });

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-open]");
    if (!b) return;
    var a = APPS[Number(b.getAttribute("data-open"))];
    if (a) openWindow(a[2], a[0]);
  });

  window.addEventListener("resize", function () {
    wins.forEach(function (w) {
      if (w.max) return;
      var node = el(w); if (!node || !area()) return;
      w.x = Math.min(w.x, Math.max(0, area().clientWidth - 120));
      node.style.left = w.x + "px";
    });
  });

  window.Desk = { render: render, open: openWindow };
})();
