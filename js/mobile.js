/*
 * 手機版強化：底部快速導覽列、目前頁面高亮、側邊選單可以右滑關閉。
 * 桌面版不會顯示底部導覽列；嵌入模式（工作桌面的視窗）也不會顯示。
 */
(function () {
  "use strict";

  if (document.documentElement.classList.contains("embed")) return;

  var TABS = [
    ["#/", "🏠", "首頁"],
    ["#/review", "📝", "複習"],
    ["#/mock", "🎯", "模擬"],
    ["#/people", "🏆", "社群"],
    ["menu", "☰", "更多"]
  ];

  var bar = document.createElement("nav");
  bar.className = "m-tabbar";
  bar.setAttribute("aria-label", "快速導覽");
  bar.innerHTML = TABS.map(function (t) {
    return '<a class="m-tab" href="' + (t[0] === "menu" ? "#" : t[0]) + '" data-tab="' + t[0] + '">' +
      '<span class="mi">' + t[1] + '</span><span class="ml">' + t[2] + '</span></a>';
  }).join("");
  document.body.appendChild(bar);

  function current() {
    var h = location.hash || "#/";
    if (h === "#" || h === "#/") return "#/";
    var base = "#/" + h.replace(/^#\/?/, "").split("/")[0];
    return base;
  }

  function mark() {
    var cur = current();
    Array.prototype.forEach.call(bar.querySelectorAll(".m-tab"), function (a) {
      var t = a.getAttribute("data-tab");
      var on = t !== "menu" && (t === cur || (t === "#/review" && cur === "#/review") || (t === "#/people" && (cur === "#/people" || cur === "#/chat" || cur === "#/friends" || cur === "#/inbox")));
      a.classList.toggle("active", on);
    });
  }

  bar.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".m-tab");
    if (!a) return;
    if (a.getAttribute("data-tab") === "menu") {
      e.preventDefault();
      if (window.Menu) window.Menu.open();
    }
  });

  window.addEventListener("hashchange", mark);
  mark();

  // 側邊選單：在面板上向右滑超過 70 像素即關閉
  var startX = null;
  document.addEventListener("touchstart", function (e) {
    startX = e.target.closest && e.target.closest("#drawer .drawer-panel") ? e.touches[0].clientX : null;
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (dx > 70 && window.Menu) window.Menu.close();
    startX = null;
  }, { passive: true });
})();
