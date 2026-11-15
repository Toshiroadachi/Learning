// localStorage を使った永続化（端末内に保存）。JSONエクスポート/インポートでバックアップ可能。
const KEY = 'toeic900:v1';

const DEFAULT_SCHEDULE = [
  { id: 'vocab',  label: '単語フラッシュカード', target: 30, unit: '語', kind: 'vocab' },
  { id: 'p5',     label: 'Part 5 文法・語彙',     target: 20, unit: '問', kind: 'part', part: 5 },
  { id: 'listen', label: 'リスニング Part 2〜4',  target: 15, unit: '問', kind: 'listening' },
  { id: 'shadow', label: 'シャドーイング（Part 3/4 スクリプト）', target: 15, unit: '分', kind: 'manual' },
  { id: 'p7',     label: 'Part 7 長文読解',       target: 8,  unit: '問', kind: 'part', part: 7 },
  { id: 'review', label: '間違えた問題の復習',     target: 10, unit: '問', kind: 'review' },
  { id: 'news',   label: '海外ニュースを読む',     target: 2,  unit: '記事', kind: 'news' },
];

function fresh() {
  return {
    settings: {
      currentScore: 700,   // 自己申告の現在スコア（予想得点の事前分布に使う）
      currentL: 0,         // 任意：リスニング点（0=未入力）
      currentR: 0,         // 任意：リーディング点（0=未入力）
      targetScore: 900,
      examDate: '',
      speechRate: 0.95,
      aiProvider: '',      // '' | 'anthropic' | 'openai'
      apiKey: '',          // Anthropic
      claudeModel: 'claude-opus-5-5',
      openaiKey: '',
      openaiModel: '',
      openaiModels: [],    // 取得したモデル一覧のキャッシュ
      p5TimeLimit: 20,     // Part5 1問あたりの目標秒数
    },
    answers: [],           // {qid, part, tag, correct, ts, ms}
    srs: {},               // 間違えた問題: qid -> {box, due}
    vocab: {},             // word -> {box, due, seen, correct}
    myWords: [],           // ニュースから保存した単語 {word, note, ts, source}
    schedule: DEFAULT_SCHEDULE,
    log: {},               // 'YYYY-MM-DD' -> {taskId: count, manual: {taskId: true}}
    newsRead: {},          // articleId -> ts
    aiBank: [],            // AI生成問題
    mocks: [],             // {ts, listening, reading, total}
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    const base = fresh();
    return { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) } };
  } catch (e) {
    console.warn('load failed', e);
    return fresh();
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('save failed', e); }
}

export function getState() { return state; }

export function today(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function bump(taskKind, n = 1) {
  const day = today();
  const log = (state.log[day] ||= { counts: {}, manual: {} });
  log.counts[taskKind] = (log.counts[taskKind] || 0) + n;
}

const DAY = 86400000;
const SRS_INTERVALS = [0, 1, 3, 7, 16, 35]; // 日

export function recordAnswer({ qid, part, tag, correct, ms }) {
  state.answers.push({ qid, part, tag: tag || '', correct: !!correct, ts: Date.now(), ms: ms || 0 });
  // 復習キュー（間違えた問題を間隔反復）
  const item = state.srs[qid];
  if (!correct) {
    state.srs[qid] = { box: 1, due: Date.now() + DAY, part };
  } else if (item) {
    const box = item.box + 1;
    if (box >= SRS_INTERVALS.length) delete state.srs[qid];
    else state.srs[qid] = { box, due: Date.now() + SRS_INTERVALS[box] * DAY, part };
  }
  bump('part' + part);
  if (part >= 1 && part <= 4) bump('listening');
  save();
}

export function recordVocab(word, known) {
  const v = (state.vocab[word] ||= { box: 0, due: 0, seen: 0, correct: 0 });
  v.seen++;
  if (known) { v.correct++; v.box = Math.min(v.box + 1, 5); }
  else v.box = 0;
  v.due = Date.now() + (known ? SRS_INTERVALS[v.box] : 0) * DAY + (known ? 0 : 60000);
  bump('vocab');
  save();
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const s = JSON.parse(text);
  if (!s || !Array.isArray(s.answers)) throw new Error('形式が正しくありません');
  const base = fresh();
  state = { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) } };
  save();
}

export function resetAll() {
  const { aiProvider, apiKey, claudeModel, openaiKey, openaiModel, openaiModels } = state.settings;
  state = fresh();
  Object.assign(state.settings, { aiProvider, apiKey, claudeModel, openaiKey, openaiModel, openaiModels });
  save();
}

export { DEFAULT_SCHEDULE };
