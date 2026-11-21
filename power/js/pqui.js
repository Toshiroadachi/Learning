// パワークエリ エディターの再現画面
// 操作（列見出しのメニュー・リボン）から Excel 日本語版と同じ名前のステップと M の式を生成する
import * as M from './mlang.js';
import { PQ_SOURCES, PQ_FILES, sourceStep, helperQuery } from '../data/pq-sources.js';
import { createEditor } from './editor.js';
import { esc, toast } from './util.js';

const TYPE_ICON = { text: 'ABC', int: '123', number: '1.2', currency: '$', percent: '%', date: '📅', logical: '✓✗', table: '⊞', any: 'ABC123' };
const TYPE_M = { text: 'type text', int: 'Int64.Type', number: 'type number', currency: 'Currency.Type', date: 'type date', logical: 'type logical' };
const TYPE_LABEL = { text: 'テキスト', int: '整数', number: '10進数', currency: '通貨', date: '日付', logical: 'True/False' };
const S = M.mstr;
const Q = M.quoteName;

let SOURCES = null;
export const pqSources = () => (SOURCES ||= Object.fromEntries(Object.entries(PQ_SOURCES).map(([k, d]) => [k, M.toTable(d)])));
export function helperTables(names) {
  const out = {};
  for (const h of names || []) out[h] = M.run(helperQuery(h), pqSources(), PQ_FILES);
  return out;
}
export function startSteps(ex) { return [{ name: 'ソース', src: sourceStep(ex.file || ex.query) }]; }
export function runQuery(code, ex) { return M.run(code, pqSources(), PQ_FILES, helperTables(ex.helpers)); }
// 採点
export function gradePQ(ex, code) {
  let got;
  try { got = runQuery(code, ex); } catch (e) { if (e instanceof M.MErr) return { ok: false, msg: e.message, isError: true }; throw e; }
  const want = runQuery(ex.solution, ex);
  if (!(got instanceof M.MTable)) return { ok: false, msg: `クエリの結果がテーブルではありません（${M.typeName(got)}）` };
  let d = M.tableDiff(got, want, { loose: ex.loose !== false });
  if (!d && ex.checkTypes) d = M.typeDiff(got, want);
  if (d) return { ok: false, msg: d, got, want };
  const errs = got.rows.flat().filter(v => v instanceof M.MError).length;
  return { ok: true, got, want, note: errs ? `（Error のセルが ${errs} 個あります）` : '' };
}

// ---------- 表の描画 ----------
export function gridHTML(t, { selCols = new Set(), maxRows = 200, clickable = true } = {}) {
  if (!(t instanceof M.MTable)) {
    const d = M.display(t);
    return `<div class="pad small" style="padding:10px">結果: <b>${esc(d.s)}</b>（${esc(M.typeName(t))}）</div>`;
  }
  const head = `<tr><th class="rn"></th>${t.cols.map((c, i) => `<th data-ci="${i}" class="${selCols.has(c) ? 'sel' : ''}"><span class="ty">${TYPE_ICON[t.types[c] || 'any']}</span>${esc(c)} ${clickable ? '▾' : ''}</th>`).join('')}</tr>`;
  const body = t.rows.slice(0, maxRows).map((r, ri) => `<tr><td class="rn">${ri + 1}</td>${r.map((v, ci) => {
    const d = M.display(v); const sel = selCols.has(t.cols[ci]) ? ' sel' : '';
    return `<td class="${d.t}${sel}" data-r="${ri}" data-c="${ci}" ${d.title ? `title="${esc(d.title)}"` : ''}>${esc(d.s)}</td>`;
  }).join('')}</tr>`).join('');
  return `<div class="grid-wrap"><table class="grid">${head}${body}</table></div>${t.rows.length > maxRows ? `<div class="pq-qual">先頭 ${maxRows} 行を表示（全 ${t.rows.length} 行）</div>` : ''}`;
}

// ---------- モーダル ----------
function sheet(html, onMount) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal sheet">${html}</div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  bg.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
  onMount && onMount(bg.querySelector('.modal'), close);
  return close;
}
const btnRow = (ok = 'OK') => `<div class="btn-row"><button class="btn primary" data-ok>${ok}</button><button class="btn" data-close>キャンセル</button></div>`;

// 値をリテラルに
function lit(v, type) {
  if (v === 'null') return 'null';
  if (['int', 'number', 'currency', 'percent'].includes(type) && v.trim() !== '' && !isNaN(+v)) return String(+v);
  if (type === 'date') { const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(v.trim()); if (m) return `#date(${+m[1]}, ${+m[2]}, ${+m[3]})`; }
  if (type === 'any' && v.trim() !== '' && !isNaN(+v) && typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return String(+v);
  return S(v);
}
const litOfValue = v => v == null ? 'null' : typeof v === 'number' ? String(v) : v instanceof M.MDate ? (() => { const d = new Date(v.ms); return `#date(${d.getUTCFullYear()}, ${d.getUTCMonth() + 1}, ${d.getUTCDate()})`; })() : typeof v === 'boolean' ? String(v) : S(String(v));

// ---------- 本体 ----------
export function renderPQ(root, ex, { saved, onChange, onGrade } = {}) {
  let steps = saved?.steps ? saved.steps.map(s => ({ ...s })) : startSteps(ex);
  let active = steps.length - 1;
  let selCols = new Set();
  let tab = 'home';
  let viewQuery = ex.file || ex.query;     // 表示中のクエリ
  let lastResult = null, lastError = null;
  const qnames = [ex.file || ex.query, ...(ex.helpers || [])];
  const mode = ex.mode === 'code';

  root.innerHTML = `<div class="pqx">
      <div class="pqx-title"><span>📊 Power Query エディター</span><b></b>
        <select class="qsel">${qnames.map(q => `<option value="${esc(q)}">${esc(q)}${q === qnames[0] ? '（編集）' : '（参照）'}</option>`).join('')}</select></div>
      <div class="ribbon-tabs">${[['home', 'ホーム'], ['transform', '変換'], ['add', '列の追加'], ['view', '表示']].map(([k, l]) => `<button data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="ribbon"></div>
      <div class="colsel-bar hide"></div>
      <div class="fxbar"><span class="fxl">fx</span><div class="fxv"></div><button class="fxedit">編集</button></div>
      <div class="errbar hide" style="background:#fff4ce;color:#5c4400;padding:6px 10px;font-size:.8rem"></div>
      <div class="gridbox"></div>
      <div class="steps"><h4>適用したステップ</h4><div class="steplist"></div></div>
    </div>`;
  const $ = s => root.querySelector(s);

  const fullCode = (upto = steps.length - 1) => M.joinSteps(steps.slice(0, upto + 1));
  const prevName = () => Q(steps[active].name);
  const current = () => lastResult instanceof M.MTable ? lastResult : null;
  const colType = c => current()?.types[c] || 'any';
  const uniq = base => { const names = new Set(steps.map(s => s.name)); if (!names.has(base)) return base; let k = 1; while (names.has(base + k)) k++; return base + k; };
  const save = () => onChange && onChange({ steps, code: fullCode() });

  function addStep(base, src) {
    const name = uniq(base);
    if (active < steps.length - 1) {
      // 途中に挿入：次のステップの参照をつなぎ替える
      const oldRef = Q(steps[active].name);
      steps.splice(active + 1, 0, { name, src });
      const nx = steps[active + 2];
      if (nx) nx.src = nx.src.replace(oldRef, Q(name));
    } else steps.push({ name, src });
    active = steps.indexOf(steps.find(s => s.name === name));
    selCols = new Set([...selCols].filter(c => true));
    refresh(); save();
  }
  function deleteStep(i) {
    if (i === 0) { toast('ソースのステップは削除できません'); return; }
    const ref = Q(steps[i].name), prev = Q(steps[i - 1].name);
    steps.splice(i, 1);
    for (let k = i; k < steps.length; k++) steps[k].src = steps[k].src.split(ref).join(prev);
    active = Math.min(active, steps.length - 1);
    if (active >= i) active = Math.max(i - 1, Math.min(active, steps.length - 1));
    refresh(); save();
  }

  // ---------- リボン ----------
  const needCols = (n = 1) => { if (selCols.size < n) { toast(n === 1 ? '先に列見出しをタップして列を選んでください' : `列を ${n} つ以上選んでください`); return false; } return true; };
  const colsList = () => current() ? current().cols.filter(c => selCols.has(c)) : [...selCols];
  const RIBBON = {
    home: [
      ['🗑', '列の削除', () => needCols() && addStep('削除された列', `Table.RemoveColumns(${prevName()},{${colsList().map(S).join(', ')}})`)],
      ['☑', '他の列の削除', () => needCols() && addStep('削除された他の列', `Table.SelectColumns(${prevName()},{${colsList().map(S).join(', ')}})`)],
      ['⤒', '上位の行の保持', () => askNumber('上位の行の保持', '保持する行数', 3, n => addStep('保持された最初の行', `Table.FirstN(${prevName()},${n})`))],
      ['⤓', '上位の行の削除', () => askNumber('上位の行の削除', '削除する行数', 1, n => addStep('削除された上位の行', `Table.Skip(${prevName()},${n})`))],
      ['≡', '重複の削除', () => addStep('削除された重複', selCols.size && selCols.size < (current()?.cols.length || 0) ? `Table.Distinct(${prevName()}, {${colsList().map(S).join(', ')}})` : `Table.Distinct(${prevName()})`)],
      ['⚠', 'エラーの削除', () => addStep('削除されたエラー', selCols.size ? `Table.RemoveRowsWithErrors(${prevName()}, {${colsList().map(S).join(', ')}})` : `Table.RemoveRowsWithErrors(${prevName()})`)],
      ['⇅', '1行目をヘッダーに', () => addStep('昇格されたヘッダー数', `Table.PromoteHeaders(${prevName()}, [PromoteAllScalars=true])`)],
      ['Σ', 'グループ化', () => groupDialog()],
      ['⇄', 'クエリのマージ', () => mergeDialog()],
      ['⊕', 'クエリの追加', () => appendDialog()],
      ['🔁', '値の置換', () => needCols() && replaceDialog()],
      ['✂', '列の分割', () => needCols() && splitDialog()],
      ['📝', '詳細エディター', () => advancedEditor()],
    ],
    transform: [
      ['🔤', 'データ型', () => needCols() && typeDialog()],
      ['🔁', '値の置換', () => needCols() && replaceDialog()],
      ['⚠', 'エラーの置換', () => needCols() && askText('エラーの置換', '置き換える値', '0', v => addStep('置き換えられたエラー', `Table.ReplaceErrorValues(${prevName()}, {${colsList().map(c => `{${S(c)}, ${lit(v, colType(c) === 'any' ? 'int' : colType(c))}}`).join(', ')}})`))],
      ['⬇', 'フィル（下へ）', () => needCols() && addStep('下方向へコピー済み', `Table.FillDown(${prevName()},{${colsList().map(S).join(', ')}})`)],
      ['⬆', 'フィル（上へ）', () => needCols() && addStep('上方向へコピー済み', `Table.FillUp(${prevName()},{${colsList().map(S).join(', ')}})`)],
      ['↻', 'その他の列のピボット解除', () => needCols() && addStep('ピボット解除された他の列', `Table.UnpivotOtherColumns(${prevName()}, {${colsList().map(S).join(', ')}}, "属性", "値")`)],
      ['↺', '選択列のピボット解除', () => needCols() && addStep('ピボット解除された列', `Table.Unpivot(${prevName()}, {${colsList().map(S).join(', ')}}, "属性", "値")`)],
      ['⊞', 'ピボット列', () => needCols() && pivotDialog()],
      ['✂', '列の分割', () => needCols() && splitDialog()],
      ['Aa', '書式', () => needCols() && formatMenu()],
      ['⧉', '抽出', () => needCols() && extractMenu(false)],
      ['⤡', '入れ替え', () => addStep('転置されたテーブル', `Table.Transpose(${prevName()})`)],
    ],
    add: [
      ['ƒx', 'カスタム列', () => customDialog()],
      ['❓', '条件列', () => conditionalDialog()],
      ['#', 'インデックス列', () => addStep('追加されたインデックス', `Table.AddIndexColumn(${prevName()}, "インデックス", 1, 1, Int64.Type)`)],
      ['⧉', '列の重複', () => needCols() && addStep('複製された列', `Table.DuplicateColumn(${prevName()}, ${S(colsList()[0])}, ${S(colsList()[0] + ' - コピー')})`)],
      ['📅', '日付', () => needCols() && dateMenu()],
      ['✂', '抽出', () => needCols() && extractMenu(true)],
    ],
    view: [
      ['📝', '詳細エディター', () => advancedEditor()],
      ['🔍', 'M の全体を表示', () => sheet(`<h3>現在のクエリ（M）</h3><pre class="code"><code>${esc(fullCode())}</code></pre><div class="btn-row"><button class="btn" data-close>閉じる</button></div>`)],
      ['🔗', 'クエリの依存関係', () => sheet(`<h3>クエリの依存関係</h3><p class="small">${qnames.map(q => q === qnames[0] ? `<b>${esc(q)}</b>（編集中）` : esc(q)).join(' ← ')}</p><p class="small muted">${ex.helpers?.length ? '補助クエリ（接続専用）を参照してマージ／追加しています。' : 'このクエリはソースを1つだけ使っています。'}</p><div class="btn-row"><button class="btn" data-close>閉じる</button></div>`)],
    ],
  };
  function drawRibbon() {
    root.querySelectorAll('.ribbon-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const ro = viewQuery !== qnames[0];
    $('.ribbon').innerHTML = RIBBON[tab].map(([icon, label], i) => `<button data-i="${i}" ${ro && label !== 'M の全体を表示' ? 'disabled' : ''}><i>${icon}</i>${label}</button>`).join('');
  }
  root.querySelector('.ribbon-tabs').onclick = e => { const b = e.target.closest('button'); if (b) { tab = b.dataset.tab; drawRibbon(); } };
  $('.ribbon').onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) return; if (!current() && !['詳細エディター', 'M の全体を表示', 'クエリの依存関係'].includes(RIBBON[tab][+b.dataset.i][1])) { toast('エラーを先に直してください（ステップを選び直すか削除）'); return; } RIBBON[tab][+b.dataset.i][2](); };

  // ---------- ダイアログ ----------
  function askNumber(title, label, def, cb) {
    sheet(`<h3>${title}</h3><div class="form"><label>${label}<input type="number" min="1" value="${def}" data-v></label></div>${btnRow()}`, (m, close) => {
      m.querySelector('[data-ok]').onclick = () => { const v = parseInt(m.querySelector('[data-v]').value); if (!(v > 0)) return; close(); cb(v); };
    });
  }
  function askText(title, label, def, cb) {
    sheet(`<h3>${title}</h3><div class="form"><label>${label}<input value="${esc(def)}" data-v></label></div>${btnRow()}`, (m, close) => {
      m.querySelector('[data-ok]').onclick = () => { close(); cb(m.querySelector('[data-v]').value); };
    });
  }
  function typeDialog(cols = colsList()) {
    sheet(`<h3>型の変更（${esc(cols.join('、'))}）</h3><div class="opts">${Object.entries(TYPE_LABEL).map(([k, l]) => `<button class="menu-btn" data-t="${k}"><b style="font-family:monospace">${TYPE_ICON[k]}</b>　${l}</button>`).join('')}</div><div class="btn-row"><button class="btn" data-close>キャンセル</button></div>`, (m, close) => {
      m.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { close(); addStep('変更された型', `Table.TransformColumnTypes(${prevName()},{${cols.map(c => `{${S(c)}, ${TYPE_M[b.dataset.t]}}`).join(', ')}})`); });
    });
  }
  function renameDialog(c) {
    askText('名前の変更', `「${c}」の新しい名前`, c, v => { if (v && v !== c) addStep('名前が変更された列', `Table.RenameColumns(${prevName()},{{${S(c)}, ${S(v)}}})`); });
  }
  function sortStep(c, desc) {
    const ord = desc ? 'Order.Descending' : 'Order.Ascending';
    const last = steps[steps.length - 1];
    if (active === steps.length - 1 && /^Table\.Sort\(/.test(last.src) && !last.src.includes(`{${S(c)},`)) {
      last.src = last.src.replace(/\}\}\)\s*$/, `}, {${S(c)}, ${ord}}})`);
      refresh(); save(); toast('並べ替えの第2キーとして追加しました'); return;
    }
    addStep('並べ替えられた行', `Table.Sort(${prevName()},{{${S(c)}, ${ord}}})`);
  }
  function filterDialog(c) {
    const t = current(); const ci = t.cols.indexOf(c); const ty = colType(c);
    const vals = []; for (const r of t.rows) { const v = r[ci]; if (!vals.some(x => M.equal(x, v))) vals.push(v); if (vals.length > 200) break; }
    const ops = ty === 'date' ? [['=', '指定の値に等しい'], ['<>', '指定の値に等しくない'], ['>=', '以降'], ['>', 'より後'], ['<=', '以前'], ['<', 'より前']]
      : ['int', 'number', 'currency', 'percent'].includes(ty) ? [['=', '指定の値に等しい'], ['<>', '指定の値に等しくない'], ['>', 'より大きい'], ['>=', '以上'], ['<', 'より小さい'], ['<=', '以下']]
      : [['=', '指定の値に等しい'], ['<>', '指定の値に等しくない'], ['starts', '指定の値で始まる'], ['contains', '指定の値を含む'], ['notcontains', '指定の値を含まない'], ['>', 'より大きい'], ['>=', '以上'], ['<', 'より小さい'], ['<=', '以下']];
    const opSel = id => `<select data-op="${id}">${ops.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>`;
    sheet(`<h3>行のフィルター：${esc(c)}</h3>
      <div class="chips"><button class="chip on" data-m="list">値の一覧</button><button class="chip" data-m="cond">${ty === 'date' ? '日付' : ['int', 'number'].includes(ty) ? '数値' : 'テキスト'}フィルター</button></div>
      <div data-p="list"><div class="small muted">残す値にチェック</div><div class="vals">${vals.map((v, i) => `<label><input type="checkbox" checked data-vi="${i}"> ${esc(M.display(v).s)}</label>`).join('')}</div>
        <div class="btn-row" style="margin-top:6px"><button class="btn sm" data-all>すべて選択</button><button class="btn sm" data-none>選択解除</button></div></div>
      <div data-p="cond" class="hide form">
        <label>条件1 ${opSel(1)}<input data-v="1" placeholder="${ty === 'date' ? '2026/5/1' : '値'}"></label>
        <div class="row"><label><input type="radio" name="ao" value="and" checked> かつ</label><label><input type="radio" name="ao" value="or"> または</label></div>
        <label>条件2（任意）${opSel(2)}<input data-v="2" placeholder="空なら使わない"></label>
        ${['int', 'number'].includes(ty) || ty === 'date' || ty === 'text' ? '' : '<p class="tiny muted">列の型が「任意」のときは、先に型を変更すると数値・日付で比較できます。</p>'}
      </div>${btnRow()}`, (m, close) => {
      let md = 'list';
      m.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { md = b.dataset.m; m.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === b)); m.querySelector('[data-p="list"]').classList.toggle('hide', md !== 'list'); m.querySelector('[data-p="cond"]').classList.toggle('hide', md !== 'cond'); });
      m.querySelector('[data-all]').onclick = () => m.querySelectorAll('[data-vi]').forEach(x => { x.checked = true; });
      m.querySelector('[data-none]').onclick = () => m.querySelectorAll('[data-vi]').forEach(x => { x.checked = false; });
      m.querySelector('[data-ok]').onclick = () => {
        const ref = `[${c}]`;
        let cond;
        if (md === 'list') {
          const keep = [...m.querySelectorAll('[data-vi]')].filter(x => x.checked).map(x => vals[+x.dataset.vi]);
          const drop = vals.filter(v => !keep.includes(v));
          if (!keep.length) { toast('1つ以上選んでください'); return; }
          if (!drop.length) { close(); return; }
          cond = keep.length <= drop.length ? `(${keep.map(v => `${ref} = ${litOfValue(v)}`).join(' or ')})` : `(${drop.map(v => `${ref} <> ${litOfValue(v)}`).join(' and ')})`;
        } else {
          const part = k => {
            const op = m.querySelector(`[data-op="${k}"]`).value, v = m.querySelector(`[data-v="${k}"]`).value;
            if (v === '') return null;
            const L = lit(v, ty === 'any' && /^-?\d+(\.\d+)?$/.test(v) ? 'int' : ty);
            if (op === 'starts') return `Text.StartsWith(${ref}, ${S(v)})`;
            if (op === 'contains') return `Text.Contains(${ref}, ${S(v)})`;
            if (op === 'notcontains') return `not Text.Contains(${ref}, ${S(v)})`;
            return `${ref} ${op} ${L}`;
          };
          const a = part(1), b = part(2);
          if (!a) { toast('条件1の値を入力してください'); return; }
          cond = b ? `${a} ${m.querySelector('[name=ao]:checked').value} ${b}` : a;
        }
        close();
        addStep('フィルターされた行', `Table.SelectRows(${prevName()}, each ${cond})`);
      };
    });
  }
  function replaceDialog(cols = colsList()) {
    sheet(`<h3>値の置換（${esc(cols.join('、'))}）</h3><div class="form">
      <label>検索する値<input data-a placeholder="空のセルは null と入力"></label>
      <label>置換後<input data-b></label>
      <label class="row" style="flex-direction:row"><input type="checkbox" data-whole> セルの内容全体を一致させる</label></div>${btnRow()}`, (m, close) => {
      m.querySelector('[data-ok]').onclick = () => {
        const a = m.querySelector('[data-a]').value, b = m.querySelector('[data-b]').value;
        const whole = m.querySelector('[data-whole]').checked || a === 'null' || cols.some(c => ['int', 'number', 'date'].includes(colType(c)));
        const ty = colType(cols[0]);
        close();
        addStep('置き換えられた値', `Table.ReplaceValue(${prevName()},${lit(a, ty)},${lit(b, ty)},${whole ? 'Replacer.ReplaceValue' : 'Replacer.ReplaceText'},{${cols.map(S).join(', ')}})`);
      };
    });
  }
  function splitDialog(c = colsList()[0]) {
    sheet(`<h3>区切り記号による列の分割：${esc(c)}</h3><div class="form">
      <label>区切り記号<select data-d><option value=" ">スペース</option><option value=",">コンマ</option><option value=":">コロン</option><option value=";">セミコロン</option><option value="-">ハイフン</option><option value="/">スラッシュ</option><option value="__custom">カスタム</option></select></label>
      <label class="hide" data-cw>カスタム<input data-custom></label>
      <label>分割<select data-at><option value="each">区切り記号の出現ごと</option><option value="left">一番左の区切り記号</option><option value="right">一番右の区切り記号</option></select></label>
      <label>分割の方向（詳細設定）<select data-dir><option value="cols">列</option><option value="rows">行</option></select></label></div>${btnRow()}`, (m, close) => {
      m.querySelector('[data-d]').onchange = e => m.querySelector('[data-cw]').classList.toggle('hide', e.target.value !== '__custom');
      m.querySelector('[data-ok]').onclick = () => {
        let d = m.querySelector('[data-d]').value; if (d === '__custom') d = m.querySelector('[data-custom]').value;
        if (!d) return;
        const at = m.querySelector('[data-at]').value, dir = m.querySelector('[data-dir]').value;
        close();
        if (dir === 'rows') {
          addStep('区切り記号による列の分割', `Table.ExpandListColumn(Table.TransformColumns(${prevName()}, {{${S(c)}, Splitter.SplitTextByDelimiter(${S(d)}, QuoteStyle.Csv), let itemType = (type nullable text) meta [Serialized.Text = true] in type {itemType}}}), ${S(c)})`);
          return;
        }
        let n = 2, splitter;
        if (at === 'each') {
          const t = current(); const ci = t.cols.indexOf(c);
          n = Math.max(2, ...t.rows.map(r => typeof r[ci] === 'string' ? r[ci].split(d).length : 1));
          splitter = `Splitter.SplitTextByDelimiter(${S(d)}, QuoteStyle.Csv)`;
        } else splitter = `Splitter.SplitTextByEachDelimiter({${S(d)}}, QuoteStyle.Csv, ${at === 'right'})`;
        addStep('区切り記号による列の分割', `Table.SplitColumn(${prevName()}, ${S(c)}, ${splitter}, {${Array.from({ length: n }, (_, k) => S(`${c}.${k + 1}`)).join(', ')}})`);
      };
    });
  }
  function formatMenu(cols = colsList()) {
    const F = [['Text.Lower', '小文字', '小文字のテキスト'], ['Text.Upper', '大文字', '大文字のテキスト'], ['Text.Proper', '各単語の先頭文字を大文字にする', '各単語の先頭文字を大文字にしたテキスト'], ['Text.Trim', 'トリム', 'トリミングされたテキスト'], ['Text.Clean', 'クリーン', 'クリーンアップされたテキスト']];
    sheet(`<h3>書式（${esc(cols.join('、'))}）</h3><div class="opts">${F.map(([f, l], i) => `<button class="menu-btn" data-i="${i}">${l}</button>`).join('')}</div><div class="btn-row"><button class="btn" data-close>キャンセル</button></div>`, (m, close) => {
      m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const [f, , nm] = F[+b.dataset.i]; close(); addStep(nm, `Table.TransformColumns(${prevName()},{${cols.map(c => `{${S(c)}, ${f}, type text}`).join(', ')}})`); });
    });
  }
  function extractMenu(asNew, c = colsList()[0]) {
    const items = [['len', '長さ'], ['first', '最初の文字…'], ['last', '最後の文字…'], ['before', '区切り記号の前のテキスト…'], ['after', '区切り記号の後のテキスト…']];
    sheet(`<h3>抽出（${esc(c)}）${asNew ? '→ 新しい列' : '→ この列を変換'}</h3><div class="opts">${items.map(([k, l]) => `<button class="menu-btn" data-k="${k}">${l}</button>`).join('')}</div><div class="btn-row"><button class="btn" data-close>キャンセル</button></div>`, (m, close) => {
      m.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
        close(); const k = b.dataset.k;
        const mk = (expr, ty, nm, colName) => asNew
          ? addStep(nm.replace('抽出された', '挿入された'), `Table.AddColumn(${prevName()}, ${S(colName)}, each ${expr.replace(/_/g, `[${c}]`)}, ${ty})`)
          : addStep(nm, `Table.TransformColumns(${prevName()}, {{${S(c)}, each ${expr}, ${ty}}})`);
        if (k === 'len') mk('Text.Length(_)', 'Int64.Type', '抽出されたテキストの長さ', '長さ');
        else if (k === 'first' || k === 'last') askNumber('文字の抽出', '文字数', 3, n => mk(`Text.${k === 'first' ? 'Start' : 'End'}(_, ${n})`, 'type text', k === 'first' ? '抽出された最初の文字' : '抽出された最後の文字', k === 'first' ? '最初の文字' : '最後の文字'));
        else askText(k === 'before' ? '区切り記号の前のテキスト' : '区切り記号の後のテキスト', '区切り記号', '-', d => mk(`Text.${k === 'before' ? 'BeforeDelimiter' : 'AfterDelimiter'}(_, ${S(d)})`, 'type text', k === 'before' ? '抽出された区切り記号の前のテキスト' : '抽出された区切り記号の後のテキスト', k === 'before' ? '区切り記号の前のテキスト' : '区切り記号の後のテキスト'));
      });
    });
  }
  function dateMenu(c = colsList()[0]) {
    if (colType(c) !== 'date') { toast('日付型の列を選んでください（先に型を「日付」に）'); return; }
    const items = [['Date.Year', '年', '挿入された年', 'Int64.Type'], ['Date.Month', '月', '挿入された月', 'Int64.Type'], ['Date.Day', '日', '挿入された日', 'Int64.Type'], ['Date.QuarterOfYear', '四半期', '挿入された四半期', 'Int64.Type'], ['Date.MonthName', '月の名前', '挿入された月の名前', 'type text'], ['Date.DayOfWeekName', '曜日名', '挿入された曜日名', 'type text'], ['Date.StartOfMonth', '月の初日', '挿入された月の初日', 'type date'], ['Date.EndOfMonth', '月の末日', '挿入された月の末日', 'type date']];
    sheet(`<h3>日付（${esc(c)}）→ 新しい列</h3><div class="opts">${items.map(([f, l], i) => `<button class="menu-btn" data-i="${i}">${l}</button>`).join('')}</div><div class="btn-row"><button class="btn" data-close>キャンセル</button></div>`, (m, close) => {
      m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const [f, l, nm, ty] = items[+b.dataset.i]; close(); addStep(nm, `Table.AddColumn(${prevName()}, ${S(l)}, each ${f}([${c}]), ${ty})`); });
    });
  }
  function colOptions(sel) { return (current()?.cols || []).map(c => `<option ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join(''); }
  function groupDialog() {
    const keys = colsList();
    const aggRow = (i) => `<div class="two" data-agg="${i}" style="margin-top:6px"><label>新しい列名<input data-n value="${i ? '件数' : '合計'}"></label><label>操作<select data-o><option value="sum">合計</option><option value="avg">平均</option><option value="max">最大</option><option value="min">最小</option><option value="count" ${i ? 'selected' : ''}>行数のカウント</option><option value="dcount">個別の行数のカウント</option></select></label><label style="grid-column:1/-1">列<select data-c>${colOptions()}</select></label></div>`;
    sheet(`<h3>グループ化</h3><div class="form"><label>グループ化する列（Ctrl のように複数可）<select data-keys multiple size="4">${(current()?.cols || []).map(c => `<option ${keys.includes(c) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label></div>
      <div data-aggs>${aggRow(0)}</div><button class="btn sm" data-add style="margin-top:6px">＋ 集計の追加</button>${btnRow()}`, (m, close) => {
      let n = 1;
      m.querySelector('[data-add]').onclick = () => { m.querySelector('[data-aggs]').insertAdjacentHTML('beforeend', aggRow(n++)); };
      m.querySelector('[data-ok]').onclick = () => {
        const ks = [...m.querySelector('[data-keys]').selectedOptions].map(o => o.value);
        if (!ks.length) { toast('グループ化する列を選んでください'); return; }
        const aggs = [...m.querySelectorAll('[data-agg]')].map(r => {
          const nm = r.querySelector('[data-n]').value, o = r.querySelector('[data-o]').value, c = r.querySelector('[data-c]').value;
          const expr = { sum: `each List.Sum([${c}]), type number`, avg: `each List.Average([${c}]), type number`, max: `each List.Max([${c}]), type number`, min: `each List.Min([${c}]), type number`, count: 'each Table.RowCount(_), Int64.Type', dcount: `each Table.RowCount(Table.Distinct(_)), Int64.Type` }[o];
          return `{${S(nm)}, ${expr}}`;
        });
        close();
        addStep('グループ化された行', `Table.Group(${prevName()}, {${ks.map(S).join(', ')}}, {${aggs.join(', ')}})`);
      };
    });
  }
  function pivotDialog(c = colsList()[0]) {
    sheet(`<h3>ピボット列：${esc(c)}</h3><p class="small muted">「${esc(c)}」の値が新しい列見出しになります。</p><div class="form"><label>値列<select data-v>${colOptions()}</select></label>
      <label>値の集計関数（詳細設定）<select data-a><option value="List.Sum">合計</option><option value="List.Count">カウント</option><option value="List.Average">平均</option><option value="List.Max">最大</option><option value="List.Min">最小</option><option value="">集計しない</option></select></label></div>${btnRow()}`, (m, close) => {
      m.querySelector('[data-ok]').onclick = () => {
        const v = m.querySelector('[data-v]').value, a = m.querySelector('[data-a]').value;
        if (v === c) { toast('値列には別の列を選んでください'); return; }
        close();
        addStep('ピボットされた列', `Table.Pivot(${prevName()}, List.Distinct(${prevName()}[${c}]), ${S(c)}, ${S(v)}${a ? ', ' + a : ''})`);
      };
    });
  }
  function mergeDialog() {
    const helpers = ex.helpers || [];
    if (!helpers.length) { toast('この演習ではマージできるクエリがありません'); return; }
    const ht = helperTables(helpers);
    sheet(`<h3>マージ</h3><div class="form">
      <label>マージするテーブル<select data-q>${helpers.map(h => `<option>${esc(h)}</option>`).join('')}</select></label>
      <div class="two"><label>${esc(qnames[0])} のキー<select data-k1>${colOptions(colsList()[0])}</select></label><label>相手のキー<select data-k2></select></label></div>
      <label>結合の種類<select data-j><option value="LeftOuter">左外部（最初の行すべて、一致する2番目の行）</option><option value="Inner">内部（一致する行のみ）</option><option value="LeftAnti">左反（最初の行のみ）</option><option value="RightOuter">右外部</option><option value="FullOuter">完全外部</option><option value="RightAnti">右反</option></select></label></div>${btnRow()}`, (m, close) => {
      const fillK2 = () => { const t = ht[m.querySelector('[data-q]').value]; const k1 = m.querySelector('[data-k1]').value; m.querySelector('[data-k2]').innerHTML = t.cols.map(c => `<option ${c === k1 ? 'selected' : ''}>${esc(c)}</option>`).join(''); };
      m.querySelector('[data-q]').onchange = fillK2; m.querySelector('[data-k1]').onchange = fillK2; fillK2();
      m.querySelector('[data-ok]').onclick = () => {
        const q = m.querySelector('[data-q]').value, k1 = m.querySelector('[data-k1]').value, k2 = m.querySelector('[data-k2]').value, j = m.querySelector('[data-j]').value;
        close();
        addStep('マージされたクエリ数', `Table.NestedJoin(${prevName()}, {${S(k1)}}, ${Q(q)}, {${S(k2)}}, ${S(q)}, JoinKind.${j})`);
      };
    });
  }
  function expandDialog(c) {
    const t = current(); const ci = t.cols.indexOf(c);
    const sub = t.rows.map(r => r[ci]).find(v => v instanceof M.MTable);
    const cols = sub ? sub.cols : (ex.helpers || []).map(h => helperTables([h])[h]).find(x => x)?.cols || [];
    sheet(`<h3>展開：${esc(c)}</h3><div class="vals">${cols.map(x => `<label><input type="checkbox" checked data-c="${esc(x)}"> ${esc(x)}</label>`).join('')}</div>
      <label class="row small" style="margin-top:8px"><input type="checkbox" data-prefix checked> 元の列名をプレフィックスとして使用します</label>${btnRow()}`, (m, close) => {
      m.querySelector('[data-ok]').onclick = () => {
        const sel = [...m.querySelectorAll('[data-c]')].filter(x => x.checked).map(x => x.dataset.c);
        if (!sel.length) return;
        const pre = m.querySelector('[data-prefix]').checked;
        close();
        addStep(`展開された ${c}`, `Table.ExpandTableColumn(${prevName()}, ${S(c)}, {${sel.map(S).join(', ')}}, {${sel.map(x => S(pre ? `${c}.${x}` : x)).join(', ')}})`);
      };
    });
  }
  function appendDialog() {
    const helpers = ex.helpers || [];
    if (!helpers.length) { toast('この演習では追加できるクエリがありません'); return; }
    sheet(`<h3>追加</h3><div class="form"><label>追加するテーブル<select data-q>${helpers.map(h => `<option>${esc(h)}</option>`).join('')}</select></label></div>${btnRow()}`, (m, close) => {
      m.querySelector('[data-ok]').onclick = () => { const q = m.querySelector('[data-q]').value; close(); addStep('追加されたクエリ', `Table.Combine({${prevName()}, ${Q(q)}})`); };
    });
  }
  function customDialog() {
    const cols = current()?.cols || [];
    sheet(`<h3>カスタム列</h3><div class="form"><label>新しい列名<input data-n value="カスタム"></label></div>
      <div class="small muted" style="margin:6px 0 2px">カスタム列の式（= の後ろ。each は自動で付きます）</div><div data-ed></div>
      <div class="small muted" style="margin-top:6px">使用できる列（タップで挿入）</div><div class="chips">${cols.map(c => `<button class="chip" data-col="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="result ng hide" data-err></div>${btnRow()}`, (m, close) => {
      const ed = createEditor(m.querySelector('[data-ed]'), { lang: 'm', value: '', minHeight: '70px', words: cols.map(c => `[${c}]`), title: 'カスタム列の式' });
      m.querySelectorAll('[data-col]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { ed.value = ed.value + `[${b.dataset.col}]`; ed.focus(); }; });
      m.querySelector('[data-ok]').onclick = () => {
        const nm = m.querySelector('[data-n]').value.trim(); const f = ed.value.trim();
        if (!nm || !f) return;
        try { M.parse(f); } catch (e) { const el = m.querySelector('[data-err]'); el.textContent = '式の構文エラー: ' + e.message; el.classList.remove('hide'); return; }
        close();
        addStep('追加されたカスタム', `Table.AddColumn(${prevName()}, ${S(nm)}, each ${f})`);
      };
    });
  }
  function conditionalDialog() {
    const ops = [['=', '指定の値に等しい'], ['<>', '指定の値に等しくない'], ['>', 'より大きい'], ['>=', '以上'], ['<', 'より小さい'], ['<=', '以下'], ['contains', '指定の値を含む'], ['starts', '指定の値で始まる']];
    const row = i => `<div class="card" data-r style="padding:8px;margin:6px 0"><div class="small muted">${i ? 'Else If' : 'If'}</div><div class="two"><label>列名<select data-c>${colOptions()}</select></label><label>演算子<select data-o>${ops.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label><label>値<input data-v></label><label>出力<input data-out></label></div></div>`;
    sheet(`<h3>条件列の追加</h3><div class="form"><label>新しい列名<input data-n value="カスタム"></label></div><div data-rows>${row(0)}</div><button class="btn sm" data-add>＋ 句の追加</button>
      <div class="form" style="margin-top:8px"><label>それ以外の場合<input data-else></label></div>${btnRow()}`, (m, close) => {
      let n = 1; m.querySelector('[data-add]').onclick = () => m.querySelector('[data-rows]').insertAdjacentHTML('beforeend', row(n++));
      const val = (v, c) => /^-?\d+(\.\d+)?$/.test(v.trim()) && c !== 'text' ? String(+v) : S(v);
      m.querySelector('[data-ok]').onclick = () => {
        const rows = [...m.querySelectorAll('[data-r]')].map(r => ({ c: r.querySelector('[data-c]').value, o: r.querySelector('[data-o]').value, v: r.querySelector('[data-v]').value, out: r.querySelector('[data-out]').value }));
        if (rows.some(r => r.v === '' || r.out === '')) { toast('値と出力を入力してください'); return; }
        const cond = r => r.o === 'contains' ? `Text.Contains([${r.c}], ${S(r.v)})` : r.o === 'starts' ? `Text.StartsWith([${r.c}], ${S(r.v)})` : `[${r.c}] ${r.o} ${val(r.v, colType(r.c))}`;
        const els = m.querySelector('[data-else]').value;
        const expr = rows.map(r => `if ${cond(r)} then ${val(r.out)}`).join(' else ') + ` else ${els === '' ? 'null' : val(els)}`;
        close();
        addStep('追加された条件列', `Table.AddColumn(${prevName()}, ${S(m.querySelector('[data-n]').value)}, each ${expr})`);
      };
    });
  }
  function advancedEditor() {
    if (viewQuery !== qnames[0]) { sheet(`<h3>${esc(viewQuery)}（参照用）</h3><pre class="code"><code>${esc(helperQuery(viewQuery))}</code></pre><div class="btn-row"><button class="btn" data-close>閉じる</button></div>`); return; }
    sheet(`<h3>詳細エディター：${esc(qnames[0])}</h3><div data-ed></div><div class="result ng hide" data-err></div>${btnRow('完了')}`, (m, close) => {
      const words = [...(current()?.cols || []).map(c => `[${c}]`), ...steps.map(s => Q(s.name)), ...(ex.helpers || [])];
      const ed = createEditor(m.querySelector('[data-ed]'), { lang: 'm', value: fullCode(), minHeight: '240px', words, title: qnames[0] });
      m.querySelector('[data-ok]').onclick = () => {
        try {
          const r = M.splitSteps(ed.value);
          if (!r.result && r.steps.length > 1) throw new Error('in の後には最後のステップ名を書いてください');
          let ns = r.steps;
          if (r.result && r.result !== ns[ns.length - 1].name) { const k = ns.findIndex(s => s.name === r.result); if (k >= 0) ns = ns.slice(0, k + 1); }
          steps = ns; active = steps.length - 1; close(); refresh(); save();
        } catch (e) { const el = m.querySelector('[data-err]'); el.textContent = '構文エラー: ' + e.message; el.classList.remove('hide'); }
      };
    });
  }
  function editStepFormula(i) {
    sheet(`<h3>数式バー：${esc(steps[i].name)}</h3><div data-ed></div><div class="result ng hide" data-err></div>${btnRow('確定')}`, (m, close) => {
      const words = [...(current()?.cols || []).map(c => `[${c}]`), ...steps.slice(0, i).map(s => Q(s.name))];
      const ed = createEditor(m.querySelector('[data-ed]'), { lang: 'm', value: steps[i].src, minHeight: '100px', words, title: steps[i].name });
      m.querySelector('[data-ok]').onclick = () => {
        try { M.parse(ed.value); steps[i].src = ed.value.trim(); close(); refresh(); save(); }
        catch (e) { const el = m.querySelector('[data-err]'); el.textContent = '構文エラー: ' + e.message; el.classList.remove('hide'); }
      };
    });
  }
  // 列見出しのメニュー
  function columnMenu(c) {
    const t = current(); const ty = colType(c);
    const isNest = ty === 'table' || t.rows.some(r => r[t.cols.indexOf(c)] instanceof M.MTable);
    const items = [
      ...(isNest ? [['expand', '↔ 展開']] : []),
      ['asc', '↑ 昇順で並べ替え'], ['desc', '↓ 降順で並べ替え'], ['filter', '▼ フィルター'],
      ['type', '🔤 型の変更'], ['rename', '✏ 名前の変更'], ['remove', '🗑 列の削除'], ['others', '☑ 他の列の削除'],
      ['replace', '🔁 値の置換'], ['split', '✂ 列の分割'], ['format', 'Aa 書式'], ['fill', '⬇ フィル（下へ）'],
      ['dup', '≡ 重複の削除'], ['unpivotOthers', '↻ その他の列のピボット解除'], ['group', 'Σ グループ化'],
    ];
    sheet(`<h3><span class="ty" style="font-family:monospace;font-size:.75rem;border:1px solid var(--line);padding:0 4px;border-radius:4px">${TYPE_ICON[ty]}</span> ${esc(c)}</h3><div class="small muted" style="margin-bottom:6px">型: ${ty === 'any' ? '任意' : TYPE_LABEL[ty] || ty}　選択中: ${esc(colsList().join('、') || c)}</div>
      <div class="opts">${items.map(([k, l]) => `<button class="menu-btn" data-k="${k}">${l}</button>`).join('')}</div><div class="btn-row"><button class="btn" data-close>閉じる</button></div>`, (m, close) => {
      m.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
        close();
        if (!selCols.has(c)) { selCols = new Set([c]); }
        const cols = colsList();
        switch (b.dataset.k) {
          case 'expand': expandDialog(c); break;
          case 'asc': sortStep(c, false); break;
          case 'desc': sortStep(c, true); break;
          case 'filter': filterDialog(c); break;
          case 'type': typeDialog(cols); break;
          case 'rename': renameDialog(c); break;
          case 'remove': addStep('削除された列', `Table.RemoveColumns(${prevName()},{${cols.map(S).join(', ')}})`); break;
          case 'others': addStep('削除された他の列', `Table.SelectColumns(${prevName()},{${cols.map(S).join(', ')}})`); break;
          case 'replace': replaceDialog(cols); break;
          case 'split': splitDialog(c); break;
          case 'format': formatMenu(cols); break;
          case 'fill': addStep('下方向へコピー済み', `Table.FillDown(${prevName()},{${cols.map(S).join(', ')}})`); break;
          case 'dup': addStep('削除された重複', `Table.Distinct(${prevName()}, {${cols.map(S).join(', ')}})`); break;
          case 'unpivotOthers': addStep('ピボット解除された他の列', `Table.UnpivotOtherColumns(${prevName()}, {${cols.map(S).join(', ')}}, "属性", "値")`); break;
          case 'group': groupDialog(); break;
        }
      });
    });
  }

  // ---------- 描画 ----------
  function evaluate() {
    lastError = null;
    try {
      if (viewQuery !== qnames[0]) lastResult = helperTables([viewQuery])[viewQuery];
      else lastResult = runQuery(fullCode(active), ex);
    } catch (e) { if (!(e instanceof M.MErr)) throw e; lastResult = null; lastError = e.message; }
  }
  function refresh() {
    evaluate();
    const ro = viewQuery !== qnames[0];
    $('.pqx-title b').textContent = viewQuery;
    drawRibbon();
    // 数式バー
    const src = ro ? helperQuery(viewQuery).split('\n').slice(-3, -2)[0]?.trim() : steps[active].src;
    $('.fxv').textContent = '= ' + src;
    $('.fxedit').classList.toggle('hide', ro);
    // エラーバー
    const eb = $('.errbar');
    if (lastError) { eb.innerHTML = `⚠ ${esc(lastError)}`; eb.classList.remove('hide'); } else eb.classList.add('hide');
    // 列の選択バー
    const t = current();
    if (t) selCols = new Set([...selCols].filter(c => t.cols.includes(c)));
    const bar = $('.colsel-bar');
    if (selCols.size && !ro) { bar.innerHTML = `<span>選択: <b>${esc(colsList().join('、'))}</b></span><button class="btn sm" data-a="menu">メニュー</button><button class="btn sm" data-a="clear">選択解除</button>`; bar.classList.remove('hide'); }
    else bar.classList.add('hide');
    // 表
    $('.gridbox').innerHTML = t ? `<div class="pq-qual">${t.cols.length} 列、${t.rows.length} 行　${ro ? '（参照用のクエリ。編集はできません）' : '列見出しをタップで選択・メニュー（もう一度タップで選択解除）'}</div>` + gridHTML(t, { selCols, clickable: !ro }) : (lastResult != null ? gridHTML(lastResult) : `<div style="padding:16px" class="small muted">このステップでエラーが発生しています。数式バーで式を直すか、ステップを削除してください。</div>`);
    // ステップ
    $('.steps').classList.toggle('hide', ro);
    $('.steplist').innerHTML = steps.map((s, i) => `<div class="step ${i === active ? 'on' : ''}" data-i="${i}"><span class="nm">${esc(s.name)}</span>${i > 0 ? `<button class="gear" data-g="${i}" title="数式を編集">⚙</button><button class="x" data-x="${i}" title="削除">✕</button>` : ''}</div>`).join('');
    if (mode && steps.length === 1 && !saved) $('.steplist').insertAdjacentHTML('beforeend', '<p class="tiny muted">この演習は「詳細エディター」で M を書いて解きます（ホーム → 詳細エディター）。</p>');
  }
  $('.qsel').onchange = e => { viewQuery = e.target.value; selCols.clear(); refresh(); };
  $('.fxedit').onclick = () => editStepFormula(active);
  $('.fxv').onclick = () => { if (viewQuery === qnames[0]) editStepFormula(active); };
  $('.colsel-bar').onclick = e => { const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'clear') { selCols.clear(); refresh(); } if (a === 'menu') columnMenu(colsList()[0]); };
  $('.gridbox').onclick = e => {
    const th = e.target.closest('th[data-ci]');
    if (th && viewQuery === qnames[0]) {
      const c = current().cols[+th.dataset.ci];
      if (selCols.has(c)) { selCols.delete(c); refresh(); return; }
      selCols.add(c); refresh();
      if (selCols.size === 1) columnMenu(c);
      return;
    }
    const td = e.target.closest('td[data-r]');
    if (td) {
      const v = lastResult.rows[+td.dataset.r][+td.dataset.c];
      if (v instanceof M.MError) sheet(`<h3>⚠ エラー</h3><p>${esc(v.message)}</p><p class="small muted">型の変更で変換できない値があると、そのセルが Error になります。「エラーの削除」「エラーの置換」や、値の置換で元の値を直す方法があります。</p><div class="btn-row"><button class="btn" data-close>閉じる</button></div>`);
      else if (v instanceof M.MTable) sheet(`<h3>入れ子のテーブル（${v.rows.length} 行）</h3>${gridHTML(v, { clickable: false })}<p class="small muted">列見出しの「↔ 展開」で必要な列を取り出します。</p><div class="btn-row"><button class="btn" data-close>閉じる</button></div>`);
    }
  };
  $('.steplist').onclick = e => {
    const x = e.target.closest('[data-x]'); if (x) { const i = +x.dataset.x; if (i < steps.length - 1 && !confirm(`「${steps[i].name}」を削除しますか？ 後のステップがエラーになる場合があります。`)) return; deleteStep(i); return; }
    const g = e.target.closest('[data-g]'); if (g) { active = +g.dataset.g; refresh(); editStepFormula(active); return; }
    const s = e.target.closest('[data-i]'); if (s) { active = +s.dataset.i; refresh(); }
  };
  refresh();
  return {
    code: () => fullCode(),
    reset: () => { steps = startSteps(ex); active = 0; selCols.clear(); refresh(); save(); },
    setCode: code => { const r = M.splitSteps(code); steps = r.steps; active = steps.length - 1; refresh(); save(); },
    lastResultText: () => lastError || '',
  };
}
