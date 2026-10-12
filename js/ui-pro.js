/*
 * 進階視覺效果：只負責外觀，不影響功能。
 * - 粒子星空背景（Canvas，會隨滑鼠牽引）
 * - 游標光暈（跟隨滑鼠的柔光）
 * - 卡片 3D 傾斜與聚光（滑鼠經過時的光點）
 * - 按鈕水波紋
 * - 頁面切換動畫
 * - 捲動淡入（進入畫面時浮現）
 * 若使用者開啟「減少動態效果」，動態部分會自動關閉。
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var canFine = !!(window.matchMedia && window.matchMedia("(pointer: fine)").matches);
  root.classList.add("js-ui");

  /* ---------- 粒子星空背景 ---------- */
  function particles() {
    if (reduce) return;
    var c = document.createElement("canvas");
    c.id = "bgfx";
    c.setAttribute("aria-hidden", "true");
    document.body.insertBefore(c, document.body.firstChild);
    var ctx = c.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, pts = [], mouse = { x: -9999, y: -9999 };

    function size() {
      W = c.width = Math.round(window.innerWidth * dpr);
      H = c.height = Math.round(window.innerHeight * dpr);
      c.style.width = window.innerWidth + "px";
      c.style.height = window.innerHeight + "px";
    }
    function make() {
      var count = Math.min(120, Math.round(window.innerWidth * window.innerHeight / 14000));
      pts = [];
      for (var i = 0; i < count; i++) {
        pts.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.3 * dpr, vy: (Math.random() - 0.5) * 0.3 * dpr,
          r: (Math.random() * 1.5 + 0.6) * dpr,
          h: [250, 290, 190, 330][Math.floor(Math.random() * 4)]
        });
      }
    }
    function frame() {
      if (document.hidden) { requestAnimationFrame(frame); return; }
      ctx.clearRect(0, 0, W, H);
      var linkD = 130 * dpr, mouseD = 170 * dpr;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        var dx = p.x - mouse.x, dy = p.y - mouse.y, md = Math.sqrt(dx * dx + dy * dy);
        if (md < mouseD && md > 0) { // 滑鼠附近的粒子輕微被吸引
          p.vx -= dx / md * 0.012 * dpr; p.vy -= dy / md * 0.012 * dpr;
        }
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.999; p.vy *= 0.999;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.fillStyle = "hsla(" + p.h + ",95%,72%,.85)";
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j], ex = p.x - q.x, ey = p.y - q.y, d = Math.sqrt(ex * ex + ey * ey);
          if (d < linkD) {
            ctx.strokeStyle = "hsla(" + p.h + ",90%,70%," + ((1 - d / linkD) * 0.28).toFixed(3) + ")";
            ctx.lineWidth = dpr;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
      }
      requestAnimationFrame(frame);
    }
    window.addEventListener("pointermove", function (e) { mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr; }, { passive: true });
    window.addEventListener("resize", function () { size(); make(); });
    size(); make(); frame();
  }

  /* ---------- 游標光暈 ---------- */
  function cursorGlow() {
    if (reduce || !canFine) return;
    var g = document.createElement("div");
    g.id = "cursor-glow";
    g.setAttribute("aria-hidden", "true");
    document.body.appendChild(g);
    var tx = 0, ty = 0, x = 0, y = 0, running = false;
    function loop() {
      x += (tx - x) * 0.18; y += (ty - y) * 0.18;
      g.style.transform = "translate3d(" + (x - 200) + "px," + (y - 200) + "px,0)";
      if (Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5) requestAnimationFrame(loop); else running = false;
    }
    window.addEventListener("pointermove", function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });
  }

  /* ---------- 卡片 3D 傾斜與聚光（滑鼠裝置） ---------- */
  var TILT_SEL = ".tile, .person-card";
  var SPOT_SEL = ".tile, .panel, .card-block, .person-card, .stat, .opt, .q-card";
  function cardFx() {
    if (reduce || !canFine) return;
    document.addEventListener("pointermove", function (e) {
      var t = e.target.closest && e.target.closest(TILT_SEL);
      var sp = e.target.closest && e.target.closest(SPOT_SEL);
      if (sp) {
        var r = sp.getBoundingClientRect();
        sp.style.setProperty("--mx", (e.clientX - r.left) + "px");
        sp.style.setProperty("--my", (e.clientY - r.top) + "px");
      }
      if (t) {
        var b = t.getBoundingClientRect();
        var px = (e.clientX - b.left) / b.width - 0.5, py = (e.clientY - b.top) / b.height - 0.5;
        t.style.transform = "perspective(900px) rotateX(" + (-py * 9).toFixed(2) + "deg) rotateY(" + (px * 11).toFixed(2) + "deg) translateY(-8px)";
      }
    }, { passive: true });
    document.addEventListener("pointerout", function (e) {
      var t = e.target.closest && e.target.closest(TILT_SEL);
      if (t && !t.contains(e.relatedTarget)) t.style.transform = "";
    }, { passive: true });
  }

  /* ---------- 按鈕水波紋 ---------- */
  function ripples() {
    if (reduce) return;
    document.addEventListener("pointerdown", function (e) {
      var btn = e.target.closest && e.target.closest(".btn, .chip, .seg-btn, .opt");
      if (!btn || btn.disabled) return;
      var r = btn.getBoundingClientRect();
      var s = document.createElement("span");
      s.className = "ripple";
      var size = Math.max(r.width, r.height) * 1.6;
      s.style.width = s.style.height = size + "px";
      s.style.left = (e.clientX - r.left - size / 2) + "px";
      s.style.top = (e.clientY - r.top - size / 2) + "px";
      btn.appendChild(s);
      setTimeout(function () { s.remove(); }, 700);
    });
  }

  /* ---------- 頁面切換與捲動淡入 ---------- */
  function transitions() {
    var app = document.getElementById("app");
    if (!app || reduce) return;
    window.addEventListener("hashchange", function () {
      app.classList.remove("route-in");
      void app.offsetWidth;
      app.classList.add("route-in");
    });
    var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 }) : null;
    function scan() {
      var els = app.querySelectorAll(".panel, .card-block, .chapter, .tile, .person-card, .q-card, .rq");
      Array.prototype.forEach.call(els, function (el) {
        if (el.classList.contains("reveal") || el.classList.contains("in")) return;
        el.classList.add("reveal");
        if (io) io.observe(el); else el.classList.add("in");
      });
    }
    new MutationObserver(function () { window.requestAnimationFrame(scan); }).observe(app, { childList: true, subtree: true });
    scan();
  }

  function init() {
    particles();
    cursorGlow();
    cardFx();
    ripples();
    transitions();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
