// DAX 演習の実行と採点（画面とテストで共用）
import { Engine, matrix, cloneModel, sameVal, displayVal, labelOf, DaxErr } from './dax.js';
import { getModel } from '../data/model.js';

let BASE_MODEL = null;
export const baseModel = () => (BASE_MODEL ||= getModel());

export function engineFor(ex) {
  const e = new Engine(cloneModel(baseModel()));
  for (const [k, v] of Object.entries(ex.given || {})) e.setMeasure(k, v);
  return e;
}
export function visualSpec(ex, extra = []) {
  const v = ex.visual || {};
  return { rows: v.rows, cols: v.cols || undefined, slicers: v.slicers, measures: [...Object.keys(ex.given || {}).filter(m => (v.show || []).includes(m)), ...extra] };
}
// メジャーの演習：あなたの式と模範解答でマトリックスを計算し、セルごとに比べる
export function gradeMeasure(ex, src) {
  const name = ex.name;
  const user = engineFor(ex);
  user.setMeasure(name, src);          // 構文エラーはここで throw
  const ref = engineFor(ex);
  ref.setMeasure(name, ex.solution);
  const spec = visualSpec(ex, [name]);
  const mu = matrix(user, spec), mr = matrix(ref, spec);
  const mi = spec.measures.indexOf(name);
  const errCell = [...mu.rows.flatMap(r => r.cells.flat()), ...mu.total.flat()].find(v => v && v.error);
  if (errCell) return { ok: false, mu, mr, msg: errCell.error, isError: true };
  // 行ラベルをそろえて比較
  const label = v => labelOf(v);
  const vlabel = v => displayVal(v, ex.fmt);
  const allLabels = [...new Set([...mu.rows.map(r => label(r.label)), ...mr.rows.map(r => label(r.label))])];
  for (const lb of allLabels) {
    const a = mu.rows.find(r => label(r.label) === lb), b = mr.rows.find(r => label(r.label) === lb);
    const ca = a ? a.cells.map(c => c[mi]) : (mu.colVals || [0]).map(() => null);
    const cb = b ? b.cells.map(c => c[mi]) : (mr.colVals || [0]).map(() => null);
    for (let k = 0; k < cb.length; k++) if (!sameVal(ca[k], cb[k])) return { ok: false, mu, mr, msg: `「${lb}」${mu.colVals ? `×「${label(mu.colVals[k])}」` : ''} の値が違います（あなた: ${vlabel(ca[k]) || '空白'} / 期待: ${vlabel(cb[k]) || '空白'}）` };
  }
  for (let k = 0; k < mr.total.length; k++) if (!sameVal(mu.total[k][mi], mr.total[k][mi])) return { ok: false, mu, mr, msg: `合計行の値が違います（あなた: ${vlabel(mu.total[k][mi]) || '空白'} / 期待: ${vlabel(mr.total[k][mi]) || '空白'}）` };
  if (mr.colTotal && !sameVal(mu.colTotal[mi], mr.colTotal[mi])) return { ok: false, mu, mr, msg: '総計の値が違います' };
  return { ok: true, mu, mr };
}
// 計算列の演習：全行の値を比べる
export function gradeColumn(ex, src) {
  const user = engineFor(ex), ref = engineFor(ex);
  const got = user.addCalcColumn(ex.table, ex.name, src);
  const want = ref.addCalcColumn(ex.table, ex.name, ex.solution);
  const tb = ref.m.tables[ex.table];
  for (let i = 0; i < want.length; i++) if (!sameVal(got[i], want[i])) {
    const key = tb.cols[0];
    return { ok: false, got, want, engine: user, msg: `${tb.rows[i][key] instanceof Object ? i + 1 + ' 行目' : `${key}=${displayVal(tb.rows[i][key])} の行`} の値が違います（あなた: ${displayVal(got[i]) || '空白'} / 期待: ${displayVal(want[i]) || '空白'}）` };
  }
  return { ok: true, got, want, engine: user };
}
export function grade(ex, src) {
  try { return ex.kind === 'column' ? gradeColumn(ex, src) : gradeMeasure(ex, src); }
  catch (e) { if (e instanceof DaxErr) return { ok: false, msg: e.message, isError: true }; throw e; }
}
