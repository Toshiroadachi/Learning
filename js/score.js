// 予想スコア算出 & 最適なパート推薦
import { getState } from './storage.js';

// 本番TOEIC L&R の各パート問題数
export const PART_INFO = {
  1: { n: 6,  sec: 'L', name: '写真描写',     ja: 'Part 1 写真描写問題' },
  2: { n: 25, sec: 'L', name: '応答問題',     ja: 'Part 2 応答問題' },
  3: { n: 39, sec: 'L', name: '会話問題',     ja: 'Part 3 会話問題' },
  4: { n: 30, sec: 'L', name: '説明文問題',   ja: 'Part 4 説明文問題' },
  5: { n: 30, sec: 'R', name: '短文穴埋め',   ja: 'Part 5 短文穴埋め問題' },
  6: { n: 16, sec: 'R', name: '長文穴埋め',   ja: 'Part 6 長文穴埋め問題' },
  7: { n: 54, sec: 'R', name: '読解',         ja: 'Part 7 読解問題' },
};

// 素点(0-100) → 換算点(5-495) の近似テーブル（公式の換算表は非公開のため一般的な傾向から近似）
const L_TABLE = [[0, 5], [10, 10], [20, 60], [30, 120], [40, 180], [50, 240], [60, 300], [70, 355], [75, 385], [80, 410], [85, 440], [90, 470], [93, 485], [96, 495], [100, 495]];
const R_TABLE = [[0, 5], [10, 5], [20, 40], [30, 95], [40, 150], [50, 210], [60, 270], [70, 325], [75, 355], [80, 385], [85, 420], [90, 450], [93, 470], [97, 495], [100, 495]];

function interp(table, x) {
  for (let i = 1; i < table.length; i++) {
    const [x0, y0] = table[i - 1], [x1, y1] = table[i];
    if (x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }
  return table[table.length - 1][1];
}
const round5 = v => Math.max(5, Math.min(495, Math.round(v / 5) * 5));
const scaledExact = (sec, raw) => interp(sec === 'L' ? L_TABLE : R_TABLE, raw);  // 丸めなし
export const rawToScaled = (sec, raw) => round5(scaledExact(sec, raw));

// 換算点 → 必要正答率（逆引き・二分探索で連続値）
function scaledToRate(sec, scaled) {
  let lo = 0, hi = 100;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (scaledExact(sec, mid) >= scaled) hi = mid; else lo = mid; }
  return hi / 100;
}

// L/R の配分（一般にリスニングの方が高得点になりやすい）
export function splitLR(total) {
  const L = Math.min(495, Math.max(5, Math.round(total * 0.53 / 5) * 5));
  return { L, R: Math.min(495, Math.max(5, total - L)) };
}

// 自己申告スコアからパートごとの事前正答率を作る
export function currentLR(settings) {
  if (settings.currentL > 0 && settings.currentR > 0) return { L: settings.currentL, R: settings.currentR };
  return splitLR(settings.currentScore || 600);
}

function priorRate(sec, settings) {
  const sp = currentLR(settings);
  return Math.min(0.995, Math.max(0.2, scaledToRate(sec, sec === 'L' ? sp.L : sp.R)));
}

const PRIOR_WEIGHT = 4;   // 事前分布の強さ（=解答4問分）
const DECAY = 0.985;      // 古い解答ほど重みを下げる

export function partStats(state = getState()) {
  const stats = {};
  for (const p of Object.keys(PART_INFO)) {
    const sec = PART_INFO[p].sec;
    const answers = state.answers.filter(a => a.part === +p);
    let w = 0, c = 0, k = 0;
    for (let i = answers.length - 1; i >= 0 && k < 300; i--, k++) {
      const wt = Math.pow(DECAY, k);
      w += wt; if (answers[i].correct) c += wt;
    }
    const prior = priorRate(sec, state.settings);
    const rate = (c + prior * PRIOR_WEIGHT) / (w + PRIOR_WEIGHT);
    const recent = answers.slice(-20);
    stats[p] = {
      part: +p,
      count: answers.length,
      correct: answers.filter(a => a.correct).length,
      rawRate: answers.length ? answers.filter(a => a.correct).length / answers.length : null,
      recentRate: recent.length ? recent.filter(a => a.correct).length / recent.length : null,
      rate,
      effN: w,
    };
  }
  return stats;
}

export function predict(state = getState()) {
  const st = partStats(state);
  let lRaw = 0, rRaw = 0, lVar = 0, rVar = 0;
  for (const [p, info] of Object.entries(PART_INFO)) {
    const s = st[p];
    const raw = s.rate * info.n;
    // 推定のばらつき（ベータ分布の分散 → 素点の分散）
    const v = s.rate * (1 - s.rate) / (s.effN + PRIOR_WEIGHT + 1) * info.n * info.n;
    if (info.sec === 'L') { lRaw += raw; lVar += v; } else { rRaw += raw; rVar += v; }
  }
  // 丸めは合計してから行う（L・R別々に丸めると合計が最大±5点ずれるため）
  const lx = scaledExact('L', lRaw), rx = scaledExact('R', rRaw);
  const total = Math.max(10, Math.min(990, Math.round((lx + rx) / 5) * 5));
  const L = Math.min(total - 5, rawToScaled('L', lRaw));
  const R = total - L;
  const sd = Math.sqrt(lVar) * 5 + Math.sqrt(rVar) * 5.5; // 1素点 ≒ 5点
  const answered = state.answers.length;
  return {
    listening: L, reading: R, total,
    low: Math.max(10, Math.round((total - sd) / 5) * 5), high: Math.min(990, Math.round((total + sd) / 5) * 5),
    lRaw, rRaw, stats: st, answered,
    confidence: answered < 30 ? '低（もっと解くと精度が上がります）' : answered < 150 ? '中' : '高',
  };
}

// 目標スコアに必要な各パート目標正答率
export function targetLR(settings) {
  if (settings.targetL > 0 && settings.targetR > 0) return { L: settings.targetL, R: settings.targetR };
  // 未入力なら 900点 → L 475 / R 425 のような一般的な配分（リスニングの方が高得点を取りやすい）
  return splitLR(settings.targetScore || 900);
}

export function targetRates(settings) {
  const { L, R } = targetLR(settings);
  const lr = scaledToRate('L', L), rr = scaledToRate('R', R);
  return { L, R, lr, rr };
}

// 推薦：目標との差 × 問題数 × データ不足ボーナス で「伸びしろ点数」を算出
export function recommend(state = getState()) {
  const pred = predict(state);
  const tgt = targetRates(state.settings);
  const recs = [];
  for (const [p, info] of Object.entries(PART_INFO)) {
    const s = pred.stats[p];
    const goal = info.sec === 'L' ? tgt.lr : tgt.rr;
    const gap = Math.max(0, goal - s.rate);
    const gain = gap * info.n * (info.sec === 'L' ? 5 : 5.5);   // 換算点の伸びしろ
    const explore = s.count < 10 ? (10 - s.count) * 1.2 : 0;   // まだ解いていないパートは測定優先
    const recentDrop = s.recentRate !== null && s.rawRate !== null && s.recentRate < s.rawRate - 0.1 ? 5 : 0;
    const score = gain + explore + recentDrop;
    let reason;
    if (s.count < 10) reason = `解答数が少なく実力を測定中（${s.count}問）。まず10問以上解きましょう。`;
    else if (gap > 0) reason = `推定正答率 ${pct(s.rate)} → 目標 ${pct(goal)}。あと約 ${Math.round(gain)} 点の伸びしろ。`;
    else reason = `目標正答率 ${pct(goal)} を達成中（${pct(s.rate)}）。維持のための復習で十分。`;
    if (recentDrop) reason += ' 直近20問の正答率が低下しています。';
    recs.push({ part: +p, score, gain, goal, rate: s.rate, reason });
  }
  recs.sort((a, b) => b.score - a.score);
  return { recs, pred, tgt };
}

// タグ（文法カテゴリ等）別の弱点
export function weakTags(state = getState(), part = null) {
  const m = {};
  for (const a of state.answers) {
    if (!a.tag || (part && a.part !== part)) continue;
    const t = (m[a.tag] ||= { tag: a.tag, n: 0, c: 0, part: a.part });
    t.n++; if (a.correct) t.c++;
  }
  return Object.values(m)
    .filter(t => t.n >= 2)
    .map(t => ({ ...t, rate: t.c / t.n }))
    .sort((a, b) => a.rate - b.rate);
}

export const pct = v => (v == null ? '—' : Math.round(v * 100) + '%');
