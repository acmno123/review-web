/*
 * 出題引擎
 * - next(unit, lastQ, level)：level = 1 基礎、2 進階、3 困難、0 混合
 * - 產生器 G[name](lv) 會隨機產生新題，數字隨難度變大
 * - 題庫項目 [題目, 答案, 難度(可省略)]，省略難度者任何難度都會出現
 * - check(input, expected)：忽略空白、大小寫、單位與結尾標點；數字視為等值比較
 *   expected 可用「|」列出多個正確答案
 */
(function () {
  "use strict";

  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a); }
  function isPrime(n) {
    if (n < 2) return false;
    for (var i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  }
  function signed(n) { return n < 0 ? "(" + n + ")" : String(n); }
  function sgn(n) { return n < 0 ? "- " + Math.abs(n) : "+ " + n; }

  var LEVEL_NAMES = { 1: "基礎", 2: "進階", 3: "困難", 4: "魔王" };

  var G = {};

  /* ---------- 數學 ---------- */
  G.absValue = function (lv) {
    if (lv === 1) { var a = ri(1, 30); return { q: "計算 |" + (-a) + "| = ?", a: String(a) }; }
    if (lv === 2) { var a2 = ri(1, 99); return { q: "計算 |" + (-a2) + "| = ?", a: String(a2) }; }
    var x = ri(1, 40), y = ri(1, 40);
    return { q: "計算 |(" + (-x) + ") - (" + (-y) + ")| = ?", a: String(Math.abs(y - x)) };
  };
  G.signedAdd = function (lv) {
    var R = lv === 1 ? 20 : lv === 2 ? 50 : 99;
    if (lv === 3) {
      var a = ri(-R, R), b = ri(-R, R), c = ri(-R, R);
      return { q: "計算 " + signed(a) + " + " + signed(b) + " - " + signed(c) + " = ?", a: String(a + b - c) };
    }
    var a2 = ri(-R, R), b2 = ri(-R, R);
    return { exp: "這題是 " + a2 + " + " + b2 + "。" + (a2 * b2 >= 0 ? "同號相加：符號不變，絕對值相加，得 " : "異號相加：取絕對值較大者的符號，絕對值相減，得 ") + (a2 + b2) + "。", q: "計算 " + signed(a2) + " + " + signed(b2) + " = ?", a: String(a2 + b2) };
  };
  G.signedSub = function (lv) {
    var R = lv === 1 ? 20 : lv === 2 ? 50 : 99;
    var a = ri(-R, R), b = ri(-R, R);
    return { q: "計算 " + signed(a) + " - " + signed(b) + " = ?", a: String(a - b) };
  };
  G.signedMul = function (lv) {
    if (lv === 3) {
      var a = ri(-9, 9), b = ri(-9, 9), c = ri(-9, 9);
      return { q: "計算 " + signed(a) + " × " + signed(b) + " × " + signed(c) + " = ?", a: String(a * b * c) };
    }
    var R = lv === 1 ? 9 : 15;
    var x = ri(-R, R), y = ri(-R, R);
    return { exp: x + " × " + y + "：" + (x * y >= 0 ? "同號（或含 0）得正" : "異號得負") + "，絕對值相乘得 " + (Math.abs(x) * Math.abs(y)) + "，所以結果是 " + (x * y) + "。", q: "計算 " + signed(x) + " × " + signed(y) + " = ?", a: String(x * y) };
  };
  G.signedDiv = function (lv) {
    var d = lv === 3 ? pick([-12, -9, -8, -7, 7, 8, 9, 12]) : pick([-6, -4, -3, -2, 2, 3, 4, 6]);
    var R = lv === 3 ? 12 : 9;
    var c = ri(-R, R);
    return { q: "計算 " + signed(d * c) + " ÷ " + signed(d) + " = ?", a: String(c) };
  };
  G.factor = function (lv) {
    var lo = lv === 1 ? 12 : lv === 2 ? 60 : 150, hi = lv === 1 ? 60 : lv === 2 ? 150 : 400;
    var n;
    do { n = ri(lo, hi); } while (isPrime(n));
    var out = [], m = n, p = 2;
    while (m > 1) {
      if (m % p === 0) { out.push(p); m /= p; } else { p++; }
    }
    return { exp: "從最小的質數開始逐一試除：" + out.join(" × ") + " = " + n + "。", q: "把 " + n + " 做質因數分解（格式如 2×2×3）", a: out.join("×") };
  };
  G.gcdlcm = function (lv) {
    var a, b;
    if (lv === 1) { a = ri(2, 12) * ri(1, 9); b = ri(2, 12) * ri(1, 9); }
    else if (lv === 2) { a = ri(4, 30) * ri(1, 12); b = ri(4, 30) * ri(1, 12); }
    else { a = ri(6, 60) * ri(2, 20); b = ri(6, 60) * ri(2, 20); }
    if (a === b) b += 1;
    var g = gcd(a, b);
    if (Math.random() < 0.5) return { q: "求 " + a + " 與 " + b + " 的最大公因數", a: String(g) };
    return { q: "求 " + a + " 與 " + b + " 的最小公倍數", a: String(a * b / g) };
  };
  G.linear = function (lv) {
    if (lv === 3) {
      var x = ri(-9, 9), a = ri(2, 9), c = ri(-9, 9);
      if (c === a) c = a + 1;
      var d = ri(-20, 20), b = (c - a) * x + d;
      return { q: "解方程式：" + a + "x " + sgn(b) + " = " + c + "x " + sgn(d) + "，求 x", a: String(x) };
    }
    var x2 = ri(-9, 9), a2 = ri(2, 9) * (Math.random() < 0.3 ? -1 : 1), b2 = ri(-20, 20);
    return { exp: "兩邊" + (b2 >= 0 ? "減去 " + b2 : "加上 " + (-b2)) + "，得 " + a2 + "x = " + (a2 * x2) + "；兩邊同除以 " + a2 + "，得 x = " + x2 + "。", q: "解方程式：" + a2 + "x " + sgn(b2) + " = " + (a2 * x2 + b2) + "，求 x", a: String(x2) };
  };
  G.linearParen = function (lv) {
    var R = lv === 1 ? 9 : 15;
    var x = ri(-R, R), a = ri(2, lv === 3 ? 9 : 6), m = ri(-9, 9);
    var inner = m >= 0 ? "- " + m : "+ " + (-m);
    return { q: "解方程式：" + a + "(x " + inner + ") = " + (a * (x - m)) + "，求 x", a: String(x) };
  };
  G.ratio = function (lv) {
    var a = ri(2, 9), b = ri(2, 9), k = ri(2, lv === 1 ? 9 : lv === 2 ? 15 : 25);
    return { exp: "交叉相乘（內項乘積 = 外項乘積）：" + b + " × " + (a * k) + " = " + a + " × x，所以 x = " + (b * k) + "。", q: "比例式 " + a + " : " + b + " = " + (a * k) + " : ?", a: String(b * k) };
  };
  G.percent = function (lv) {
    if (lv === 3) {
      var P = ri(5, 50) * 10, p = pick([3, 5, 6, 7, 8, 9]);
      return { q: "某商品原價 " + P + " 元，打 " + p + " 折，售價是多少元？", a: String(P * p / 10) };
    }
    var base = ri(1, lv === 1 ? 20 : 60) * 20, pp = ri(1, 19) * 5;
    return { exp: "求 " + base + " 的 " + pp + "%：" + base + " × " + pp + " ÷ 100 = " + (base * pp / 100) + "。", q: "求 " + base + " 的 " + pp + "% 是多少？", a: String(base * pp / 100) };
  };
  G.triangleAngle = function (lv) {
    if (lv === 3) {
      var a = ri(20, 80), b = ri(20, 150 - a);
      return { q: "三角形的一個外角為 " + (a + b) + "°，與它不相鄰的一個內角為 " + a + "°，另一個不相鄰內角是多少度？", a: String(b) };
    }
    var a2 = ri(20, 80), b2 = ri(20, 150 - a2);
    return { q: "三角形的兩個內角分別為 " + a2 + "° 與 " + b2 + "°，第三個內角是多少度？", a: String(180 - a2 - b2) };
  };
  G.pythagoras = function (lv) {
    var TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
    var t = pick(TRIPLES), k = ri(1, lv === 1 ? 3 : lv === 2 ? 6 : 10);
    var a = t[0] * k, b = t[1] * k, c = t[2] * k;
    if (Math.random() < 0.5) return { exp: "勾股定理：兩股平方和等於斜邊平方。" + a + "² + " + b + "² = " + (a * a + b * b) + "，所以斜邊 c = " + c + "。", q: "直角三角形兩股長 " + a + " 與 " + b + "，斜邊長是多少？", a: String(c) };
    return { q: "直角三角形斜邊長 " + c + "，一股長 " + a + "，另一股長是多少？", a: String(b) };
  };
  G.linearFunc = function (lv) {
    if (lv === 3) {
      var x1 = ri(-5, 5), dx = pick([1, 2, 3, 4]), m3 = ri(-4, 4), b3 = ri(-10, 10);
      var y1 = m3 * x1 + b3, y2 = m3 * (x1 + dx) + b3;
      return { q: "直線過點 (" + x1 + ", " + y1 + ") 與 (" + (x1 + dx) + ", " + y2 + ")，斜率是多少？", a: String(m3) };
    }
    var m = ri(-5, 5), b = ri(-10, 10), x = ri(-4, 6);
    return { q: "函數 y = " + m + "x " + sgn(b) + "，當 x = " + x + " 時，y 是多少？", a: String(m * x + b) };
  };
  G.factorSum = function (lv) {
    var R = lv === 3 ? 15 : 9;
    var a = ri(-R, R), b = ri(-R, R);
    if (a === 0) a = 2;
    if (b === 0) b = -3;
    return { q: "展開 (x " + sgn(a) + ")(x " + sgn(b) + ")，一次項 x 的係數是多少？", a: String(a + b) };
  };
  G.circleArea = function (lv) {
    if (lv === 3) {
      var R = ri(3, 10), r = ri(1, R - 1);
      return { q: "外圓半徑 " + R + "、內圓半徑 " + r + " 的圓環，面積是多少？（π 取 3.14，取到小數點後兩位）", a: (3.14 * (R * R - r * r)).toFixed(2) };
    }
    var rr = ri(1, 10);
    return { q: "半徑為 " + rr + " 的圓，面積是多少？（π 取 3.14，取到小數點後兩位）", a: (3.14 * rr * rr).toFixed(2) };
  };

  /* ---------- 自然 ---------- */
  G.density = function (lv) {
    var d = ri(1, lv === 1 ? 10 : 20), v = ri(2, lv === 1 ? 20 : 50), m = d * v;
    if (Math.random() < 0.5) return { exp: "密度 = 質量 ÷ 體積 = " + m + " ÷ " + v + " = " + d + " g/cm³。", q: "某物體質量 " + m + " g，體積 " + v + " cm³，密度是多少 g/cm³？", a: String(d) };
    return { q: "某物質密度 " + d + " g/cm³，體積 " + v + " cm³，質量是多少 g？", a: String(m) };
  };
  G.concentration = function (lv) {
    var s = ri(1, lv === 1 ? 10 : 30) * 100, p = ri(1, 19) * 5;
    return { q: "溶液重 " + s + " g，其中含溶質 " + (s * p / 100) + " g，濃度是多少 %？", a: String(p) };
  };
  G.microscope = function (lv) {
    var e = pick(lv === 3 ? [5, 10, 15, 20] : [5, 10, 15]);
    var o = pick(lv === 3 ? [4, 10, 40, 100] : [4, 10, 40]);
    return { q: "目鏡 " + e + " 倍、物鏡 " + o + " 倍，總放大倍率是多少倍？", a: String(e * o) };
  };
  G.reflection = function (lv) {
    var t = ri(10, 80);
    if (Math.random() < 0.5) return { q: "入射角為 " + t + " 度，反射角是多少度？", a: String(t) };
    return { q: "入射光與鏡面的夾角為 " + (90 - t) + " 度，入射角是多少度？", a: String(t) };
  };
  G.speed = function (lv) {
    var v = ri(2, lv === 1 ? 20 : 40), t = ri(2, lv === 3 ? 20 : 12);
    return { q: "一物體 " + t + " 秒內移動 " + (v * t) + " 公尺，平均速率是多少 m/s？", a: String(v) };
  };
  G.ohm = function (lv) {
    if (lv === 3) {
      var R1 = ri(2, 12), R2 = ri(2, 12), I = ri(1, 6);
      return { q: "兩個電阻 " + R1 + " Ω 與 " + R2 + " Ω 串聯，接在 " + (I * (R1 + R2)) + " V 的電源上，電流是多少 A？", a: String(I) };
    }
    var I2 = ri(1, 9), R = ri(2, 12);
    return { q: "電流 " + I2 + " A，電阻 " + R + " Ω，電壓是多少 V？", a: String(I2 * R) };
  };
  G.work = function (lv) {
    if (lv === 3) {
      var F = ri(2, 30), t = pick([2, 4, 5]), k = ri(1, 6), d = k * t;
      return { q: "用 " + F + " N 的力使物體沿力的方向移動 " + d + " m，歷時 " + t + " 秒，功率是多少 W？", a: String(F * k) };
    }
    var F2 = ri(2, 50) * 5, d2 = ri(1, 10);
    return { q: "用 " + F2 + " N 的力推物體，使其沿力的方向移動 " + d2 + " m，做功多少焦耳（J）？", a: String(F2 * d2) };
  };
  G.mapScale = function (lv) {
    var n = pick([1000, 2000, 5000, 10000, 25000, 50000]), c = ri(1, 10);
    if (lv === 3) {
      return { q: "比例尺 1/" + n + "，實際距離 " + (c * n / 100) + " 公尺，圖上距離多少公分？", a: String(c) };
    }
    return { q: "比例尺 1/" + n + "，圖上距離 " + c + " 公分，實際距離是多少公尺？", a: String(c * n / 100) };
  };

  /* ---------- 英文（句型變化） ---------- */
  G.englishBe = function () {
    var s = pick([["I", "am"], ["You", "are"], ["We", "are"], ["They", "are"],
                  ["He", "is"], ["She", "is"], ["It", "is"]]);
    var others = ["am", "is", "are"].filter(function (x) { return x !== s[1]; });
    return { exp: "be 動詞依主詞決定：I 用 am；you、we、they 用 are；he、she、it 用 is。這題的主詞是 " + s[0] + "，所以用 " + s[1] + "。", q: "請選出正確的 be 動詞：" + s[0] + " ____ a student.", a: s[1], d: others.concat(["be"]) };
  };
  G.englishThird = function () {
    // [原形, 第三人稱單數, 現在分詞, 過去式, 句尾]
    var verbs = [["go", "goes", "going", "went", "to school every day"],
      ["play", "plays", "playing", "played", "basketball after school"],
      ["study", "studies", "studying", "studied", "English at night"],
      ["watch", "watches", "watching", "watched", "TV in the evening"],
      ["have", "has", "having", "had", "breakfast at seven"],
      ["do", "does", "doing", "did", "homework after dinner"]];
    var v = pick(verbs);
    var s = pick(["He", "She"]);
    return { exp: "第三人稱單數（he / she / it）的現在式動詞要加 s 或 es（子音 + y 結尾改 ies）：" + v[0] + " → " + v[1] + "。", q: "請選出 " + v[0] + " 的正確形式：" + s + " ____ " + v[4] + ".", a: v[1], d: [v[0], v[2], v[3]] };
  };
  G.englishIng = function () {
    var v = pick([["play", "playing", "basketball"], ["run", "running", "in the park"],
      ["study", "studying", "English"], ["make", "making", "a cake"],
      ["write", "writing", "a letter"], ["swim", "swimming", "in the pool"]]);
    var sb = pick([["They", "are"], ["We", "are"], ["I", "am"]]);
    var ans = sb[0] + " " + sb[1] + " " + v[1] + " " + v[2] + ".";
    return {
      q: "請選出正確的現在進行式：" + sb[0] + " " + v[0] + " " + v[2] + ".",
      a: ans,
      d: [sb[0] + " " + v[0] + " " + v[2] + ".", sb[0] + " " + sb[1] + " " + v[0] + " " + v[2] + ".", sb[0] + " " + v[1] + " " + v[2] + "."]
    };
  };
  G.comparative = function () {
    var adj = pick([["tall", "taller"], ["big", "bigger"], ["happy", "happier"],
                    ["beautiful", "more beautiful"], ["good", "better"],
                    ["hot", "hotter"], ["expensive", "more expensive"]]);
    return { q: "請寫出 " + adj[0] + " 的比較級", a: adj[1] };
  };
  G.presentPerfect = function (lv) {
    var v = pick([["see", "seen", "that movie"], ["eat", "eaten", "sushi"],
                  ["visit", "visited", "Taipei"], ["write", "written", "a letter"]]);
    var subj = pick([["I", "have"], ["We", "have"], ["They", "have"], ["He", "has"], ["She", "has"]]);
    var other = subj[1] === "have" ? "has" : "have";
    if (lv === 3) {
      return { q: "請選出否定句的正確形式：" + subj[0] + " ____ not " + v[1] + " " + v[2] + " before.", a: subj[1] + " not " + v[1], d: [other + " not " + v[1], "had not " + v[1], subj[1] + " not " + v[0]] };
    }
    return { exp: subj[0] + " 用 " + subj[1] + "；現在完成式 = have / has + 過去分詞，" + v[0] + " 的過去分詞是 " + v[1] + "。", q: "請選出 " + v[0] + " 的正確形式：" + subj[0] + " ____ " + v[2] + " before.", a: subj[1] + " " + v[1], d: [other + " " + v[1], "had " + v[1], subj[1] + " " + v[0]] };
  };

  /* ---------- 日文版題型（與中文版數學、理化題對應） ---------- */
  var JA = {
    absValue: function () { var a = ri(1, 30); return { q: "次の絶対値を求めなさい：|" + (-a) + "|", a: String(a) }; },
    signedAdd: function (lv) { var R = lv === 1 ? 20 : 50, a = ri(-R, R), b = ri(-R, R); return { q: "計算しなさい：" + signed(a) + " + " + signed(b), a: String(a + b) }; },
    signedMul: function (lv) { var R = lv === 1 ? 9 : 15, x = ri(-R, R), y = ri(-R, R); return { q: "計算しなさい：" + signed(x) + " × " + signed(y), a: String(x * y) }; },
    linear: function () { var x = ri(-9, 9), a = ri(2, 9), b = ri(-20, 20); return { q: "方程式を解きなさい：" + a + "x " + sgn(b) + " = " + (a * x + b) + "（x を求めよ）", a: String(x) }; },
    factor: function (lv) {
      var n; do { n = ri(12, lv === 1 ? 60 : 150); } while (isPrime(n));
      var out = [], m = n, p = 2;
      while (m > 1) { if (m % p === 0) { out.push(p); m /= p; } else { p++; } }
      return { q: "次の数を素因数分解しなさい（例：2×2×3）：" + n, a: out.join("×") };
    },
    percent: function () { var base = ri(1, 20) * 20, p = ri(1, 19) * 5; return { q: base + " の " + p + "% はいくつですか？", a: String(base * p / 100) }; },
    ratio: function () { var a = ri(2, 9), b = ri(2, 9), k = ri(2, 9); return { q: a + " : " + b + " ＝ " + (a * k) + " : x のとき、x はいくつですか？", a: String(b * k) }; },
    density: function () { var d = ri(1, 10), v = ri(2, 20); return { q: "質量 " + (d * v) + " g、体積 " + v + " cm³ の物体の密度は何 g/cm³ですか？", a: String(d) }; },
    speed: function () { var v = ri(2, 20), t = ri(2, 12); return { q: t + " 秒間に " + (v * t) + " m 進んだ物体の速さは何 m/s ですか？", a: String(v) }; },
    ohm: function () { var I = ri(1, 9), R = ri(2, 12); return { q: "電流 " + I + " A、抵抗 " + R + " Ω のとき、電圧は何 V ですか？", a: String(I * R) }; },
    mapScale: function () { var n = pick([1000, 2000, 5000, 10000, 25000, 50000]), c = ri(1, 10); return { q: "縮尺 1/" + n + " の地図で、地図上の距離 " + c + " cm は実際の距離何 m ですか？", a: String(c * n / 100) }; },
    circleArea: function () { var r = ri(1, 10); return { q: "半径 " + r + " の円の面積は？（π＝3.14、小数第 2 位まで）", a: (3.14 * r * r).toFixed(2) }; }
  };

  /* ---------- 取得下一題 ----------
   * level：0 混合、1–4 指定難度
   * lang ："zh"（中文，預設）或 "ja"（日文版）
   * 若單元沒有日文版題目，回傳 missing: true */
  function nextRaw(unit, lastQ, level, lang) {
    level = level || 0;
    var ja = lang === "ja";
    var pool = [];
    if (ja) {
      (unit.gen || []).forEach(function (name) { if (JA[name]) pool.push({ ja: name }); });
      (unit.bank || []).forEach(function (item) {
        if (item[3] && (!level || !item[2] || item[2] === level)) pool.push({ jaItem: item });
      });
    } else {
      (unit.gen || []).forEach(function (name) { pool.push({ gen: name }); });
      (unit.genFns || []).forEach(function (fn) { pool.push({ fn: fn }); });
      var banks = (unit.bank || []).filter(function (item) {
        if (level) return item.length < 3 || item[2] === level;
        return item.length < 3 || item[2] !== 4; // 混合模式不出魔王題
      });
      if (!banks.length) banks = unit.bank || [];
      banks.forEach(function (item) { pool.push({ item: item }); });
    }
    if (!pool.length) {
      return { q: ja ? "（此單元尚無日文版題目）" : "此單元尚無題目", a: "", lv: 1, missing: true };
    }

    var res, tries = 0;
    do {
      var p = pick(pool);
      var lv = level || ri(1, 3);
      if (p.ja) {
        res = JA[p.ja](lv === 4 ? 3 : lv);
        res.lv = lv;
      } else if (p.jaItem) {
        res = { q: p.jaItem[3], a: p.jaItem[1], lv: p.jaItem[2] || level || 1 };
      } else if (p.fn) {
        res = p.fn(Math.min(lv, 3));
        res.lv = lv;
      } else if (p.gen) {
        var bossFn = lv === 4 ? G[p.gen + "Boss"] : null;
        res = bossFn ? bossFn() : G[p.gen](Math.min(lv, 3));
        res.lv = lv;
      } else {
        res = { q: p.item[0], a: p.item[1], lv: p.item[2] || level || 1, exp: p.item.exp };
      }
      tries++;
    } while (res.q === lastQ && tries < 6 && pool.length > 1);
    return res;
  }

  /* ---------- 魔王級產生器（level 4，名稱 = 原產生器名 + "Boss"） ---------- */
  Object.assign(G, {
    linearBoss: function () {
      var x = ri(-12, 12), a = ri(2, 9), b = ri(2, 9), m = ri(-9, 9), n = ri(-9, 9);
      if (a === b) b += 1;
      var c = (a - b) * x + a * m + b * n;
      return { q: "解方程式：" + a + "(x " + sgn(m) + ") - " + b + "(x " + sgn(-n) + ") = " + c + "，求 x", a: String(x) };
    },
    factorBoss: function () {
      var n;
      do { n = ri(400, 1200); } while (isPrime(n));
      var out = [], m = n, p = 2;
      while (m > 1) { if (m % p === 0) { out.push(p); m /= p; } else { p++; } }
      return { q: "把 " + n + " 做質因數分解（格式如 2×2×3）", a: out.join("×") };
    },
    signedAddBoss: function () {
      var a = ri(-12, 12), b = ri(-12, 12), c = ri(-12, 12), d = ri(-12, 12);
      return { q: "計算 " + signed(a) + " × " + signed(b) + " - " + signed(c) + " × " + signed(d) + " = ?", a: String(a * b - c * d) };
    },
    gcdlcmBoss: function () {
      var k = pick([2, 3, 4, 6, 8, 12]);
      var a = k * ri(2, 9), b = k * ri(2, 9), c = k * ri(2, 9);
      return { q: "求 " + a + "、" + b + "、" + c + " 的最大公因數", a: String(gcd(gcd(a, b), c)) };
    },
    percentBoss: function () {
      var P = ri(1, 20) * 100, p = pick([10, 20, 50]), q = pick([4, 6, 8]);
      return { q: "某商品原價 " + P + " 元，先漲價 " + p + "%，再打 " + q + " 折，最後售價是多少元？", a: String((P / 100) * (100 + p) * q / 10) };
    },
    ohmBoss: function () {
      var pr = pick([[6, 3, 2], [4, 4, 2], [12, 4, 3], [6, 6, 3], [10, 10, 5], [12, 6, 4], [20, 5, 4], [8, 8, 4]]);
      return { q: "兩個電阻 " + pr[0] + " Ω 與 " + pr[1] + " Ω 並聯，總電阻是多少 Ω？", a: String(pr[2]) };
    },
    pythagorasBoss: function () {
      var TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
      var t = pick(TRIPLES), k = ri(1, 10);
      var a = t[0] * k, b = t[1] * k, c = t[2] * k;
      return { q: "直角三角形兩股長 " + a + " 與 " + b + "，三邊長的總和（周長）是多少？", a: String(a + b + c) };
    },
    linearFuncBoss: function () {
      var m = pick([1, 2, 3, -2, -3, 4]), x0 = ri(-6, 6), b = -m * x0;
      return { q: "直線 y = " + m + "x " + sgn(b) + " 與 x 軸的交點，x 座標是多少？", a: String(x0) };
    },
    factorSumBoss: function () {
      var a = ri(1, 9), b = ri(1, 9);
      return { q: "展開 (x " + sgn(a) + ")² - (x " + sgn(-b) + ")²，一次項 x 的係數是多少？", a: String(2 * (a + b)) };
    }
  });

  // 清理題目文字：移除列出選項的括號（選項會以按鈕顯示）與「（填…）」類提示
  function cleanQ(q) {
    return String(q)
      .replace(/\s*[（(][^）)]*(\/|或)[^）)]*[）)]/g, "")
      .replace(/\s*[（(](填|問|請)[^）)]*[）)]/g, "")
      .replace(/\s+$/, "");
  }
  function next(unit, lastQ, level, lang) {
    var r = nextRaw(unit, lastQ, level, lang);
    if (r && r.q) r.q = cleanQ(r.q);
    return r;
  }

  /* ---------- 標準化與比對 ---------- */
  function normalize(s) {
    return String(s).trim().toLowerCase()
      .replace(/[×*＊]/g, "x")
      .replace(/\s+/g, "")
      .replace(/[，,。．.!！?？]+$/, "")
      .replace(/(度|公尺|公分|%|m\/s|g\/cm³|cm³|g|安培|伏特|焦耳|瓦特|歐姆|ω)$/, "");
  }

  function check(input, expected) {
    var alts = String(expected).split("|").map(normalize);
    var got = normalize(input);
    if (got === "") return false;
    if (alts.indexOf(got) !== -1) return true;
    var n = Number(got);
    if (!isNaN(n)) {
      return alts.some(function (a) {
        var m = Number(a);
        return !isNaN(m) && Math.abs(m - n) < 1e-6;
      });
    }
    return false;
  }

  window.QUIZ = { next: next, cleanQ: cleanQ, check: check, LEVEL_NAMES: LEVEL_NAMES, hasJa: function (u) { return !!((u.gen || []).some(function (g) { return JA[g]; }) || (u.bank || []).some(function (b) { return b[3]; })); } };
})();
