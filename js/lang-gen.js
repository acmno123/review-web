/*
 * 英文與日文題型產生器
 * 每個函式接受難度 lv（1–4）回傳 {q, a}。組合起來可產生大量不同題目，
 * 練習頁會記住本次已出過的題目，避免重複。
 */
(function () {
  "use strict";

  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ================= 英文 ================= */
  var IRREG_PAST = [["go", "went"], ["see", "saw"], ["take", "took"], ["make", "made"], ["come", "came"],
    ["know", "knew"], ["think", "thought"], ["buy", "bought"], ["bring", "brought"], ["write", "wrote"],
    ["read", "read"], ["eat", "ate"], ["drink", "drank"], ["run", "ran"], ["sing", "sang"], ["swim", "swam"],
    ["teach", "taught"], ["catch", "caught"], ["find", "found"], ["give", "gave"], ["have", "had"],
    ["hear", "heard"], ["meet", "met"], ["sleep", "slept"], ["speak", "spoke"], ["tell", "told"],
    ["wear", "wore"], ["win", "won"], ["begin", "began"], ["build", "built"], ["draw", "drew"],
    ["feel", "felt"], ["forget", "forgot"], ["get", "got"], ["keep", "kept"], ["leave", "left"],
    ["ride", "rode"], ["send", "sent"], ["stand", "stood"], ["understand", "understood"]];

  var PARTICIPLE = [["go", "gone"], ["see", "seen"], ["take", "taken"], ["write", "written"], ["eat", "eaten"],
    ["drink", "drunk"], ["break", "broken"], ["speak", "spoken"], ["know", "known"], ["do", "done"],
    ["make", "made"], ["buy", "bought"], ["bring", "brought"], ["hear", "heard"], ["begin", "begun"],
    ["choose", "chosen"], ["draw", "drawn"], ["drive", "driven"], ["fly", "flown"], ["come", "come"]];

  var ING = [["play", "playing"], ["make", "making"], ["write", "writing"], ["run", "running"], ["swim", "swimming"],
    ["sit", "sitting"], ["lie", "lying"], ["eat", "eating"], ["study", "studying"], ["dance", "dancing"],
    ["get", "getting"], ["stop", "stopping"], ["cook", "cooking"], ["watch", "watching"], ["read", "reading"],
    ["come", "coming"], ["leave", "leaving"], ["use", "using"], ["cry", "crying"], ["sleep", "sleeping"]];

  var ADJ = [["tall", "taller", "tallest"], ["big", "bigger", "biggest"], ["hot", "hotter", "hottest"],
    ["happy", "happier", "happiest"], ["easy", "easier", "easiest"], ["beautiful", "more beautiful", "most beautiful"],
    ["difficult", "more difficult", "most difficult"], ["expensive", "more expensive", "most expensive"],
    ["good", "better", "best"], ["bad", "worse", "worst"], ["interesting", "more interesting", "most interesting"]];

  var NOUN_PL = [["book", "books"], ["box", "boxes"], ["city", "cities"], ["baby", "babies"], ["child", "children"],
    ["man", "men"], ["woman", "women"], ["foot", "feet"], ["tooth", "teeth"], ["mouse", "mice"],
    ["knife", "knives"], ["leaf", "leaves"], ["sheep", "sheep"], ["fish", "fish"], ["bus", "buses"]];

  var THIRD_VERBS = ["play", "go", "study", "watch", "have", "do", "teach", "fix", "wash", "enjoy", "try", "catch", "speak"];
  function thirdForm(v) {
    if (v === "have") return "has";
    if (v === "do") return "does";
    if (v === "go") return "goes";
    if (/(s|x|z|ch|sh|o)$/.test(v)) return v + "es";
    if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + "ies";
    if (v === "try") return "tries";
    return v + "s";
  }

  var PRONOUN = [["I", "me", "my", "mine"], ["he", "him", "his", "his"], ["she", "her", "her", "hers"],
    ["we", "us", "our", "ours"], ["they", "them", "their", "theirs"], ["you", "you", "your", "yours"]];

  var EN = {
    irregularPast: function (lv) {
      var p = pick(IRREG_PAST);
      if (lv === 1) return { q: "「" + p[0] + "」的過去式是？", a: p[1] };
      var t = pick(["Last week I ___ (%s) something new.", "Yesterday she ___ (%s) a long letter.", "They ___ (%s) to the park yesterday."]);
      return { q: t.replace("%s", p[0]) + "（填過去式）", a: p[1] };
    },
    participle: function (lv) {
      var p = pick(PARTICIPLE);
      if (lv <= 2) return { q: "「" + p[0] + "」的過去分詞是？", a: p[1] };
      var t = pick(["I have ___ (%s) it before.", "She has already ___ (%s) the work.", "We have never ___ (%s) such a thing."]);
      return { q: t.replace("%s", p[0]) + "（填過去分詞）", a: p[1] };
    },
    thirdPerson: function (lv) {
      var v = pick(THIRD_VERBS), subj = pick(["He", "She", "My brother", "Tom"]);
      var tail = pick(["every day", "after school", "on Sundays", "at night"]);
      return { q: subj + " (" + v + ") " + tail + ". 請填入正確形式", a: thirdForm(v) };
    },
    ing: function (lv) {
      var p = pick(ING);
      if (lv === 1) return { q: "「" + p[0] + "」的現在分詞是？", a: p[1] };
      return { q: "They are ___ (" + p[0] + ") now.（填現在分詞）", a: p[1] };
    },
    comparative: function (lv) {
      var a = pick(ADJ);
      if (Math.random() < 0.5) return { q: "Tom is ___ than Ann.（" + a[0] + " 的比較級）", a: a[1] };
      return { q: "This is the ___ book I have.（" + a[0] + " 的最高級）", a: a[2] };
    },
    plural: function (lv) {
      var n = pick(NOUN_PL);
      return { q: "「" + n[0] + "」的複數形是？", a: n[1] };
    },
    pronoun: function (lv) {
      var p = pick(PRONOUN);
      if (Math.random() < 0.5) return { q: "Please give the book to ___.（" + p[0] + " 的受格）", a: p[1] };
      return { q: "That is ___ bag.（" + p[0] + " 的所有格）", a: p[2] };
    }
  };

  /* ================= 日文 ================= */
  var SEION = [["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"],
    ["か", "ka"], ["き", "ki"], ["く", "ku"], ["け", "ke"], ["こ", "ko"],
    ["さ", "sa"], ["し", "shi"], ["す", "su"], ["せ", "se"], ["そ", "so"],
    ["た", "ta"], ["ち", "chi"], ["つ", "tsu"], ["て", "te"], ["と", "to"],
    ["な", "na"], ["に", "ni"], ["ぬ", "nu"], ["ね", "ne"], ["の", "no"],
    ["は", "ha"], ["ひ", "hi"], ["ふ", "fu"], ["へ", "he"], ["ほ", "ho"],
    ["ま", "ma"], ["み", "mi"], ["む", "mu"], ["め", "me"], ["も", "mo"],
    ["や", "ya"], ["ゆ", "yu"], ["よ", "yo"],
    ["ら", "ra"], ["り", "ri"], ["る", "ru"], ["れ", "re"], ["ろ", "ro"],
    ["わ", "wa"], ["を", "wo"], ["ん", "n"]];

  var ONES = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
  function reading(n) {
    if (n === 100) return "ひゃく";
    var t = Math.floor(n / 10), o = n % 10, s = "";
    if (t) s += (t === 1 ? "" : ONES[t]) + "じゅう";
    return s + ONES[o];
  }

  var VERB_TE = [["行く", "行って"], ["見る", "見て"], ["食べる", "食べて"], ["書く", "書いて"], ["話す", "話して"],
    ["待つ", "待って"], ["死ぬ", "死んで"], ["遊ぶ", "遊んで"], ["飲む", "飲んで"], ["来る", "来て"],
    ["する", "して"], ["読む", "読んで"], ["買う", "買って"], ["泳ぐ", "泳いで"], ["作る", "作って"],
    ["寝る", "寝て"], ["起きる", "起きて"], ["帰る", "帰って"], ["教える", "教えて"], ["急ぐ", "急いで"]];

  var VERB_MASU = [["行く", "行きます"], ["見る", "見ます"], ["食べる", "食べます"], ["書く", "書きます"],
    ["話す", "話します"], ["待つ", "待ちます"], ["遊ぶ", "遊びます"], ["飲む", "飲みます"], ["来る", "来ます"],
    ["する", "します"], ["読む", "読みます"], ["買う", "買います"], ["作る", "作ります"], ["寝る", "寝ます"],
    ["起きる", "起きます"], ["帰る", "帰ります"], ["教える", "教えます"], ["泳ぐ", "泳ぎます"]];

  var ADJ_JA = [["高い", "高くない"], ["大きい", "大きくない"], ["新しい", "新しくない"], ["寒い", "寒くない"],
    ["暑い", "暑くない"], ["安い", "安くない"], ["忙しい", "忙しくない"], ["おいしい", "おいしくない"]];

  var JA = {
    kana: function (lv) {
      var k = pick(SEION);
      if (Math.random() < 0.5) return { q: "「" + k[0] + "」的羅馬拼音是？", a: k[1] };
      return { q: "羅馬拼音「" + k[1] + "」對應的平假名是？", a: k[0] };
    },
    number: function (lv) {
      var max = lv >= 3 ? 100 : 99;
      var n = ri(1, max);
      if (Math.random() < 0.5) return { q: "「" + reading(n) + "」是幾？", a: String(n) };
      return { q: n + " 的平假名讀法是？", a: reading(n) };
    },
    verbTe: function (lv) {
      var v = pick(VERB_TE);
      if (Math.random() < 0.5) return { q: "「" + v[0] + "」的て形是？", a: v[1] };
      return { q: "「" + v[1] + "」的辭書形（原形）是？", a: v[0] };
    },
    verbMasu: function (lv) {
      var v = pick(VERB_MASU);
      return { q: "「" + v[0] + "」的ます形（敬體）是？", a: v[1] };
    },
    adjNeg: function (lv) {
      var a = pick(ADJ_JA);
      return { q: "「" + a[0] + "」的否定形是？", a: a[1] };
    }
  };

  window.LANG_GENS = {
    en: [EN.irregularPast, EN.participle, EN.thirdPerson, EN.ing, EN.comparative, EN.plural, EN.pronoun],
    ja: [JA.kana, JA.number, JA.verbTe, JA.verbMasu, JA.adjNeg]
  };
})();
