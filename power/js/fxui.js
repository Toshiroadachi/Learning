// Power Apps Studio の再現画面（プレビュー・ツリー ビュー・数式バー）
import { App, parse as fxParse, show, toStr, isTable, isRec, FxErr, FxDate, delegationWarnings, walkCtls } from './fx.js';
import { APPS } from '../data/apps-screens.js';
import { makeApp, runBehavior, parentGallery, FX_TODAY, grade as gradeFx } from './fxgrade.js';
import { createEditor } from './editor.js';
import { esc, toast } from './util.js';

const PROPS = {
  Label: ['Text', 'Color', 'Fill', 'Visible', 'Size', 'FontWeight'],
  TextInput: ['Default', 'HintText', 'Visible', 'DisplayMode'],
  Dropdown: ['Items', 'Visible', 'DisplayMode'],
  Toggle: ['Default', 'Text', 'Visible'],
  Gallery: ['Items', 'OnSelect', 'Visible'],
  Button: ['Text', 'OnSelect', 'Visible', 'DisplayMode', 'Fill'],
};
const firstVal = r => isRec(r) ? Object.entries(r).filter(([k]) => !k.startsWith('__'))[0]?.[1] : r;

function miniTable(rows, max = 6) {
  if (!rows.length) return '（0 行）';
  const cols = Object.keys(rows[0]).filter(k => !k.startsWith('__'));
  return `<table class="cmp"><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${rows.slice(0, max).map(r => `<tr>${cols.map(c => `<td>${esc(isTable(r[c]) ? `テーブル(${r[c].length})` : show(r[c]))}</td>`).join('')}</tr>`).join('')}</table>${rows.length > max ? `<div class="tiny muted">…ほか ${rows.length - max} 行（全 ${rows.length} 行）</div>` : ''}`;
}
export function valueHTML(v) {
  if (isTable(v)) return `テーブル（${v.length} 行）\n` + miniTable(v);
  return esc(show(v));
}

// 共通の Studio 部品
function studio(root, { app, ex, editable, initial, onFormula, title }) {
  let curCtl = ex?.target.control || app.def.screens[0].controls.find(c => c.type !== 'Label')?.name || app.def.screens[0].controls[0].name;
  let curProp = ex?.target.prop || 'Text';
  if (ex?.screen) app.screen = ex.screen;
  else if (ex) { const s = app.ctlIndex[curCtl]?.screen; if (s) app.screen = s; }
  let lastNoteCount = 0;
  root.innerHTML = `<div class="studio">
    <div class="studio-head"><span>⚡</span><b>${esc(title || app.def.title)}</b><select class="scr">${app.def.screens.map(s => `<option>${esc(s.name)}</option>`).join('')}</select></div>
    <div class="phone"></div>
    <div class="tree"></div>
    <div class="propbar"><select class="pc"></select><select class="pp"></select><span class="fxi">fx</span></div>
    <div class="fx-ed" style="padding:0 6px 6px"></div>
    <div style="padding:0 8px 8px"><div class="fx-err"></div><div class="fx-deleg"></div><div class="evalres"></div>
      <div class="btn-row" style="margin-top:6px"><button class="btn sm" data-a="vars">{x} 変数・データ</button><button class="btn sm" data-a="reset">↺ プレビューをリセット</button></div></div></div>`;
  const $ = s => root.querySelector(s);
  const phone = $('.phone');
  const ed = createEditor($('.fx-ed'), { lang: 'fx', value: '', minHeight: '70px', words: [], title: `${curCtl}.${curProp}` });

  const ctlsOf = scr => app.def.screens.find(s => s.name === scr).controls;
  const allNames = () => Object.keys(app.ctlIndex);
  const words = () => [...allNames(), ...Object.keys(app.data), ...Object.keys(app.collections), ...Object.keys(app.globals), ...app.def.screens.map(s => s.name),
    ...Object.keys(Object.values(app.data)[0]?.[0] || {}).filter(k => !k.startsWith('__')), ...Object.values(app.data).flatMap(rows => Object.keys(rows[0] || {})).filter((v, i, a) => a.indexOf(v) === i)];

  const P = (name, prop, extra) => { try { return { v: app.evalProp(name, prop, extra) }; } catch (e) { if (e instanceof FxErr) return { err: e.message }; throw e; } };
  function ctlHTML(c, extra = {}) {
    const vis = P(c.name, 'Visible', extra); if (vis.v === false) return `<div class="ctl tiny muted" style="opacity:.4">（${esc(c.name)} は非表示）</div>`;
    const focus = c.name === curCtl ? ' focus' : '';
    const tag = `<span class="cname">${esc(c.name)}</span>`;
    const errBox = e => `<div class="ctlerr">⚠ ${esc(c.name)}: ${esc(e)}</div>`;
    switch (c.type) {
      case 'Label': {
        const t = P(c.name, 'Text', extra); if (t.err) return `<div class="ctl${focus}">${tag}${errBox(t.err)}</div>`;
        const col = P(c.name, 'Color', extra).v, fill = P(c.name, 'Fill', extra).v, size = P(c.name, 'Size', extra).v, fw = P(c.name, 'FontWeight', extra).v;
        let txt; try { txt = toStr(t.v); } catch (e) { return `<div class="ctl${focus}">${tag}${errBox(e.message)}</div>`; }
        return `<div class="ctl${focus}" data-ctl="${esc(c.name)}" style="${col ? `color:${esc(col)};` : ''}${fill ? `background:${esc(fill)};` : ''}${size ? `font-size:${Math.min(28, +size || 13) * 1.05}px;` : ''}${fw === 'Bold' ? 'font-weight:700;' : ''}">${tag}${esc(txt) || '&nbsp;'}</div>`;
      }
      case 'TextInput': {
        const v = app.ctlValue(c.name, 'Text'); const ph = P(c.name, 'HintText').v; const dm = P(c.name, 'DisplayMode').v;
        return `<div class="ctl${focus}">${tag}<input type="text" data-in="${esc(c.name)}" value="${esc(v)}" placeholder="${esc(ph || '')}" ${dm === 'Disabled' || dm === 'View' ? 'disabled' : ''}></div>`;
      }
      case 'Dropdown': {
        const it = P(c.name, 'Items'); if (it.err) return `<div class="ctl${focus}">${tag}${errBox(it.err)}</div>`;
        const items = isTable(it.v) ? it.v : [];
        const sel = app.state[c.name]?.sel ?? 0;
        return `<div class="ctl${focus}">${tag}<select data-dd="${esc(c.name)}">${items.map((r, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(show(firstVal(r)))}</option>`).join('')}</select></div>`;
      }
      case 'Toggle': {
        const v = app.ctlValue(c.name, 'Value'); const t = P(c.name, 'Text').v;
        return `<div class="ctl${focus}">${tag}<label class="tg"><input type="checkbox" data-tg="${esc(c.name)}" ${v ? 'checked' : ''}> ${esc(toStrSafe(t))}</label></div>`;
      }
      case 'Button': {
        const t = P(c.name, 'Text'); const dm = P(c.name, 'DisplayMode').v; const fill = P(c.name, 'Fill').v;
        return `<div class="ctl${focus}">${tag}<button class="pbtn" data-btn="${esc(c.name)}" ${dm === 'Disabled' ? 'disabled' : ''} style="${fill && dm !== 'Disabled' ? `background:${esc(fill)}` : ''}">${esc(toStrSafe(t.v))}</button>${t.err ? errBox(t.err) : ''}</div>`;
      }
      case 'Gallery': {
        const it = P(c.name, 'Items'); if (it.err) return `<div class="ctl${focus}">${tag}${errBox(it.err)}</div>`;
        const items = isTable(it.v) ? it.v : it.v == null ? [] : null;
        if (!items) return `<div class="ctl${focus}">${tag}${errBox('Items にはテーブルを指定します（' + show(it.v) + '）')}</div>`;
        const sel = app.state[c.name]?.sel ?? 0;
        return `<div class="ctl${focus}">${tag}<div class="gal">${items.length ? items.map((r, i) => `<div class="item ${i === sel ? 'on' : ''}" data-gal="${esc(c.name)}" data-i="${i}">${c.template.map(t => ctlHTML(t, { thisItem: r })).join('')}</div>`).join('') : '<div class="item tiny" style="color:#888">（表示する項目がありません）</div>'}</div></div>`;
      }
    }
    return '';
  }
  const toStrSafe = v => { try { return toStr(v); } catch { return show(v); } };
  function drawPhone() {
    const focusName = document.activeElement?.dataset?.in; const caret = document.activeElement?.selectionStart;
    const note = app.notes.length > lastNoteCount ? app.notes[app.notes.length - 1] : null;
    phone.innerHTML = (note ? `<div class="toast2 ${esc(note.type)}">${esc(note.msg)}</div>` : '') + ctlsOf(app.screen).map(c => ctlHTML(c)).join('');
    lastNoteCount = app.notes.length;
    $('.scr').value = app.screen;
    if (focusName) { const el = phone.querySelector(`[data-in="${CSS.escape(focusName)}"]`); if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch {} } }
  }
  function drawTree() {
    const out = [];
    for (const c of ctlsOf(app.screen)) {
      out.push(`<button class="chip ${c.name === curCtl ? 'on' : ''}" data-c="${esc(c.name)}">${esc(c.name)}</button>`);
      for (const t of c.template || []) out.push(`<button class="chip tpl ${t.name === curCtl ? 'on' : ''}" data-c="${esc(t.name)}">└ ${esc(t.name)}</button>`);
    }
    $('.tree').innerHTML = `<span class="tiny muted" style="align-self:center">ツリー:</span>` + out.join('');
    const all = [...walkCtls(ctlsOf(app.screen))];
    $('.pc').innerHTML = all.map(c => `<option ${c.name === curCtl ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    const c = app.ctlIndex[curCtl];
    const props = PROPS[c.type] || ['Text'];
    if (!props.includes(curProp)) curProp = props[0];
    $('.pp').innerHTML = props.map(p => `<option ${p === curProp ? 'selected' : ''}>${p}${ex && ex.target.control === curCtl && ex.target.prop === p ? ' ✏' : ''}</option>`).join('');
  }
  function loadFormula() {
    const src = app.propSrc(curCtl, curProp) ?? '';
    ed.value = String(src);
    ed.setWords(words());
    const can = editable(curCtl, curProp);
    root.querySelector('.fx-ed textarea').readOnly = !can;
    root.querySelector('.fx-ed .editor-head span').textContent = `${curCtl}.${curProp}${can ? '' : '（この演習では編集しません）'}`;
  }
  function drawEval() {
    const src = app.propSrc(curCtl, curProp) ?? '';
    const box = $('.evalres');
    if (/^On/.test(curProp)) { box.innerHTML = '動作の式です。プレビューで実行すると、データ・変数・画面が変わります。'; }
    else {
      const g = parentGallery(app, curCtl);
      let r;
      if (g) { const sel = app.ctlValue(g, 'Selected'); r = P(curCtl, curProp, { thisItem: sel }); box.innerHTML = `<span class="tiny muted">${esc(g)} の選択中の行での値：</span>\n` + (r.err ? `<span class="ngc">⚠ ${esc(r.err)}</span>` : valueHTML(r.v)); }
      else { r = P(curCtl, curProp); box.innerHTML = r.err ? `<span class="ngc">⚠ ${esc(r.err)}</span>` : valueHTML(r.v); }
    }
    const w = delegationWarnings(String(src), app.def.delegable);
    $('.fx-deleg').innerHTML = w.map(x => `<div class="deleg">${esc(x)}</div>`).join('');
  }
  function drawAll() { drawPhone(); drawTree(); drawEval(); }

  // 数式の入力（自動で反映）
  let tmr = null;
  ed.setWords(words());
  root.querySelector('.fx-ed textarea').addEventListener('input', () => {
    clearTimeout(tmr);
    tmr = setTimeout(() => {
      if (!editable(curCtl, curProp)) return;
      const src = ed.value;
      try { fxParse(src); $('.fx-err').innerHTML = ''; }
      catch (e) { $('.fx-err').innerHTML = `<div class="result ng">構文エラー: ${esc(e.message)}</div>`; return; }
      app.setFormula(curCtl, curProp, src);
      onFormula && onFormula(curCtl, curProp, src);
      drawPhone(); drawEval();
    }, 350);
  });
  $('.tree').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; curCtl = b.dataset.c; drawTree(); loadFormula(); drawPhone(); drawEval(); };
  $('.pc').onchange = e => { curCtl = e.target.value; drawTree(); loadFormula(); drawPhone(); drawEval(); };
  $('.pp').onchange = e => { curProp = e.target.value.replace(' ✏', ''); loadFormula(); drawEval(); };
  $('.scr').onchange = e => { app.screen = e.target.value; const first = ctlsOf(app.screen)[0]; curCtl = first.name; drawTree(); loadFormula(); drawPhone(); drawEval(); };
  // プレビューの操作
  phone.addEventListener('input', e => {
    const n = e.target.dataset.in; if (!n) return;
    (app.state[n] ||= {}).Text = e.target.value; drawPhone(); drawEval();
  });
  phone.addEventListener('change', e => {
    const d = e.target.dataset.dd, t = e.target.dataset.tg;
    if (d) { (app.state[d] ||= {}).sel = +e.target.value; drawPhone(); drawEval(); }
    if (t) { (app.state[t] ||= {}).Value = e.target.checked; drawPhone(); drawEval(); }
  });
  phone.addEventListener('click', e => {
    const b = e.target.closest('[data-btn]');
    if (b && !b.disabled) {
      try { runBehavior(app, b.dataset.btn, 'OnSelect'); } catch (er) { if (er instanceof FxErr) app.notes.push({ msg: 'エラー: ' + er.message, type: 'Error' }); else throw er; }
      drawAll(); return;
    }
    const it = e.target.closest('[data-gal]');
    if (it) {
      const g = it.dataset.gal; (app.state[g] ||= {}).sel = +it.dataset.i;
      try { runBehavior(app, g, 'OnSelect'); } catch (er) { if (er instanceof FxErr) app.notes.push({ msg: 'エラー: ' + er.message, type: 'Error' }); else throw er; }
      drawAll();
    }
  });
  root.querySelector('[data-a="vars"]').onclick = () => varSheet(app);
  root.querySelector('[data-a="reset"]').onclick = () => {
    const keep = { ...app.formulas }; const scr = ex?.screen || app.def.screens[0].name;
    app.reset(); app.formulas = keep; app.astCache = new Map(); app.screen = scr; lastNoteCount = 0; drawAll(); toast('プレビューを初期状態に戻しました');
  };
  drawTree(); loadFormula(); drawPhone(); drawEval();
  return { app, ed, redraw: drawAll, select(ctl, prop) { curCtl = ctl; curProp = prop; const s = app.ctlIndex[ctl]?.screen; if (s) app.screen = s; drawTree(); loadFormula(); drawAll(); } };
}

function varSheet(app) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  const sec = (title, obj) => Object.keys(obj).length ? `<h3>${title}</h3>${Object.entries(obj).map(([k, v]) => `<div class="small"><b>${esc(k)}</b>${isTable(v) ? miniTable(v, 12) : `: ${esc(show(v))}`}</div>`).join('')}` : '';
  const ctx = Object.entries(app.ctxVars).map(([s, v]) => sec(`コンテキスト変数（${s}）`, v)).join('');
  bg.innerHTML = `<div class="modal varview"><h2>変数・データ</h2>${sec('グローバル変数', app.globals)}${ctx}${sec('コレクション', app.collections)}${sec('データソース', app.data)}
    <div class="btn-row"><button class="btn" data-close>閉じる</button></div></div>`;
  document.body.appendChild(bg);
  bg.onclick = e => { if (e.target === bg || e.target.dataset.close != null) bg.remove(); };
}

// ---------- 演習画面 ----------
export function renderFx(root, ex, { saved, onChange } = {}) {
  const app = makeApp(ex);
  const { control, prop } = ex.target;
  const start = saved ?? ex.starter ?? '';
  app.setFormula(control, prop, start);
  const s = studio(root, { app, ex, editable: (c, p) => c === control && p === prop, onFormula: (c, p, src) => onChange && onChange(src) });
  return {
    code: () => app.propSrc(control, prop) ?? '',
    grade() { const src = s.ed.value; app.setFormula(control, prop, src); return gradeFx(ex, src); },
    reset() { app.setFormula(control, prop, ex.starter ?? ''); s.select(control, prop); onChange && onChange(ex.starter ?? ''); },
    setCode(v) { app.setFormula(control, prop, v); s.select(control, prop); onChange && onChange(v); },
  };
}

// ---------- Power Apps 練習場 ----------
export function renderFxPlay(root, state, save) {
  state.app ||= 'expense';
  state.formulas ||= {};
  root.innerHTML = `<div class="chips" style="margin-bottom:8px">${Object.entries(APPS).map(([k, a]) => `<button class="chip ${k === state.app ? 'on' : ''}" data-app="${k}">${esc(a.title)}</button>`).join('')}<button class="chip" data-clear>数式を初期化</button></div><div class="st"></div>`;
  const app = new App(APPS[state.app], FX_TODAY);
  for (const [k, v] of Object.entries(state.formulas[state.app] || {})) { const [c, p] = k.split('.'); app.setFormula(c, p, v); }
  studio(root.querySelector('.st'), { app, editable: () => true, onFormula: (c, p, src) => { (state.formulas[state.app] ||= {})[`${c}.${p}`] = src; save(); } });
  root.querySelectorAll('[data-app]').forEach(b => b.onclick = () => { state.app = b.dataset.app; save(); renderFxPlay(root, state, save); });
  root.querySelector('[data-clear]').onclick = () => { if (confirm('このアプリで書いた数式をすべて初期状態に戻しますか？')) { state.formulas[state.app] = {}; save(); renderFxPlay(root, state, save); } };
}
