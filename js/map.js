/*
 * 知識星圖：把每個科目的單元畫成星座圖。
 * - 依年級、上下學期分區排列
 * - 星星依複習狀態發光：未複習（暗）、已確認（綠色）、該再複習（金色脈動）
 * - 點擊星星進入該單元
 * 依賴 app.js 提供的 window.AppKit（在呼叫時才讀取）。
 */
(function () {
  "use strict";

  var lastSubject = "math";
  var COLS = 5, GAP_X = 170, GAP_Y = 150, PAD_X = 100, BAND_H = 52;
  var STATUS_TEXT = { todo: "未複習", done: "已確認", due: "該再複習" };

  function kit() { return window.AppKit; }
  function esc(s) { return kit().esc(s); }

  function semOrder(u) { return u.semester === 1 ? 1 : u.semester === 2 ? 2 : 3; }
  function numOf(u) { var m = String(u.id).match(/-(\d+)$/); return m ? Number(m[1]) : 0; }
  function shortTitle(t) { return t.length > 7 ? t.slice(0, 7) + "…" : t; }
  function statusOf(u, data) { return kit().reviewStatus(data.units[u.id]).key; }

  // 排版：依年級與學期分段，段內每列 COLS 顆星
  function layout(units) {
    var y = 70, nodes = [], bands = [], byGrade = {};
    units.forEach(function (u) { (byGrade[u.grade] = byGrade[u.grade] || []).push(u); });
    Object.keys(byGrade).sort().forEach(function (g) {
      [1, 2, 3].forEach(function (sem) {
        var part = byGrade[g].filter(function (u) { return semOrder(u) === sem; });
        if (!part.length) return;
        var name = sem === 1 ? "上學期" : sem === 2 ? "下學期" : "待分類";
        bands.push({ y: y, text: g + " 年級・" + name });
        y += BAND_H;
        part.forEach(function (u, i) {
          nodes.push({ u: u, x: PAD_X + (i % COLS) * GAP_X, y: y + Math.floor(i / COLS) * GAP_Y });
        });
        y += Math.ceil(part.length / COLS) * GAP_Y + 24;
      });
    });
    return { nodes: nodes, bands: bands, height: y + 30, width: PAD_X * 2 + (COLS - 1) * GAP_X };
  }

  function svgFor(units, data) {
    var L = layout(units);
    var s = '<svg viewBox="0 0 ' + L.width + ' ' + L.height + '" class="star-svg" role="img" aria-label="知識星圖">' +
      '<defs><filter id="starGlow" x="-60%" y="-60%" width="220%" height="220%">' +
      '<feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    L.bands.forEach(function (b) {
      s += '<text x="20" y="' + (b.y + 26) + '" class="band">' + esc(b.text) + '</text>';
    });
    // 同一章節的相鄰單元用連線相連，像星座的線條
    for (var i = 0; i < L.nodes.length - 1; i++) {
      var a = L.nodes[i], b2 = L.nodes[i + 1];
      if (a.u.chapterTitle === b2.u.chapterTitle && a.u.grade === b2.u.grade && semOrder(a.u) === semOrder(b2.u)) {
        s += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b2.x + '" y2="' + b2.y + '" class="edge"/>';
      }
    }
    L.nodes.forEach(function (n) {
      var st = statusOf(n.u, data);
      s += '<a href="#/unit/' + esc(n.u.id) + '" class="node st-' + st + '">' +
        '<g transform="translate(' + n.x + ',' + n.y + ')">' +
        '<title>' + esc(n.u.title) + '（' + STATUS_TEXT[st] + '）</title>' +
        '<circle r="38" class="halo"/><circle r="27" class="core"/>' +
        '<text y="6" class="idx">' + numOf(n.u) + '</text>' +
        '<text y="60" class="lbl">' + esc(shortTitle(n.u.title)) + '</text></g></a>';
    });
    return s + '</svg>';
  }

  function render(key) {
    var k = kit();
    if (key) lastSubject = key;
    var subj = k.SUBJECTS.filter(function (x) { return x.id === lastSubject; })[0] || k.SUBJECTS[0];
    lastSubject = subj.id;
    var user = k.currentUser();
    var data = user ? k.getData(user) : { units: {} };
    var units = k.getUnits().filter(function (u) { return u.subjectId === subj.id; }).sort(function (a, b) {
      return a.grade - b.grade || semOrder(a) - semOrder(b) || numOf(a) - numOf(b);
    });
    var total = units.length;
    var doneN = units.filter(function (u) { return statusOf(u, data) === "done"; }).length;
    var dueN = units.filter(function (u) { return statusOf(u, data) === "due"; }).length;
    var pct = total ? Math.round((doneN + dueN) / total * 100) : 0;

    var chips = k.SUBJECTS.map(function (x) {
      return '<button class="chip' + (x.id === subj.id ? ' active' : '') + '" data-action="map-subject" data-key="' + x.id + '">' +
        (k.ICON[x.id] || "") + ' ' + esc(x.name) + '</button>';
    }).join("");

    var html = '<header class="page-head map-head"><span class="eyebrow">Knowledge Map</span>' +
      '<h1>知識星圖</h1><p class="muted">每一顆星是一個單元。點亮它，代表你已經複習過。</p></header>' +
      '<section class="map-stats">' +
      '<div class="ring big" style="background:conic-gradient(var(--brand1) ' + (pct * 3.6) + 'deg, var(--line) 0)" data-label="' + pct + '%"></div>' +
      '<div class="map-counts">' +
      '<div><span class="num">' + doneN + '</span><span class="lbl">已確認</span></div>' +
      '<div><span class="num">' + dueN + '</span><span class="lbl">該再複習</span></div>' +
      '<div><span class="num">' + total + '</span><span class="lbl">本科單元</span></div></div></section>' +
      '<div class="chips map-chips">' + chips + '</div>' +
      '<div class="map-legend"><span><i class="lg todo"></i>未複習</span><span><i class="lg done"></i>已確認</span>' +
      '<span><i class="lg due"></i>該再複習</span></div>';

    if (!total) html += '<section class="panel"><p class="muted">這個科目目前還沒有單元。</p></section>';
    else html += '<section class="map-wrap">' + svgFor(units, data) + '</section>';

    k.setHTML(html);
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest('[data-action="map-subject"]');
    if (el) render(el.getAttribute("data-key"));
  });

  window.MapPage = { render: render };
})();
