// localStorage への保存（この端末のみ）。設定画面からバックアップ可能。
const KEY = 'codedojo:v1';

function fresh() {
  return {
    settings: {
      apiKey: '',                      // Anthropic API キー（任意）
      claudeModel: 'claude-opus-5-5',
      theme: '',                       // '' | 'light' | 'dark'
      typeSpeed: 1,                    // シミュレーターの文字送り速度（0=瞬時, 1=普通, 2=ゆっくり）
      startDay: 11,                    // Python：ここから学習（Day1〜10 は修了済み）
    },
    sims: {},        // scenarioId -> { done: true, score, total, ts }
    days: {},        // day -> { done: true, ts }
    exercises: {},   // exId -> { passed: true, code, ts }
    drafts: {},      // exId -> code（書きかけ）
    aiDays: {},      // day -> AIが作成したレッスン
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
    state = raw ? merge(fresh(), JSON.parse(raw)) : fresh();
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

// 同じサイトの TOEIC アプリに保存されている Anthropic API キーを読み込む
export function keyFromToeicApp() {
  try {
    const raw = localStorage.getItem('toeic900:v1');
    return raw ? (JSON.parse(raw).settings?.apiKey || '') : '';
  } catch { return ''; }
}

// 連続学習日数
export function streak() {
  const days = new Set(getState().log.map(l => new Date(l.ts).toDateString()));
  let n = 0;
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
