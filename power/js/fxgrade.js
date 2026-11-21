// Power Fx 演習の実行と採点（画面とテストで共用）
import { App, deepEq, show, FxErr, FxDate, isTable, isRec, delegationWarnings } from './fx.js';
import { APPS } from '../data/apps-screens.js';

export const FX_TODAY = Date.UTC(2026, 5, 15);   // 演習の「今日」は 2026/6/15 に固定
export function makeApp(ex) {
  const app = new App(APPS[ex.app], FX_TODAY);
  if (ex.screen) app.screen = ex.screen;
  for (const [k, v] of Object.entries(ex.set || {})) { const [c, p] = k.split('.'); app.setFormula(c, p, v); }
  return app;
}
export function parentGallery(app, ctl) {
  for (const s of app.def.screens) for (const c of s.controls) if (c.template && c.template.some(t => t.name === ctl)) return c.name;
  return null;
}
export function setInputs(app, inputs = {}) {
  for (const [name, v] of Object.entries(inputs)) {
    const c = app.ctlIndex[name]; if (!c) continue;
    const st = (app.state[name] ||= {});
    if (c.type === 'TextInput') st.Text = String(v);
    else if (c.type === 'Toggle' || c.type === 'Checkbox') st.Value = !!v;
    else if (c.type === 'Slider') st.Value = +v;
    else if (c.type === 'Gallery') st.sel = +v - 1;
    else if (c.type === 'DatePicker') st.Value = new FxDate(Date.parse(v + 'T00:00:00Z'));
    else {
      const items = app.evalProp(name, 'Items') || [];
      const i = items.findIndex(r => { const vals = Object.entries(r).filter(([k]) => !k.startsWith('__')).map(([, x]) => x); return vals[0] === v || r.Value === v; });
      st.sel = i < 0 ? 0 : i;
    }
  }
}
export function runBehavior(app, ctl, prop) {
  const src = app.propSrc(ctl, prop);
  if (!src || !String(src).trim()) return;
  const c = app.ctlIndex[ctl]; const g = parentGallery(app, ctl);
  const extra = {};
  if (c.type === 'Gallery') extra.thisItem = app.ctlValue(ctl, 'Selected');
  else if (g) extra.thisItem = app.ctlValue(g, 'Selected');
  app.ev(app.ast(String(src)), { self: ctl, ...extra });
}
export function evalTarget(app, ex) {
  const { control, prop } = ex.target;
  if (/^On/.test(prop)) { for (let k = 0; k < (ex.clicks || 1); k++) runBehavior(app, control, prop); return app.snapshot(); }
  const g = parentGallery(app, control);
  if (g) return (app.ctlValue(g, 'AllItems') || []).map(it => app.evalProp(control, prop, { thisItem: it }));
  return app.evalProp(control, prop);
}
function describe(u, r, isBehavior) {
  if (isBehavior) {
    const parts = { data: 'データソース', collections: 'コレクション', globals: 'グローバル変数（Set）', ctxVars: 'コンテキスト変数（UpdateContext）', screen: '表示中の画面', notes: '通知（Notify）' };
    for (const [k, label] of Object.entries(parts)) if (!deepEq(u[k], r[k])) {
      if (k === 'screen') return `${label}が違います（あなた: ${u.screen} / 期待: ${r.screen}）`;
      if (k === 'notes') return `${label}が違います（あなた: ${u.notes.join(' / ') || 'なし'} / 期待: ${r.notes.join(' / ') || 'なし'}）`;
      for (const name of new Set([...Object.keys(u[k] || {}), ...Object.keys(r[k] || {})])) if (!deepEq(u[k]?.[name], r[k]?.[name])) {
        return `${label}「${name}」が違います（あなた: ${short(u[k]?.[name])} / 期待: ${short(r[k]?.[name])}）`;
      }
      return `${label}が違います`;
    }
    return '結果が違います';
  }
  if (isTable(u) && isTable(r)) {
    if (u.length !== r.length) return `行数が違います（あなた: ${u.length} 行 / 期待: ${r.length} 行）`;
    for (let i = 0; i < r.length; i++) if (!deepEq(u[i], r[i])) return `${i + 1} 行目が違います（あなた: ${short(u[i])} / 期待: ${short(r[i])}）`;
  }
  return `結果が違います（あなた: ${short(u)} / 期待: ${short(r)}）`;
}
const short = v => { const s = show(v); return s.length > 70 ? s.slice(0, 70) + '…' : s; };
export function grade(ex, src) {
  const tests = ex.tests?.length ? ex.tests : [{ name: '初期状態', inputs: {} }];
  const { control, prop } = ex.target;
  for (const t of tests) {
    const u = makeApp(ex), r = makeApp(ex);
    u.setFormula(control, prop, src); r.setFormula(control, prop, ex.solution);
    let gu, gr;
    const prep = app => { for (const b of t.before || []) { setInputs(app, b.inputs); runBehavior(app, b.press, 'OnSelect'); } setInputs(app, t.inputs); };
    try { prep(u); gu = evalTarget(u, ex); }
    catch (e) { if (e instanceof FxErr) return { ok: false, msg: e.message, isError: true, test: t.name }; throw e; }
    prep(r); gr = evalTarget(r, ex);
    if (/^On/.test(prop) && !gr.notes.length) { gu = { ...gu, notes: [] }; }   // 期待に通知がなければ、通知の有無は問わない
    if (!deepEq(gu, gr)) return { ok: false, msg: describe(gu, gr, /^On/.test(prop)), test: t.name };
  }
  if (ex.noDelegation) {
    const w = delegationWarnings(src, APPS[ex.app].delegable);
    if (w.length) return { ok: false, msg: '結果は合っていますが、委任の警告が残っています: ' + w[0] };
  }
  return { ok: true, n: tests.length };
}
