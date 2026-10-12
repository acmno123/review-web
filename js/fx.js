/*
 * 動畫工具：答對彩帶、答錯抖動、彈跳、數字跳動。
 * 若使用者開啟「減少動態效果」，所有動畫都會關閉。
 */
(function () {
  "use strict";

  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#0ea5e9"];

  // 在指定座標噴出彩帶
  function confettiAt(x, y, count) {
    if (reduce || !document.body.animate) return;
    for (var i = 0; i < count; i++) {
      var piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.background = COLORS[i % COLORS.length];
      piece.style.left = x + "px";
      piece.style.top = y + "px";
      document.body.appendChild(piece);
      var angle = Math.random() * Math.PI * 2;
      var dist = 70 + Math.random() * 110;
      var dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist - 40;
      var rot = (Math.random() * 720 - 360) + "deg";
      var anim = piece.animate([
        { transform: "translate(-50%, -50%) rotate(0deg) scale(1)", opacity: 1 },
        { transform: "translate(calc(-50% + " + dx + "px), calc(-50% + " + (dy + 120) + "px)) rotate(" + rot + ") scale(.6)", opacity: 0 }
      ], { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" });
      anim.onfinish = function (p) { return function () { p.remove(); }; }(piece);
    }
  }

  // 以元素中心為起點噴彩帶
  function burst(el) {
    if (!el || reduce) return;
    var r = el.getBoundingClientRect();
    confettiAt(r.left + r.width / 2, r.top + r.height / 2, 28);
  }

  // 重新觸發 CSS 動畫的 class
  function retrigger(el, cls) {
    if (!el || reduce) return;
    el.classList.remove(cls);
    void el.offsetWidth; // 強制重排，讓動畫可以重播
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 700);
  }

  function shake(el) { retrigger(el, "fx-shake"); }
  function pop(el) { retrigger(el, "fx-pop"); }

  // 數字從 0 跳到目標值
  function countUp(el, to, ms) {
    if (!el) return;
    if (reduce) { el.textContent = to; return; }
    var start = performance.now();
    function frame(t) {
      var p = Math.min(1, (t - start) / (ms || 900));
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  window.FX = { burst: burst, confetti: confettiAt, shake: shake, pop: pop, countUp: countUp };
})();
