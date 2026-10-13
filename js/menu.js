/*
 * 側邊選單：點右上角三條槓開啟，所有頁面入口都收在裡面。
 * 依登入狀態與管理員身分顯示不同的項目。依賴 app.js 的 window.AppKit。
 */
(function () {
  "use strict";

  var drawer = null;

  function kit() { return window.AppKit; }

  function groups() {
    var k = kit(), user = k.currentUser(), admin = k.isAdmin();
    var list = [
      { title: "學習", items: [
        ["#/review", "📝", "複習中心", "閱讀講解，回答題目確認複習"],
        ["#/map", "🌌", "知識星圖", "用星座看你的學習進度"],
        ["#/mock", "🎯", "模擬考", "自訂範圍、題數與難度"],
        ["#/wrong", "📕", "錯題本", "重練答錯的題目"],
        ["#/lang/en", "🔤", "英文題庫", "整批英文練習"],
        ["#/lang/ja", "🇯🇵", "日文題庫", "整批日文練習"]
      ] },
      { title: "社群", items: [
        ["#/people", "🏆", "排行榜", "看看誰的進度最快"],
        ["#/friends", "👫", "好友", "加好友、接受邀請"],
        ["#/inbox", "💌", "私訊", "和好友一對一聊天"],
        ["#/chat", "💬", "聊天室", "和所有人聊天"]
      ] }
    ];
    if (user) {
      list.push({ title: "我的", items: [
        ["#/dashboard", "📊", "我的學習", "進度、成就、學習分析"],
        ["#/u/" + encodeURIComponent(user), "🪪", "個人檔案", "你的公開頁面"]
      ] });
    } else {
      list.push({ title: "帳號", items: [
        ["#/login", "🔑", "登入", "已有帳號的人請從這裡進入"],
        ["#/register", "✨", "註冊", "建立新帳號"]
      ] });
    }
    if (admin) {
      list.push({ title: "管理", items: [
        ["#/admin", "🛠️", "管理後台", "帳號、內容、檢舉"]
      ] });
    }
    return list;
  }

  function tile(it) {
    return '<a class="drawer-tile" href="' + it[0] + '"><span class="dt-icon">' + it[1] + '</span>' +
      '<span class="dt-text"><strong>' + it[2] + '</strong><small>' + it[3] + '</small></span></a>';
  }

  function build() {
    var k = kit(), user = k.currentUser();
    var theme = (localStorage.getItem("crs_theme") || '"dark"').replace(/"/g, "");
    var head = user
      ? '<div class="drawer-avatar">' + k.esc(user.charAt(0).toUpperCase()) + '</div><div><strong>' + k.esc(user) + '</strong><small>歡迎回來</small></div>'
      : '<div class="drawer-avatar">📚</div><div><strong>國中複習站</strong><small>登入後可以保存學習紀錄</small></div>';
    var body = groups().map(function (g) {
      return '<section class="drawer-group"><h3>' + g.title + '</h3><div class="drawer-grid">' +
        g.items.map(tile).join("") + '</div></section>';
    }).join("");
    var foot = '<button class="drawer-action" data-action="theme">' + (theme === "dark" ? "☀️ 切換為亮色" : "🌙 切換為深色") + '</button>' +
      (user ? '<button class="drawer-action danger" data-action="logout">🚪 登出</button>' : '');
    drawer.innerHTML = '<div class="drawer-backdrop" data-action="menu-close"></div>' +
      '<aside class="drawer-panel" role="dialog" aria-label="功能選單">' +
      '<div class="drawer-head">' + head + '<button class="drawer-x" data-action="menu-close" aria-label="關閉">✕</button></div>' +
      '<div class="drawer-body">' + body + '</div>' +
      '<div class="drawer-foot">' + foot + '</div></aside>';
  }

  function open() {
    if (!drawer) return;
    build();
    drawer.classList.add("open");
    document.body.classList.add("menu-open");
    drawer.setAttribute("aria-hidden", "false");
  }

  function close() {
    if (!drawer) return;
    drawer.classList.remove("open");
    document.body.classList.remove("menu-open");
    drawer.setAttribute("aria-hidden", "true");
  }

  function init() {
    drawer = document.createElement("div");
    drawer.id = "drawer";
    drawer.className = "drawer";
    drawer.setAttribute("aria-hidden", "true");
    document.body.appendChild(drawer);

    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest('[data-action="menu-open"]')) { open(); return; }
      if (e.target.closest && e.target.closest('[data-action="menu-close"]')) { close(); return; }
      if (e.target.closest && e.target.closest("#drawer .drawer-tile")) { close(); return; }
      if (e.target.closest && e.target.closest('#drawer [data-action="theme"], #drawer [data-action="logout"]')) {
        // 主題與登出由 app.js 處理；選單先關閉，畫面重新繪製後再重建
        setTimeout(function () { if (drawer.classList.contains("open")) build(); }, 0);
      }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    window.addEventListener("hashchange", close);
  }

  window.Menu = { open: open, close: close };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
