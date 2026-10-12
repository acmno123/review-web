/*
 * 英文與日文擴充題型（接在 lang-gen.js 之後載入，會加入 window.LANG_GENS）
 * 每個函式回傳 {q, a}，與原有題型相同。
 */
(function () {
  "use strict";

  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ================= 英文 ================= */
  // 冠詞 a / an：依發音（母音開頭用 an）
  var NOUNS_A = [["book", "a"], ["cat", "a"], ["dog", "a"], ["university", "a"], ["useful idea", "a"],
    ["apple", "an"], ["egg", "an"], ["umbrella", "an"], ["hour", "an"], ["orange", "an"], ["English book", "an"]];

  // 介系詞：地點與時間
  var PREP = [
    ["The book is ___ the desk.（on / in / at）", "on"],
    ["The pen is ___ the box.（on / in / at）", "in"],
    ["I study ___ school every day.（at / in / on）", "at"],
    ["We meet ___ Monday.（at / on / in）", "on"],
    ["She was born ___ 2010.（at / in / on）", "in"],
    ["The meeting starts ___ 8 o'clock.（at / in / on）", "at"],
    ["He is waiting ___ the bus stop.（at / in / on）", "at"]
  ];

  // 疑問詞
  var WH = [
    ["___ is your name?（填疑問詞）", "What"],
    ["___ do you live?（問地點）", "Where"],
    ["___ old are you?（問年齡）", "How"],
    ["___ time does the class start?（問時間）", "What"],
    ["___ are you going tomorrow?（問時間，用 when）", "When"],
    ["___ is your favorite color?（問哪一個）", "What"],
    ["___ did you go yesterday?（問原因，用 why）", "Why"]
  ];

  // 助動詞 do / does（否定與疑問）
  var DO = [
    ["I ___ like coffee.（do / does）", "do"],
    ["She ___ like coffee.（do / does）", "does"],
    ["___ you speak English?（Do / Does）", "Do"],
    ["___ he play soccer?（Do / Does）", "Does"],
    ["They ___ not live here.（do / does）", "do"],
    ["It ___ not rain today.（do / does）", "does"]
  ];

  var EN_EXTRA = {
    articles: function () {
      var n = pick(NOUNS_A);
      return { q: "I have ___ " + n[0] + ".（填 a 或 an）", a: n[1] };
    },
    prepositions: function () {
      var p = pick(PREP);
      return { q: p[0], a: p[1] };
    },
    questionWords: function () {
      var w = pick(WH);
      return { q: w[0], a: w[1] };
    },
    doDoes: function () {
      var d = pick(DO);
      return { q: d[0], a: d[1] };
    }
  };

  /* ================= 日文 ================= */
  var PARTICLE = [
    ["私___学生です。（は / が / を）", "は"],
    ["猫___好きです。（が / は / を）", "が"],
    ["ご飯___食べます。（を / が / に）", "を"],
    ["東京___行きます。（に / を / が）", "に"],
    ["友達___会います。（に / を / で）", "に"],
    ["図書館___勉強します。（で / に / を）", "で"]
  ];

  // 形容詞分類
  var ADJ_TYPE = [["大きい", "い形容詞"], ["高い", "い形容詞"], ["新しい", "い形容詞"], ["静か", "な形容詞"],
    ["きれい", "な形容詞"], ["元気", "な形容詞"], ["暑い", "い形容詞"], ["有名", "な形容詞"]];

  // 片假名外來語
  var KATAKANA = [["パン", "麵包"], ["ノート", "筆記本"], ["ドア", "門"], ["ペン", "筆"], ["カメラ", "相機"],
    ["ケーキ", "蛋糕"], ["バス", "公車"], ["ホテル", "飯店"], ["テーブル", "桌子"], ["コーヒー", "咖啡"]];

  // 動詞分類（五段／一段／變格）
  var VERB_TYPE = [["書く", "五段"], ["行く", "五段"], ["話す", "五段"], ["待つ", "五段"], ["食べる", "一段"],
    ["見る", "一段"], ["起きる", "一段"], ["教える", "一段"], ["する", "變格"], ["来る", "變格"]];

  var JA_EXTRA = {
    particles: function () {
      var p = pick(PARTICLE);
      return { q: p[0], a: p[1] };
    },
    adjType: function () {
      var a = pick(ADJ_TYPE);
      return { q: "「" + a[0] + "」是哪一種形容詞？（い形容詞 / な形容詞）", a: a[1] };
    },
    katakana: function () {
      var k = pick(KATAKANA);
      return { q: "片假名「" + k[0] + "」的意思是？", a: k[1] };
    },
    verbGroup: function () {
      var v = pick(VERB_TYPE);
      return { q: "「" + v[0] + "」屬於哪一類動詞？（五段 / 一段 / 變格）", a: v[1] };
    }
  };

  // 追加到原本的題型陣列（只加入一次）
  if (window.LANG_GENS && !window.LANG_GENS.__extra) {
    Object.keys(EN_EXTRA).forEach(function (k) { window.LANG_GENS.en.push(EN_EXTRA[k]); });
    Object.keys(JA_EXTRA).forEach(function (k) { window.LANG_GENS.ja.push(JA_EXTRA[k]); });
    window.LANG_GENS.__extra = true;
  }
})();
