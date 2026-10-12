/*
 * 單元的上下學期對應
 *   1 = 上學期　2 = 下學期　（未列出的單元會顯示在「待分類」）
 *
 * 重要：以下是依照 108 課綱常見的編排所填的預設值，尚未逐一對照任何特定版本的課本。
 * 你的課本若與這裡不同，直接修改數字即可，網站會自動依照新的設定分組。
 *
 * 特別需要對照課本確認的（編排差異較大）：
 *   數學 8 年級、數學 9 年級、自然 8 年級、自然 9 年級、社會 8 年級、社會 9 年級、
 *   國文 8 年級、國文 9 年級、英文 7 年級、英文 8 年級、日文 7 年級
 */
window.SEMESTERS = {
  /* ---------- 數學 ---------- */
  "math-7-1": 1, "math-7-2": 1, "math-7-3": 1, "math-7-4": 1, "math-7-5": 1, "math-7-6": 1,
  "math-7-7": 2, "math-7-8": 2, "math-7-9": 2,
  "math-8-1": 1, "math-8-2": 1, "math-8-3": 1,
  "math-8-4": 2, "math-8-5": 2, "math-8-6": 2,
  "math-9-1": 1, "math-9-3": 1, "math-9-6": 1,
  "math-9-2": 2, "math-9-4": 2, "math-9-5": 2,

  /* ---------- 自然 ---------- */
  "science-7-1": 1, "science-7-2": 1, "science-7-3": 1, "science-7-4": 1, "science-7-5": 1,
  "science-7-6": 2, "science-7-7": 2,
  "science-8-1": 1, "science-8-2": 1, "science-8-4": 1, "science-8-5": 1,
  "science-8-3": 2, "science-8-6": 2,
  "science-9-1": 1, "science-9-2": 1, "science-9-3": 1, "science-9-4": 1,
  "science-9-5": 2, "science-9-6": 2,

  /* ---------- 社會 ---------- */
  "social-7-1": 1, "social-7-2": 1, "social-7-3": 1,
  "social-7-4": 2, "social-7-5": 2,
  "social-8-1": 1, "social-8-2": 1, "social-8-4": 1, "social-8-5": 1, "social-8-6": 1,
  "social-8-3": 2,
  "social-9-1": 1, "social-9-2": 1, "social-9-4": 1, "social-9-5": 1,
  "social-9-3": 2, "social-9-6": 2,

  /* ---------- 國文 ---------- */
  "chinese-7-1": 1, "chinese-7-2": 1, "chinese-7-3": 1, "chinese-7-4": 1,
  "chinese-7-5": 2, "chinese-7-6": 2,
  "chinese-8-1": 1, "chinese-8-2": 1,
  "chinese-8-3": 2, "chinese-8-4": 2, "chinese-8-5": 2, "chinese-8-6": 2,
  "chinese-9-1": 1, "chinese-9-2": 1,
  "chinese-9-3": 2, "chinese-9-4": 2, "chinese-9-5": 2, "chinese-9-6": 2,

  /* ---------- 英文 ---------- */
  "english-7-1": 1, "english-7-4": 1, "english-7-5": 1,
  "english-7-2": 2, "english-7-3": 2,
  "english-8-1": 1, "english-8-2": 1, "english-8-3": 1,
  "english-8-4": 2, "english-8-5": 2, "english-8-6": 2,
  "english-9-1": 1, "english-9-2": 1,
  "english-9-3": 2, "english-9-4": 2, "english-9-5": 2, "english-9-6": 2,

  /* ---------- 日文（僅七年級） ---------- */
  "ja-7-1": 1, "ja-7-2": 1, "ja-7-4": 1,
  "ja-7-3": 2, "ja-7-5": 2
};

window.SEMESTER_NAMES = { 1: "上學期", 2: "下學期", 0: "待分類" };
