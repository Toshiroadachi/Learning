// localStorage への保存（この端末のみ）。設定画面からバックアップ可能。
const KEY = 'mlccdojo:v1';

function fresh() {
  return {
    settings: {
      aiProvider: '',                  // '' | 'none' | 'anthropic' | 'openai'
      apiKey: '',                      // Anthropic API キー（任意）
      claudeModel: 'claude-opus-5-5',
      openaiKey: '',                   // OpenAI API キー（任意）
      openaiModel: '',
      openaiModels: [],
      openaiPriceIn: '',
      openaiPriceOut: '',
      theme: '',
      yen: 150,
      dailyCards: 15,                  // 1日の新しい用語カードの上限
      v: 1,
    },
    lessons: {},     // lessonId -> { done: true, ts }
    quiz: {},        // quizKey -> { ok, wrongLast, ts, wrong }
    cards: {},       // termId -> { box, due, ts }（間隔反復）
    aiQuiz: [],      // AI が作った問題 { id, track, topic, q, choices, a, exp, ts }
    aiNotes: {},     // lessonId -> [{ kind, text, ts }] AI 先生の回答を保存
    chats: {},       // 技術相談の履歴
    feyn: [],        // 説明チェックの記録 { ts, topic, score }
    log: [],         // { ts, kind, id }
    aiUsage: [],     // { ts, provider, model, in, out }
  };
}

let state = null;
export function getState() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? merge(fresh(), JSON.parse(raw)) : fresh();
  } catch { state = fresh(); }
  return state;
}
function merge(base, saved) {
  for (const k of Object.keys(saved)) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && saved[k] && typeof saved[k] === 'object' && !Array.isArray(saved[k]))
      base[k] = { ...base[k], ...saved[k] };
    else base[k] = saved[k];
  }
  return base;
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(getState())); }
  catch (e) { console.warn('保存できませんでした', e); }
}
export function logActivity(kind, id) {
  const st = getState();
  st.log.push({ ts: Date.now(), kind, id });
  if (st.log.length > 4000) st.log = st.log.slice(-4000);
  save();
}
export function exportData() { return JSON.stringify(getState(), null, 2); }
export function importData(text) { state = merge(fresh(), JSON.parse(text)); save(); }
export function resetAll() { state = fresh(); save(); }
export function streak() {
  const days = new Set(getState().log.map(l => new Date(l.ts).toDateString()));
  let n = 0; const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function todayCount() {
  const t = new Date().toDateString();
  return getState().log.filter(l => new Date(l.ts).toDateString() === t).length;
}

// ---------- 用語カードの間隔反復（1→3→7→16→35→90日） ----------
const INTERVALS = [0, 1, 3, 7, 16, 35, 90];
const DAY = 86400000;
export function cardDue(id, now = Date.now()) {
  const c = getState().cards[id];
  return !c || c.due <= now;
}
export function rateCard(id, ok) {
  const st = getState();
  const c = st.cards[id] || { box: 0 };
  const box = ok ? Math.min(INTERVALS.length - 1, (c.box || 0) + 1) : 1;
  st.cards[id] = { box, due: Date.now() + INTERVALS[box] * DAY - 3600000, ts: Date.now() };
  save();
}
