/*
 * 網站名稱設定：改名只需要修改這一個檔案。
 * 標題、導覽列、首頁大標題、側邊選單的名稱都會自動套用。
 */
window.SITE = {
  name: "國中測試",
  icon: "📚",
  tagline: "108 課綱・國一到國三"
};

(function () {
  "use strict";
  function apply() {
    var s = window.SITE;
    document.title = s.name;
    var brand = document.querySelector(".brand");
    if (brand) brand.textContent = s.icon + " " + s.name;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
})();
