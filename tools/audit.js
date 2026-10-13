/*
 * 內容品質檢查：在專案根目錄執行  node tools/audit.js
 * 檢查：引用檔案是否存在、單元欄位是否完整、題目與答案格式、年級與學期、
 * 標題重複、實際出題是否正常，以及詳解覆蓋率。
 */
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
global.window = {};
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const problems = [];

// 1. index.html 引用的檔案都存在
[...html.matchAll(/(?:src|href)="([^"#?][^"]*)"/g)].map(m => m[1]).filter(p => !p.startsWith("http")).forEach(p => {
  if (!fs.existsSync(path.join(root, p))) problems.push("引用檔案不存在: " + p);
});

// 2. 依 index.html 的順序載入內容檔
const order = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1])
  .filter(f => /content|lessons|lang-gen|quiz|semesters|explain-bank|catalog|video-library/.test(f));
order.forEach(f => { try { require(path.join(root, f)); } catch (e) { problems.push("載入失敗 " + f + ": " + e.message); } });

const Q = window.QUIZ;
const units = [];
(window.SUBJECTS || []).forEach(s => Object.keys(s.chapters).forEach(g => s.chapters[g].forEach(ch =>
  ch.units.forEach(u => units.push({ u, subj: s.id, grade: +g })))));

// 3. 單元欄位與題目格式
const ids = {};
units.forEach(({ u, grade }) => {
  if (ids[u.id]) problems.push("單元 id 重複: " + u.id);
  ids[u.id] = 1;
  if (!u.title) problems.push("沒有標題: " + u.id);
  if (!u.points || !u.points.length) problems.push("沒有重點: " + u.id);
  if (![7, 8, 9].includes(grade)) problems.push("年級異常: " + u.id);
  const bank = u.bank || [], gens = u.gen || [];
  if (bank.length + gens.length === 0) problems.push("沒有題目來源: " + u.id);
  bank.forEach((x, i) => {
    if (!x[0] || !String(x[0]).trim()) problems.push("題目為空: " + u.id + " #" + i);
    if (x[1] === undefined || String(x[1]).trim() === "") problems.push("答案為空: " + u.id + " #" + i);
    if (/[（(]/.test(String(x[1]))) problems.push("答案含括號: " + u.id + " #" + i + " " + x[1]);
  });
  const qs = bank.map(x => x[0]);
  const dup = qs.filter((q, i) => qs.indexOf(q) !== i);
  if (dup.length) problems.push("題庫內重複題目: " + u.id + " " + dup[0]);
  // 題庫不足 3 題又沒有產生器，才算真正的問題
  if (bank.length && bank.length < 3 && !gens.length) problems.push("題庫少於 3 題且沒有產生器: " + u.id);
});

// 4. 學期對應
const SEM = window.SEMESTERS || {};
units.forEach(({ u }) => { if (!(u.id in SEM)) problems.push("未指定學期（顯示為待分類）: " + u.id); });
Object.keys(SEM).forEach(k => { if (!ids[k]) problems.push("學期對應表有不存在的單元: " + k); });

// 5. 同科同年級的標題重複
const seenTitle = {};
units.forEach(({ u, subj, grade }) => {
  const k = subj + "|" + grade + "|" + String(u.title).replace(/[\s\p{P}]/gu, "").toLowerCase();
  if (seenTitle[k]) problems.push("同科同年級標題重複: " + u.id + " 與 " + seenTitle[k]);
  else seenTitle[k] = u.id;
});

// 6. 實際出題：每單元出 20 題，檢查不會出錯、答案有效
units.forEach(({ u }) => {
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    try {
      const it = Q.next(u, null, 0);
      if (!it || !it.q || it.a === undefined || String(it.a).trim() === "") { problems.push("出題結果異常: " + u.id); break; }
      seen.add(it.q);
    } catch (e) { problems.push("出題錯誤 " + u.id + ": " + e.message); break; }
  }
});

// 7. 詳解覆蓋率
let total = 0, withExp = 0;
units.forEach(({ u }) => (u.bank || []).forEach(x => { total++; if (x.exp) withExp++; }));

console.log("== 內容品質檢查 ==");
console.log("單元總數:", units.length, "| 題庫題目:", total, "| 有詳解:", withExp, "(" + Math.round(withExp / Math.max(total, 1) * 100) + "%)");
console.log("問題數:", problems.length);
problems.slice(0, 100).forEach(p => console.log(" -", p));
if (problems.length > 100) console.log(" ...還有", problems.length - 100, "項");
process.exitCode = problems.length ? 1 : 0;
