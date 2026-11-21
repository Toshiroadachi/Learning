// スマホ向けのコードエディター（M / DAX / Power Fx の色分け・記号キーバー・入力候補）
import { esc } from './util.js';

const M_FUNCS = ['Table.SelectRows', 'Table.AddColumn', 'Table.TransformColumnTypes', 'Table.RemoveColumns', 'Table.SelectColumns', 'Table.RenameColumns', 'Table.Sort', 'Table.Group', 'Table.UnpivotOtherColumns', 'Table.Pivot', 'Table.NestedJoin', 'Table.ExpandTableColumn', 'Table.Distinct', 'Table.FirstN', 'Table.Skip', 'Table.PromoteHeaders', 'Table.FillDown', 'Table.ReplaceValue', 'Table.SplitColumn', 'Table.TransformColumns', 'Table.Combine', 'Table.RowCount', 'Table.RemoveRowsWithErrors', 'Table.ReplaceErrorValues', 'Table.AddIndexColumn', 'Table.DuplicateColumn', 'Table.ExpandListColumn',
  'Text.Trim', 'Text.Upper', 'Text.Lower', 'Text.Proper', 'Text.Start', 'Text.End', 'Text.Middle', 'Text.Contains', 'Text.StartsWith', 'Text.Replace', 'Text.Length', 'Text.From', 'Text.BeforeDelimiter', 'Text.AfterDelimiter', 'Text.Combine', 'Text.PadStart',
  'Number.Round', 'Number.RoundDown', 'Number.RoundUp', 'Number.From', 'Date.Year', 'Date.Month', 'Date.Day', 'Date.ToText', 'Date.AddDays', 'Date.AddMonths', 'Date.StartOfMonth', 'Date.EndOfMonth', 'Date.DayOfWeekName', 'Date.QuarterOfYear', 'Duration.Days',
  'List.Sum', 'List.Average', 'List.Max', 'List.Min', 'List.Count', 'List.Distinct', 'List.Contains', 'Splitter.SplitTextByDelimiter', 'Replacer.ReplaceText', 'Replacer.ReplaceValue', 'Excel.CurrentWorkbook', 'Csv.Document', 'File.Contents',
  'Order.Ascending', 'Order.Descending', 'JoinKind.LeftOuter', 'JoinKind.Inner', 'JoinKind.LeftAnti', 'JoinKind.FullOuter', 'Int64.Type', 'QuoteStyle.Csv'];
const M_KW = ['let', 'in', 'each', 'if', 'then', 'else', 'and', 'or', 'not', 'true', 'false', 'null', 'try', 'otherwise', 'type', 'text', 'number', 'date'];
export const DAX_FUNCS = ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'COUNTROWS', 'DISTINCTCOUNT', 'SUMX', 'AVERAGEX', 'MAXX', 'MINX', 'COUNTX', 'DIVIDE', 'CALCULATE', 'CALCULATETABLE', 'FILTER', 'ALL', 'ALLEXCEPT', 'ALLSELECTED', 'REMOVEFILTERS', 'KEEPFILTERS', 'VALUES', 'DISTINCT', 'RELATED', 'RELATEDTABLE', 'IF', 'SWITCH', 'TRUE', 'FALSE', 'AND', 'OR', 'NOT', 'BLANK', 'ISBLANK', 'COALESCE', 'HASONEVALUE', 'SELECTEDVALUE', 'ISINSCOPE', 'ISFILTERED', 'RANKX', 'TOPN', 'ADDCOLUMNS', 'SUMMARIZE', 'SELECTCOLUMNS', 'TOTALYTD', 'TOTALMTD', 'DATESYTD', 'SAMEPERIODLASTYEAR', 'DATEADD', 'PREVIOUSMONTH', 'DATESINPERIOD', 'DATESBETWEEN', 'PARALLELPERIOD', 'YEAR', 'MONTH', 'DAY', 'DATE', 'EOMONTH', 'FORMAT', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'INT', 'ABS', 'LEFT', 'RIGHT', 'MID', 'LEN', 'CONCATENATEX', 'IFERROR'];
const DAX_KW = ['VAR', 'RETURN', 'IN', 'ASC', 'DESC', 'MONTH', 'YEAR', 'DAY', 'QUARTER', 'DENSE'];
export const FX_FUNCS = ['Filter', 'Search', 'LookUp', 'Sort', 'SortByColumns', 'First', 'Last', 'FirstN', 'CountRows', 'CountIf', 'Sum', 'Average', 'Max', 'Min', 'AddColumns', 'DropColumns', 'ShowColumns', 'Distinct', 'Concat', 'ForAll', 'If', 'Switch', 'And', 'Or', 'Not', 'IsBlank', 'IsEmpty', 'Blank', 'Coalesce', 'IfError', 'Len', 'Left', 'Right', 'Mid', 'Upper', 'Lower', 'Trim', 'Substitute', 'StartsWith', 'EndsWith', 'Text', 'Value', 'Today', 'Now', 'Date', 'DateAdd', 'DateDiff', 'Year', 'Month', 'Day', 'Weekday', 'Round', 'Set', 'UpdateContext', 'Collect', 'ClearCollect', 'Clear', 'Remove', 'RemoveIf', 'Patch', 'Defaults', 'Navigate', 'Back', 'Notify', 'Reset', 'User', 'With', 'Sequence', 'Table',
  'SortOrder.Descending', 'SortOrder.Ascending', 'Color.Red', 'Color.Green', 'Color.Orange', 'Color.Black', 'Color.Gray', 'Color.Blue', 'DisplayMode.Edit', 'DisplayMode.Disabled', 'DisplayMode.View', 'NotificationType.Success', 'NotificationType.Error', 'TimeUnit.Days', 'TimeUnit.Months', 'ScreenTransition.Fade', 'ThisItem', 'ThisRecord', 'Self'];
const FX_KW = ['true', 'false', 'And', 'Or', 'Not', 'in', 'exactin', 'As', 'ThisItem', 'ThisRecord', 'Self', 'Parent'];

const LANG = {
  m: { name: 'M 言語', funcs: M_FUNCS, keys: [['Tab', 'TAB', 'wide'], ['"', '"'], ['[', '['], [']', ']'], ['(', '('], [')', ')'], ['{', '{'], ['}', '}'], [',', ','], ['=', '='], ['&', '&'], ['*', '*'], ['>', '>'], ['<', '<'], ['#"', '#"'], ['each', 'each '], ['_', '_'], ['.', '.'], ['←', 'LEFT'], ['→', 'RIGHT'], ['↶', 'UNDO', 'wide']] },
  dax: { name: 'DAX', funcs: DAX_FUNCS, keys: [['[', '['], [']', ']'], ['(', '('], [')', ')'], ['"', '"'], [',', ','], ['=', '='], ['&&', ' && '], ['||', ' || '], ['>', '>'], ['<', '<'], ['*', '*'], ['/', '/'], ['-', '-'], ['{', '{'], ['}', '}'], ['VAR', 'VAR '], ['RETURN', '\nRETURN '], ['↵', '\n', 'wide'], ['←', 'LEFT'], ['→', 'RIGHT'], ['↶', 'UNDO', 'wide']] },
  fx: { name: 'Power Fx', funcs: FX_FUNCS, keys: [['"', '"'], ['(', '('], [')', ')'], [',', ','], [';', '; '], ['.', '.'], ['=', ' = '], ['&', ' & '], ['&&', ' && '], ['||', ' || '], ['{', '{'], ['}', '}'], [':', ': '], ['[', '['], [']', ']'], ['>', '>'], ['<', '<'], ['<>', '<>'], ['↵', '\n', 'wide'], ['←', 'LEFT'], ['→', 'RIGHT'], ['↶', 'UNDO', 'wide']] },
};

function highlight(src, lang) {
  let out = ''; let i = 0; const n = src.length;
  const L = LANG[lang];
  while (i < n) {
    const c = src[i]; const rest = src.slice(i);
    let m;
    if ((m = /^\/\/[^\n]*/.exec(rest)) || (lang === 'dax' && (m = /^--[^\n]*/.exec(rest))) || (m = /^\/\*[\s\S]*?(\*\/|$)/.exec(rest))) { out += `<span class="tok-com">${esc(m[0])}</span>`; i += m[0].length; continue; }
    if ((m = /^"(?:[^"]|"")*"?/.exec(rest)) || (lang === 'm' && (m = /^#"(?:[^"]|"")*"?/.exec(rest)))) { out += `<span class="tok-${m[0][0] === '#' ? 'col' : 'str'}">${esc(m[0])}</span>`; i += m[0].length; continue; }
    if (lang !== 'm' && c === "'" && (m = /^'[^'\n]*'?/.exec(rest))) { out += `<span class="tok-${lang === 'dax' ? 'bi' : 'col'}">${esc(m[0])}</span>`; i += m[0].length; continue; }
    if (c === '[' && (m = /^\[[^\]\n]*\]?/.exec(rest)) && lang !== 'fx') { out += `<span class="tok-${lang === 'dax' ? 'ms' : 'col'}">${esc(m[0])}</span>`; i += m[0].length; continue; }
    if ((m = /^\d+(\.\d+)?/.exec(rest))) { out += `<span class="tok-num">${m[0]}</span>`; i += m[0].length; continue; }
    if ((m = /^[A-Za-z_À-￿][A-Za-z0-9_.À-￿]*/.exec(rest))) {
      const w = m[0]; const after = src.slice(i + w.length).match(/^\s*\(/);
      let cls = '';
      if (lang === 'm') cls = M_KW.includes(w) ? 'kw' : after || L.funcs.includes(w) ? 'fn' : /^#/.test(w) ? 'fn' : '';
      else if (lang === 'dax') cls = DAX_KW.includes(w.toUpperCase()) && !after ? 'kw' : after ? 'fn' : src[i + w.length] === '[' || src[i + w.length] === "'" ? 'bi' : '';
      else cls = FX_KW.includes(w) ? 'kw' : after ? 'fn' : /^(Color|SortOrder|DisplayMode|NotificationType|TimeUnit|ScreenTransition)\./.test(w) ? 'bi' : '';
      out += cls ? `<span class="tok-${cls}">${esc(w)}</span>` : esc(w);
      i += w.length; continue;
    }
    out += esc(c); i++;
  }
  return out + '\n';
}

// el に描画。words = 入力候補に足す語（列名・テーブル名・コントロール名など）
export function createEditor(el, { value = '', lang = 'm', onChange, title, minHeight = '120px', words = [], onRun } = {}) {
  const L = LANG[lang];
  el.innerHTML = `<div class="editor-wrap">
    <div class="editor-head"><span>${esc(title || L.name)}</span><span class="tiny">${esc(L.name)}</span></div>
    <div class="editor"><div class="gutter"></div><pre aria-hidden="true"></pre>
      <textarea spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off"></textarea></div>
    <div class="suggest"></div>
    <div class="keybar">${L.keys.map(([label, act, cls]) => `<button type="button" class="${cls || ''}" data-a="${esc(act)}">${esc(label)}</button>`).join('')}</div>
  </div>`;
  const ta = el.querySelector('textarea'), pre = el.querySelector('pre'), gut = el.querySelector('.gutter'), sug = el.querySelector('.suggest');
  ta.style.minHeight = minHeight;
  ta.value = value;
  const undo = [value];
  const vocab = [...new Set([...L.funcs, ...words])];
  const sync = () => {
    pre.innerHTML = highlight(ta.value, lang);
    const n = ta.value.split('\n').length;
    gut.innerHTML = Array.from({ length: n }, (_, i) => i + 1).join('<br>');
    ta.style.height = 'auto';
    ta.style.height = Math.max(ta.scrollHeight, parseInt(minHeight) || 120) + 'px';
    pre.scrollLeft = ta.scrollLeft;
  };
  // 入力候補（カーソル直前の単語で絞り込み）
  const curWord = () => {
    const before = ta.value.slice(0, ta.selectionStart);
    const m = /[A-Za-z_À-￿][A-Za-z0-9_.À-￿]*$/.exec(before);
    return m ? m[0] : '';
  };
  const showSuggest = () => {
    const w = curWord();
    let list;
    if (w.length >= 1) {
      const lw = w.toLowerCase();
      list = vocab.filter(v => v.toLowerCase().startsWith(lw) && v !== w).slice(0, 14);
      if (list.length < 6) list.push(...vocab.filter(v => !list.includes(v) && v.toLowerCase().includes(lw) && v !== w).slice(0, 8));
    } else list = words.slice(0, 12);
    sug.innerHTML = list.length ? list.map(v => `<button type="button" data-w="${esc(v)}">${esc(v)}</button>`).join('') : `<span class="lbl">文字を入力すると関数・列名の候補が出ます</span>`;
  };
  ta.addEventListener('scroll', () => { pre.scrollLeft = ta.scrollLeft; pre.scrollTop = ta.scrollTop; gut.scrollTop = ta.scrollTop; });
  let t = null;
  ta.addEventListener('input', () => {
    sync(); showSuggest();
    clearTimeout(t);
    t = setTimeout(() => { if (undo[undo.length - 1] !== ta.value) { undo.push(ta.value); if (undo.length > 100) undo.shift(); } }, 400);
    onChange && onChange(ta.value);
  });
  ta.addEventListener('click', showSuggest);
  ta.addEventListener('keyup', e => { if (e.key.startsWith('Arrow')) showSuggest(); });
  const insert = (text, caretBack = 0) => {
    const s = ta.selectionStart, e = ta.selectionEnd;
    ta.setRangeText(text, s, e, 'end');
    if (caretBack) ta.selectionStart = ta.selectionEnd = ta.selectionEnd - caretBack;
    ta.dispatchEvent(new Event('input'));
  };
  ta.addEventListener('keydown', e => {
    if (e.key === 'Tab') { e.preventDefault(); insert('    '); }
    else if (e.key === 'Enter' && !e.isComposing && (e.ctrlKey || e.metaKey) && onRun) { e.preventDefault(); onRun(); }
    else if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      const ls = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
      insert('\n' + ta.value.slice(ls, ta.selectionStart).match(/^\s*/)[0]);
    }
  });
  sug.addEventListener('mousedown', e => e.preventDefault());
  sug.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const w = curWord(); const v = b.dataset.w;
    ta.focus();
    ta.setRangeText('', ta.selectionStart - w.length, ta.selectionStart, 'end');
    const isFn = L.funcs.includes(v) && !/\.(Type|Ascending|Descending|LeftOuter|Inner|LeftAnti|FullOuter|Csv|Red|Green|Orange|Black|Gray|Blue|Edit|Disabled|View|Success|Error|Days|Months|Fade|ReplaceText|ReplaceValue)$/.test(v) && !['ThisItem', 'ThisRecord', 'Self', 'TRUE', 'FALSE'].includes(v);
    if (isFn && !(lang === 'm' && /^(Order|JoinKind|QuoteStyle)\./.test(v))) insert(v + '()', 1); else insert(v);
  });
  const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', '#"': '"' };
  el.querySelectorAll('.keybar button').forEach(b => {
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => {
      const a = b.dataset.a;
      ta.focus();
      if (a === 'TAB') insert('    ');
      else if (a === 'LEFT') { ta.selectionStart = ta.selectionEnd = Math.max(0, ta.selectionStart - 1); showSuggest(); }
      else if (a === 'RIGHT') { ta.selectionStart = ta.selectionEnd = ta.selectionEnd + 1; showSuggest(); }
      else if (a === 'UNDO') {
        if (undo.length > 1 && undo[undo.length - 1] === ta.value) undo.pop();
        const v = undo.length ? undo[undo.length - 1] : '';
        ta.value = v; sync(); onChange && onChange(v);
      }
      else if (pairs[a] && ta.selectionStart === ta.selectionEnd) insert(a + pairs[a], 1);
      else insert(a);
    });
  });
  sync(); showSuggest();
  requestAnimationFrame(sync);
  return {
    get value() { return ta.value; },
    set value(v) { ta.value = v; sync(); showSuggest(); },
    focus() { ta.focus(); },
    setWords(ws) { words = ws; vocab.splice(0, vocab.length, ...new Set([...L.funcs, ...ws])); showSuggest(); },
  };
}
export const codeBlock = (code, lang) => `<pre class="code"><code>${highlight(code, lang)}</code></pre>`;
