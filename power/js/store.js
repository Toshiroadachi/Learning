// localStorage への保存（この端末のみ）。設定画面からバックアップ可能。
const KEY = 'powerdojo:v1';

function fresh() {
  return {
    settings: {
      aiProvider: '',                  // '' | 'none' | 'anthropic' | 'openai'
      apiKey: '',                      // Anthropic API キー（任意）
      claudeModel: 'claude-opus-5-5',
      openaiKey: '',                   // OpenAI API キー（任意）
      openaiModel: '',                 // 空なら既定モデル
      openaiModels: [],                // 取得したモデル一覧
      openaiPriceIn: '',               // 任意：単価（USD / 100万入力トークン）
      openaiPriceOut: '',              // 任意：単価（USD / 100万出力トークン）
      theme: '',                       // '' | 'light' | 'dark'
      yen: 150,                        // 1ドルの円換算
      v: 1,
    },
    lessons: {},     // lessonId -> { done: true, ts }
    quiz: {},        // quizKey -> { ok: bool, ts, wrong: n }
    ex: {},          // exerciseId -> { passed: true, code, ts }
    drafts: {},      // exerciseId -> 書きかけ
    pc: {},          // PC実践の taskId -> { done, ts }
    aiEx: [],        // AI が作った演習
    chats: {},       // 実務相談の履歴
    play: {},        // 練習場の状態
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
  if (st.log.length > 3000) st.log = st.log.slice(-3000);
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
