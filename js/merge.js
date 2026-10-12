/*
 * 學習資料合併：把「本機」與「雲端」兩份資料合成一份，而不是整份覆蓋。
 * 規則：
 * - 單元進度：完成狀態取「任一邊完成」，次數取較大值，上次複習時間取較新者
 * - 筆記：以較新的一邊為準（本機優先）
 * - 錯題本：兩邊聯集（以題目文字去重）
 * - 模擬考紀錄、每日曲線：聯集，同一天取較大值
 * - 各科統計：取作答題數較多的一邊（避免重複計算）
 * - 成就、XP、挑戰次數：取較大值或聯集
 * 這個模組是純函式，可以在 Node 中測試。
 */
(function () {
  "use strict";

  function num(v) { return typeof v === "number" && isFinite(v) ? v : 0; }

  function uniqBy(arr, keyFn) {
    var seen = {}, out = [];
    (arr || []).forEach(function (x) {
      var k = keyFn(x);
      if (!seen[k]) { seen[k] = true; out.push(x); }
    });
    return out;
  }

  function mergeUnit(a, b) {
    a = a || {}; b = b || {};
    var la = num(a.lastReviewed), lb = num(b.lastReviewed);
    return {
      review: Math.max(num(a.review), num(b.review)),
      correct: Math.max(num(a.correct), num(b.correct)),
      completed: !!(a.completed || b.completed),
      lastReviewed: Math.max(la, lb),
      note: (la >= lb ? (a.note || b.note) : (b.note || a.note)) || ""
    };
  }

  function mergeStats(a, b) {
    var out = {}, keys = Object.keys(Object.assign({}, a || {}, b || {}));
    keys.forEach(function (k) {
      var ra = (a || {})[k], rb = (b || {})[k];
      if (!ra) { out[k] = rb; return; }
      if (!rb) { out[k] = ra; return; }
      var ta = num(ra.right) + num(ra.wrong), tb = num(rb.right) + num(rb.wrong);
      out[k] = ta >= tb ? ra : rb; // 取作答較多的一邊，避免重複計算
    });
    return out;
  }

  function mergeHistory(a, b) {
    var byDay = {};
    [].concat(a || [], b || []).forEach(function (d) {
      var cur = byDay[d.day] || { day: d.day, right: 0, wrong: 0 };
      cur.right = Math.max(cur.right, num(d.right));
      cur.wrong = Math.max(cur.wrong, num(d.wrong));
      byDay[d.day] = cur;
    });
    return Object.keys(byDay).sort().map(function (k) { return byDay[k]; }).slice(-60);
  }

  // 「今天已完成」之類的日期字串：取較晚的一個
  function laterDate(a, b) {
    if (!a) return b || "";
    if (!b) return a;
    var da = Date.parse(a), db = Date.parse(b);
    if (isNaN(da) || isNaN(db)) return a;
    return da >= db ? a : b;
  }

  function pickStreak(a, b) {
    a = a || { day: "", count: 0 }; b = b || { day: "", count: 0 };
    var da = Date.parse(a.day), db = Date.parse(b.day);
    if (!a.day) return b;
    if (!b.day) return a;
    if (da !== db) return da > db ? a : b;
    return num(a.count) >= num(b.count) ? a : b;
  }

  function merge(local, cloud) {
    local = local || {}; cloud = cloud || {};
    var lu = local.units || {}, cu = cloud.units || {};
    var units = {};
    Object.keys(Object.assign({}, lu, cu)).forEach(function (k) { units[k] = mergeUnit(lu[k], cu[k]); });

    return {
      units: units,
      earned: uniqBy([].concat(local.earned || [], cloud.earned || []), function (x) { return x; }),
      wrong: uniqBy([].concat(cloud.wrong || [], local.wrong || []), function (w) { return w.q; }).slice(0, 200),
      mocks: uniqBy([].concat(local.mocks || [], cloud.mocks || []), function (m) { return m.date + "|" + m.scope; })
        .sort(function (x, y) { return x.date - y.date; }).slice(-20),
      notes: Object.assign({}, cloud.notes || {}, local.notes || {}),
      stats: mergeStats(local.stats, cloud.stats),
      history: mergeHistory(local.history, cloud.history),
      streak: pickStreak(local.streak, cloud.streak),
      today: (function () {
        var a = local.today || { day: "", count: 0 }, b = cloud.today || { day: "", count: 0 };
        if (a.day === b.day) return { day: a.day, count: Math.max(num(a.count), num(b.count)) };
        return laterDate(a.day, b.day) === a.day ? a : b;
      })(),
      goal: local.goal || cloud.goal || 5,
      bestMock: Math.max(num(local.bestMock), num(cloud.bestMock)),
      dailyDay: laterDate(local.dailyDay, cloud.dailyDay),
      dailyCount: Math.max(num(local.dailyCount), num(cloud.dailyCount)),
      xp: Math.max(num(local.xp), num(cloud.xp))
    };
  }

  window.DataMerge = { merge: merge };
})();
