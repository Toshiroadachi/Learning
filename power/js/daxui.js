// Power BI Desktop の再現画面（レポート＝マトリックス、テーブル ビュー、モデル ビュー）
import { matrix, displayVal, labelOf, DaxErr, parse as daxParse } from './dax.js';
import { baseModel, engineFor, grade as gradeDax, visualSpec } from './daxgrade.js';
import { createEditor } from './editor.js';
import { esc, toast } from './util.js';

export const FIELDS = ['商品|カテゴリ', '商品|商品名', '顧客|地域', '顧客|区分', '顧客|顧客名', 'カレンダー|年', 'カレンダー|年月', 'カレンダー|四半期', 'カレンダー|会計年度', '売上|担当者'];
const fieldLabel = f => f ? f.replace('|', '[') + ']' : '（なし）';

export function daxWords() {
  const m = baseModel(); const w = [];
  for (const [t, tb] of Object.entries(m.tables)) { w.push(t); for (const c of tb.cols) w.push(`${t}[${c}]`); }
  return w;
}

// マトリックスの HTML
export function matrixHTML(res, { fmt = {}, mine, compare } = {}) {
  const ms = res.measures;
  const cv = res.colVals;
  const head = cv
    ? `<tr><th></th>${cv.map(c => `<th colspan="${ms.length}">${esc(labelOf(c))}</th>`).join('')}<th colspan="${ms.length}">合計</th></tr>${ms.length > 1 ? `<tr><th></th>${[...cv, 0].map(() => ms.map(m => `<th>${esc(m)}</th>`).join('')).join('')}</tr>` : ''}`
    : `<tr><th></th>${ms.map(m => `<th>${esc(m)}</th>`).join('')}</tr>`;
  const cell = (v, m, ref) => {
    const err = v && v.error;
    const bad = compare && m === mine && ref !== undefined && !sameish(v, ref);
    return `<td class="${m === mine ? 'mine' : ''} ${bad ? 'bad' : ''} ${err ? 'errc' : ''}" ${err ? `title="${esc(v.error)}"` : ''}>${esc(displayVal(v, fmt[m]))}${bad ? `<div class="tiny">期待 ${esc(displayVal(ref, fmt[m]) || '空白')}</div>` : ''}</td>`;
  };
  const refRow = lb => compare?.rows.find(r => labelOf(r.label) === lb);
  const body = res.rows.map((r, ri) => {
    const rr = refRow(labelOf(r.label));
    return `<tr><td>${esc(labelOf(r.label))}</td>${r.cells.map((cs, ci) => cs.map((v, mi) => cell(v, ms[mi], rr ? rr.cells[ci][mi] : (compare ? null : undefined))).join('')).join('')}${res.rowTotals ? res.rowTotals[ri].map((v, mi) => cell(v, ms[mi], compare?.rowTotals?.[compare.rows.indexOf(rr)]?.[mi])).join('') : ''}</tr>`;
  }).join('');
  const extra = compare ? compare.rows.filter(r => !res.rows.some(x => labelOf(x.label) === labelOf(r.label))).map(r => `<tr><td>${esc(labelOf(r.label))}</td>${r.cells.map((cs) => cs.map((v, mi) => `<td class="${ms[mi] === mine ? 'bad' : ''}">${ms[mi] === mine ? `<div class="tiny">期待 ${esc(displayVal(v, fmt[ms[mi]]))}</div>` : ''}</td>`).join('')).join('')}</tr>`).join('') : '';
  const tot = `<tr class="total"><td>合計</td>${res.total.map((cs, ci) => cs.map((v, mi) => cell(v, ms[mi], compare ? compare.total[ci][mi] : undefined)).join('')).join('')}${res.colTotal ? res.colTotal.map((v, mi) => cell(v, ms[mi], compare?.colTotal?.[mi])).join('') : ''}</tr>`;
  const errs = [...res.rows.flatMap(r => r.cells.flat()), ...res.total.flat()].filter(v => v && v.error);
  return `<div style="overflow-x:auto"><table class="matrix">${head}${body}${extra}${tot}</table></div>${errs.length ? `<div class="result ng">⚠ ${esc(errs[0].error)}</div>` : ''}`;
}
const sameish = (a, b) => { if (a && a.error) return false; if (a == null || b == null) return a == null && b == null; if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)); return displayVal(a) === displayVal(b); };

export function tableHTML(engine, t, { highlight, limit = 60 } = {}) {
  const tb = engine.m.tables[t];
  return `<div class="grid-wrap"><table class="grid"><tr><th class="rn"></th>${tb.cols.map(c => `<th class="${c === highlight ? 'calc-new' : ''}">${esc(c)}</th>`).join('')}</tr>${tb.rows.slice(0, limit).map((r, i) => `<tr><td class="rn">${i + 1}</td>${tb.cols.map(c => { const v = r[c]; return `<td class="${typeof v === 'number' ? 'num' : ''} ${c === highlight ? 'calc-new' : ''}">${esc(displayVal(v))}</td>`; }).join('')}</tr>`).join('')}</table></div><div class="pq-qual">${tb.rows.length} 行${tb.rows.length > limit ? `（先頭 ${limit} 行を表示）` : ''}</div>`;
}
export function modelHTML() {
  const m = baseModel();
  const keys = new Set(m.rels.flatMap(r => [`${r.from}|${r.fromCol}`, `${r.to}|${r.toCol}`]));
  const box = (t, fact) => `<div class="mtable ${fact ? 'fact' : ''}"><div class="mh">${esc(t)}<span>${fact ? 'ファクト' : 'ディメンション'}・${m.tables[t].rows.length}行</span></div>${m.tables[t].cols.map(c => `<div class="mc ${keys.has(`${t}|${c}`) ? 'key' : ''}">${esc(c)}</div>`).join('')}</div>`;
  return `<div class="model">${box('売上', true)}${box('商品')}${box('顧客')}${box('カレンダー')}</div>
    <div class="rel-note">${m.rels.map(r => `<div>🔗 ${esc(r.to)}[${esc(r.toCol)}] <b>1</b> ── <b>*</b> ${esc(r.from)}[${esc(r.fromCol)}]（単方向：${esc(r.to)} → ${esc(r.from)} にフィルターが流れる）</div>`).join('')}
    <div>📅 カレンダー は日付テーブルとしてマーク済み（2025/1/1〜2026/6/30）</div></div>`;
}

// ---------- 演習画面 ----------
export function renderDAX(root, ex, { saved, onChange, onEditor } = {}) {
  let tab = ex.kind === 'column' ? 'table' : 'report';
  let committed = saved ?? null;
  let lastGrade = null;
  const given = ex.given || {};
  root.innerHTML = `<div class="pbi">
    <div class="pbi-head"><b>Power BI</b><span>Desktop（再現）</span></div>
    <div class="pbi-tabs"><button data-t="report">📊 レポート</button><button data-t="table">▦ テーブル</button><button data-t="model">🔗 モデル</button></div>
    <div class="pbi-body"></div></div>
    ${Object.keys(given).length ? `<div class="small muted">既にあるメジャー：</div><div class="measure-list">${Object.entries(given).map(([k, v]) => `<span class="chip" title="${esc(v)}">[${esc(k)}] = ${esc(v.length > 40 ? v.slice(0, 40) + '…' : v)}</span>`).join('')}</div>` : ''}
    <div class="small" style="margin:8px 0 4px"><b>${ex.kind === 'column' ? `${esc(ex.table)} テーブルの新しい列` : '新しいメジャー'}：</b><code>${esc(ex.name)} =</code></div>
    <div class="dax-ed"></div>`;
  const body = root.querySelector('.pbi-body');
  const words = [...daxWords(), ...Object.keys(given).map(k => `[${k}]`)];
  const ed = createEditor(root.querySelector('.dax-ed'), { lang: 'dax', value: saved ?? ex.starter ?? '', minHeight: '90px', words, title: `${ex.name} =`, onChange: v => onChange && onChange(v) });
  onEditor && onEditor(ed);
  function draw() {
    root.querySelectorAll('.pbi-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    if (tab === 'model') { body.innerHTML = modelHTML(); return; }
    if (tab === 'table') {
      const t = ex.kind === 'column' ? ex.table : '売上';
      let eng = engineFor(ex), hl = null, err = '';
      if (ex.kind === 'column' && committed != null) { try { eng.addCalcColumn(ex.table, ex.name, committed); hl = ex.name; } catch (e) { if (!(e instanceof DaxErr)) throw e; err = e.message; } }
      body.innerHTML = `<div class="chips">${Object.keys(baseModel().tables).map(x => `<button class="chip ${x === t ? 'on' : ''}" data-tb="${x}">${x}</button>`).join('')}</div>${err ? `<div class="result ng">⚠ ${esc(err)}</div>` : ''}<div class="tview">${tableHTML(eng, t, { highlight: hl })}</div>`;
      body.querySelectorAll('[data-tb]').forEach(b => b.onclick = () => { body.querySelectorAll('[data-tb]').forEach(x => x.classList.toggle('on', x === b)); body.querySelector('.tview').innerHTML = tableHTML(eng, b.dataset.tb, { highlight: b.dataset.tb === ex.table ? hl : null }); });
      return;
    }
    // レポート
    if (ex.kind === 'column') {
      body.innerHTML = `<p class="small muted">計算列は「テーブル」タブで確認します。${committed != null ? '' : '式を入力して「列を追加」を押してください。'}</p>`;
      return;
    }
    const spec = visualSpec(ex, committed != null ? [ex.name] : []);
    const v = ex.visual;
    let html = `<div class="vis-title">マトリックス　行: ${esc(fieldLabel(v.rows))}${v.cols ? `　列: ${esc(fieldLabel(v.cols))}` : ''}</div>`;
    if (!spec.measures.length) { body.innerHTML = html + '<p class="small muted">式を入力して「メジャーを確定」を押すと、ここに結果が表示されます。</p>'; return; }
    try {
      const eng = engineFor(ex);
      if (committed != null) eng.setMeasure(ex.name, committed);
      const res = matrix(eng, spec);
      html += matrixHTML(res, { fmt: { [ex.name]: ex.fmt }, mine: ex.name, compare: lastGrade && !lastGrade.ok && lastGrade.mr ? lastGrade.mr : null });
    } catch (e) { if (!(e instanceof DaxErr)) throw e; html += `<div class="result ng">⚠ ${esc(e.message)}</div>`; }
    body.innerHTML = html;
  }
  root.querySelector('.pbi-tabs').onclick = e => { const b = e.target.closest('button'); if (b) { tab = b.dataset.t; draw(); } };
  draw();
  return {
    code: () => ed.value,
    commit() {
      try { daxParse(ed.value); } catch (e) { if (e instanceof DaxErr) { toast('構文エラー: ' + e.message, 3500); return { ok: false, msg: e.message, isError: true }; } throw e; }
      committed = ed.value; lastGrade = null; tab = ex.kind === 'column' ? 'table' : 'report'; draw(); return { ok: true };
    },
    grade() {
      committed = ed.value;
      lastGrade = gradeDax(ex, ed.value);
      tab = ex.kind === 'column' ? 'table' : 'report'; draw();
      return lastGrade;
    },
    reset() { ed.value = ex.starter ?? ''; committed = null; lastGrade = null; draw(); },
    setCode(v) { ed.value = v; },
  };
}

// ---------- DAX 練習場（自由にメジャーを作ってマトリックスで確認） ----------
export function renderDaxPlay(root, state, save) {
  state.measures ||= { 売上金額: 'SUM(売上[金額])' };
  state.rows ||= '商品|カテゴリ'; state.cols ??= ''; state.show ||= Object.keys(state.measures);
  state.slicer ||= {};
  const draw = () => {
    root.innerHTML = `<div class="pbi"><div class="pbi-head"><b>Power BI</b><span>DAX 練習場</span></div>
      <div class="pbi-tabs"><button class="on" data-t="report">📊 レポート</button><button data-t="table">▦ テーブル</button><button data-t="model">🔗 モデル</button></div>
      <div class="pbi-body">
        <div class="slicers"><label class="small">行 <select data-f="rows">${FIELDS.map(f => `<option value="${f}" ${state.rows === f ? 'selected' : ''}>${fieldLabel(f)}</option>`).join('')}</select></label>
        <label class="small">列 <select data-f="cols"><option value="">（なし）</option>${FIELDS.map(f => `<option value="${f}" ${state.cols === f ? 'selected' : ''}>${fieldLabel(f)}</option>`).join('')}</select></label></div>
        <div class="slicers"><span class="small muted">スライサー</span>
          <select data-s="カレンダー|年"><option value="">年: すべて</option>${[2025, 2026].map(y => `<option ${state.slicer['カレンダー|年'] == y ? 'selected' : ''}>${y}</option>`).join('')}</select>
          <select data-s="商品|カテゴリ"><option value="">カテゴリ: すべて</option>${['ドリンク', '菓子', '文具', '雑貨'].map(y => `<option ${state.slicer['商品|カテゴリ'] === y ? 'selected' : ''}>${y}</option>`).join('')}</select>
          <select data-s="顧客|地域"><option value="">地域: すべて</option>${['東京', '大阪', '名古屋', '札幌', '福岡'].map(y => `<option ${state.slicer['顧客|地域'] === y ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
        <div class="mx"></div></div></div>
      <div class="card"><h2>メジャー</h2><div class="mlist"></div>
        <div class="form" style="margin-top:8px"><label>メジャー名<input data-name placeholder="例: 粗利率"></label></div>
        <div class="play-ed" style="margin-top:6px"></div>
        <div class="btn-row"><button class="btn primary" data-add>追加 / 更新</button><span class="small muted">同じ名前なら上書き</span></div></div>`;
    const mx = root.querySelector('.mx');
    const run = () => {
      try {
        const eng = engineFor({});
        const errs = [];
        for (const [k, v] of Object.entries(state.measures)) { try { eng.setMeasure(k, v); } catch (e) { errs.push(`[${k}] ${e.message}`); } }
        const show = state.show.filter(k => eng.measures[k]);
        if (!show.length) { mx.innerHTML = '<p class="small muted">表示するメジャーにチェックを入れてください。</p>'; return; }
        const slicers = Object.entries(state.slicer).filter(([, v]) => v !== '' && v != null).map(([col, v]) => ({ col, values: [col === 'カレンダー|年' ? +v : v] }));
        const res = matrix(eng, { rows: state.rows, cols: state.cols || undefined, measures: show, slicers });
        mx.innerHTML = (errs.length ? `<div class="result ng">${errs.map(esc).join('<br>')}</div>` : '') + matrixHTML(res);
      } catch (e) { if (!(e instanceof DaxErr)) throw e; mx.innerHTML = `<div class="result ng">⚠ ${esc(e.message)}</div>`; }
    };
    const list = root.querySelector('.mlist');
    list.innerHTML = Object.entries(state.measures).map(([k, v]) => `<div class="ref-item"><label class="row"><input type="checkbox" data-show="${esc(k)}" ${state.show.includes(k) ? 'checked' : ''}> <span class="k">${esc(k)} =</span></label><div class="ex">${esc(v)}</div><div class="btn-row" style="margin-top:4px"><button class="btn sm" data-edit="${esc(k)}">編集</button><button class="btn sm" data-del="${esc(k)}" style="color:var(--ng)">削除</button></div></div>`).join('');
    const ed = createEditor(root.querySelector('.play-ed'), { lang: 'dax', value: '', minHeight: '80px', words: [...daxWords(), ...Object.keys(state.measures).map(k => `[${k}]`)], title: '式' });
    root.querySelector('[data-add]').onclick = () => {
      const name = root.querySelector('[data-name]').value.trim(); const src = ed.value.trim();
      if (!name || !src) { toast('メジャー名と式を入力してください'); return; }
      try { daxParse(src); } catch (e) { toast('構文エラー: ' + e.message, 3500); return; }
      state.measures[name] = src; if (!state.show.includes(name)) state.show.push(name); save(); draw();
    };
    list.onclick = e => {
      const s = e.target.closest('[data-show]'); if (s) { const k = s.dataset.show; state.show = s.checked ? [...state.show, k] : state.show.filter(x => x !== k); save(); run(); return; }
      const ee = e.target.closest('[data-edit]'); if (ee) { root.querySelector('[data-name]').value = ee.dataset.edit; ed.value = state.measures[ee.dataset.edit]; ed.focus(); return; }
      const d = e.target.closest('[data-del]'); if (d) { delete state.measures[d.dataset.del]; state.show = state.show.filter(x => x !== d.dataset.del); save(); draw(); }
    };
    root.querySelectorAll('[data-f]').forEach(s => s.onchange = () => { state[s.dataset.f] = s.value; save(); run(); });
    root.querySelectorAll('[data-s]').forEach(s => s.onchange = () => { state.slicer[s.dataset.s] = s.value; save(); run(); });
    root.querySelector('.pbi-tabs').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      root.querySelectorAll('.pbi-tabs button').forEach(x => x.classList.toggle('on', x === b));
      const pb = root.querySelector('.pbi-body');
      if (b.dataset.t === 'report') { draw(); return; }
      if (b.dataset.t === 'model') { pb.innerHTML = modelHTML(); return; }
      const eng = engineFor({});
      pb.innerHTML = `<div class="chips">${Object.keys(baseModel().tables).map(x => `<button class="chip ${x === '売上' ? 'on' : ''}" data-tb="${x}">${x}</button>`).join('')}</div><div class="tview">${tableHTML(eng, '売上')}</div>`;
      pb.querySelectorAll('[data-tb]').forEach(x => x.onclick = () => { pb.querySelectorAll('[data-tb]').forEach(y => y.classList.toggle('on', y === x)); pb.querySelector('.tview').innerHTML = tableHTML(eng, x.dataset.tb); });
    };
    run();
  };
  draw();
}
