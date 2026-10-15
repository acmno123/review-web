/*
 * HUD 開機動畫：每個瀏覽工作階段第一次開啟時播放一次（約 2 秒）。
 * 減少動態效果時不播放。
 */
(function () {
  "use strict";
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var KEY = "crs_hud_boot";
  try { if (reduce || sessionStorage.getItem(KEY)) return; sessionStorage.setItem(KEY, "1"); } catch (e) { return; }

  var lines = [
    "> SYSTEM BOOT ........................ <span class='ok'>OK</span>",
    "> LOADING CURRICULUM 108 ............. <span class='ok'>OK</span>",
    "> SYNCING SUBJECTS (數 自 社 國 英 日) ... <span class='ok'>OK</span>",
    "> CALIBRATING ADAPTIVE ASSESSMENT .... <span class='ok'>OK</span>",
    "> ALL SYSTEMS NOMINAL <span class='cur'></span>"
  ];
  var box = document.createElement("div");
  box.id = "hud-boot";
  box.innerHTML = "<pre></pre>";
  document.body.appendChild(box);
  var pre = box.querySelector("pre"), i = 0;

  function next() {
    if (i < lines.length) {
      pre.innerHTML += lines[i] + "\n";
      i += 1;
      setTimeout(next, 260);
    } else {
      setTimeout(function () { box.classList.add("done"); setTimeout(function () { box.remove(); }, 700); }, 500);
    }
  }
  next();
  box.addEventListener("click", function () { box.classList.add("done"); setTimeout(function () { box.remove(); }, 700); });
})();
