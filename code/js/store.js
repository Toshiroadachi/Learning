// localStorage への保存（この端末のみ）。設定画面からバックアップ可能。
const KEY = 'codedojo:v1';

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
      typeSpeed: 1,                    // シミュレーターの文字送り速度（0=瞬時, 1=普通, 2=ゆっくり）
      startDay: 1,                     // Python：ここから学習（それより前の Day は修了扱い）
      v: 2,
    },
    sims: {},        // scenarioId -> { done: true, score, total, ts }
    days: {},        // day -> { done: true, ts }
    exercises: {},   // exId -> { passed: true, code, ts }
    drafts: {},      // exId -> code（書きかけ）
    aiDays: {},      // day -> AIが作成したレッスン
    checks: {},      // 理解度チェックの結果  "d1-0" -> { ok, ts }
    playground: '',  // 練習帳のコード
    log: [],         // { ts, kind, id } 学習記録
    aiUsage: [],     // { ts, model, in, out }
    live: null,      // ライブ体験の状態
  };
}

let state = null;

export function getState() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : null;
    state = saved ? merge(fresh(), saved) : fresh();
    // v2: Python は Day 1 から、AI は OpenAI に変更
    if (saved && (saved.settings?.v || 1) < 2) {
      state.settings.startDay = 1;
      state.settings.v = 2;
      state.live = null;
      save();
    }
  } catch {
    state = fresh();
  }
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
  if (st.log.length > 2000) st.log = st.log.slice(-2000);
  save();
}

export function exportData() { return JSON.stringify(getState(), null, 2); }
export function importData(text) {
  const obj = JSON.parse(text);
  state = merge(fresh(), obj);
  save();
}
export function resetAll() { state = fresh(); save(); }

// 連続学習日数
export function streak() {
  const days = new Set(getState().log.map(l => new Date(l.ts).toDateString()));
  let n = 0;
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
