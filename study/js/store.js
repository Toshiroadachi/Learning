// localStorage への保存（この端末のみ）。設定画面からバックアップ可能。
const KEY = 'rikalab:v1';
function fresh() {
  return {
    settings: {
      aiProvider: '', apiKey: '', claudeModel: 'claude-opus-5-5',
      openaiKey: '', openaiModel: '', openaiModels: [], openaiPriceIn: '', openaiPriceOut: '',
      theme: '', yen: 150, name: '', dailyGoal: 5, v: 1,
    },
    xp: 0,
    answers: {},     // 問題ID -> { ok, tries, firstOk, hint, ts, lastOk }
    units: {},       // 単元ID -> { read: true, ts }
    aiUnits: {},     // 単元ID -> AI が作った教材
    aiProblems: {},  // 単元ID -> AI が作った追加問題のリスト
    badges: {},      // バッジID -> 取得日時
    daily: {},       // 'YYYY-MM-DD' -> { correct, bonus }
    challenge: {},   // 教科 -> ベストスコア
    chats: {},       // AI 先生の会話
    log: [],
    aiUsage: [],
  };
}
let state = null;
export function getState() {
  if (state) return state;
  try { const raw = localStorage.getItem(KEY); state = raw ? merge(fresh(), JSON.parse(raw)) : fresh(); }
  catch { state = fresh(); }
  return state;
}
function merge(base, saved) {
  for (const k of Object.keys(saved)) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && saved[k] && typeof saved[k] === 'object' && !Array.isArray(saved[k])) base[k] = { ...base[k], ...saved[k] };
    else base[k] = saved[k];
  }
  return base;
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(getState())); } catch (e) { console.warn('保存できませんでした', e); } }
export function logActivity(kind, id) {
  const st = getState(); st.log.push({ ts: Date.now(), kind, id });
  if (st.log.length > 5000) st.log = st.log.slice(-5000);
  save();
}
export function exportData() { return JSON.stringify(getState(), null, 2); }
export function importData(text) { state = merge(fresh(), JSON.parse(text)); save(); }
export function resetAll() { state = fresh(); save(); }
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function streak() {
  const days = new Set(getState().log.map(l => todayKey(new Date(l.ts))));
  let n = 0; const d = new Date();
  if (!days.has(todayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
