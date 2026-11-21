// Power Query M 言語のミニ実行エンジン（学習用のサブセット）
// let/in・each・関数・レコード・リスト・テーブルと、実務でよく使う Table./Text./Number./Date./List. 関数を実装。
// 列の型（ABC/123/日付）とセル単位のエラー値も再現する。

export class MErr extends Error {}                       // 式全体のエラー（throw）
export class MError { constructor(m) { this.message = m; } }   // セルのエラー値
export class MTable {
  constructor(cols, rows, types) { this.cols = cols; this.rows = rows; this.types = types || {}; }
}
export class MDate { constructor(ms) { this.ms = ms; } }
export class MDuration { constructor(days) { this.days = days; } }
export class MFunc { constructor(fn, name) { this.fn = fn; this.name = name || 'function'; } }
export class MType { constructor(name) { this.name = name; } }
export class MBinary { constructor(name, text) { this.name = name; this.text = text; } }

const isRec = v => v != null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const err = m => new MErr(m);
const DAYMS = 86400000;
export const mdate = (y, m, d) => new MDate(Date.UTC(y, m - 1, d));
const ymd = d => { const x = new Date(d.ms); return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()]; };

// ---------- 字句解析 ----------
const KW = new Set(['let', 'in', 'if', 'then', 'else', 'each', 'and', 'or', 'not', 'true', 'false', 'null', 'try', 'otherwise', 'type', 'as', 'error', 'meta', 'optional', 'nullable']);
const idStart = c => c && /[A-Za-z_\u00C0-\uFFFF]/.test(c);
const idChar = c => c && /[A-Za-z0-9_\u00C0-\uFFFF]/.test(c);

export function lex(src) {
  const t = []; let i = 0; const n = src.length;
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    const p = i;
    const readStr = () => {
      let s = ''; i++;
      for (;;) {
        if (i >= n) throw err('文字列の " が閉じていません');
        if (src[i] === '"') { if (src[i + 1] === '"') { s += '"'; i += 2; continue; } i++; break; }
        s += src[i++];
      }
      return s;
    };
    if (c === '"') { t.push({ k: 'str', v: readStr(), p }); continue; }
    if (c === '#' && src[i + 1] === '"') { i++; t.push({ k: 'id', v: readStr(), p, q: true }); continue; }
    if (c === '#' && idStart(src[i + 1])) { i++; let s = '#'; while (idChar(src[i])) s += src[i++]; t.push({ k: 'id', v: s, p }); continue; }
    if (/[0-9]/.test(c)) {
      const m = /^(0x[0-9a-fA-F]+|\d+(\.\d+)?([eE][+-]?\d+)?)/.exec(src.slice(i));
      t.push({ k: 'num', v: Number(m[0]), p }); i += m[0].length; continue;
    }
    if (idStart(c)) {
      let s = '';
      while (idChar(src[i]) || (src[i] === '.' && idStart(src[i + 1]))) s += src[i++];
      t.push(KW.has(s) ? { k: 'kw', v: s, p } : { k: 'id', v: s, p });
      continue;
    }
    if (c === '[') {
      const rest = src.slice(i);
      let m = /^\[\s*#"((?:[^"]|"")*)"\s*\]/.exec(rest);
      if (m) { t.push({ k: 'field', v: m[1].replace(/""/g, '"'), p }); i += m[0].length; continue; }
      m = /^\[([^[\]=,"]*)\]/.exec(rest);
      if (m && m[1].trim() && !/^\s*\[/.test(m[1])) { t.push({ k: 'field', v: m[1].trim(), p }); i += m[0].length; continue; }
    }
    const two = src.slice(i, i + 2);
    if (['=>', '<=', '>=', '<>', '..'].includes(two)) { t.push({ k: 'op', v: two, p }); i += 2; continue; }
    if ('=<>+-*/&(){}[],?@!'.includes(c)) { t.push({ k: 'op', v: c, p }); i++; continue; }
    throw err(`使えない文字があります: 「${c}」`);
  }
  t.push({ k: 'eof', p: n });
  return t;
}

// ---------- 構文解析 ----------
export function parse(src) {
  const toks = lex(src);
  let i = 0;
  const pk = (o = 0) => toks[i + o];
  const nx = () => toks[i++];
  const isOp = (v, o = 0) => pk(o).k === 'op' && pk(o).v === v;
  const isKw = (v, o = 0) => pk(o).k === 'kw' && pk(o).v === v;
  const where = tk => {
    const before = src.slice(0, tk.p);
    const line = before.split('\n').length;
    return `（${line}行目付近「${src.slice(tk.p, tk.p + 12).split('\n')[0]}」）`;
  };
  const expectOp = v => { if (!isOp(v)) throw err(`「${v}」が必要です${where(pk())}`); return nx(); };
  const expectKw = v => { if (!isKw(v)) throw err(`「${v}」が必要です${where(pk())}`); return nx(); };

  function skipType() {
    if (isKw('nullable')) nx();
    if (isOp('[') || isOp('{')) {
      const open = nx().v, close = open === '[' ? ']' : '}'; let d = 1;
      while (d > 0 && pk().k !== 'eof') { const t = nx(); if (t.k === 'op' && t.v === open) d++; else if (t.k === 'op' && t.v === close) d--; }
      return;
    }
    if (pk().k === 'id' || pk().k === 'kw') {
      const t = nx();
      if (t.v === 'table' || t.v === 'record') { if (isOp('[') || isOp('{')) skipType(); }
    }
  }
  function isLambda() {
    if (!isOp('(')) return false;
    let d = 0, j = i;
    for (; j < toks.length; j++) {
      const t = toks[j];
      if (t.k === 'op' && t.v === '(') d++;
      else if (t.k === 'op' && t.v === ')') { d--; if (d === 0) break; }
      else if (t.k === 'eof') return false;
    }
    const a = toks[j + 1];
    return a && ((a.k === 'op' && a.v === '=>') || (a.k === 'kw' && a.v === 'as'));
  }
  function expr() {
    const t = pk();
    if (isKw('let')) {
      nx(); const binds = [];
      for (;;) {
        const nt = nx();
        if (nt.k !== 'id') throw err(`ステップ名が必要です${where(nt)}`);
        expectOp('=');
        const start = pk().p;
        const e = expr();
        binds.push({ name: nt.v, e, src: src.slice(start, pk().p).trim(), p: nt.p });
        if (isOp(',')) { nx(); continue; }
        break;
      }
      expectKw('in');
      return { t: 'let', binds, body: expr(), p: t.p };
    }
    if (isKw('if')) { nx(); const c = expr(); expectKw('then'); const a = expr(); expectKw('else'); return { t: 'if', c, a, b: expr(), p: t.p }; }
    if (isKw('each')) { nx(); return { t: 'fn', params: ['_'], body: expr(), p: t.p }; }
    if (isKw('try')) { nx(); const body = expr(); let other = null; if (isKw('otherwise')) { nx(); other = expr(); } return { t: 'try', body, other, p: t.p }; }
    if (isKw('error')) { nx(); return { t: 'error', e: expr(), p: t.p }; }
    if (isLambda()) {
      nx(); const params = [];
      while (!isOp(')')) {
        if (isKw('optional')) nx();
        const pt = nx(); if (pt.k !== 'id') throw err(`引数名が必要です${where(pt)}`);
        params.push(pt.v);
        if (isKw('as')) { nx(); skipType(); }
        if (isOp(',')) nx();
      }
      nx();
      if (isKw('as')) { nx(); skipType(); }
      expectOp('=>');
      return { t: 'fn', params, body: expr(), p: t.p };
    }
    return orE();
  }
  const bin = (next, ops, kw) => () => {
    let l = next();
    for (;;) {
      const t = pk();
      const hit = kw ? (t.k === 'kw' && ops.includes(t.v)) : (t.k === 'op' && ops.includes(t.v));
      if (!hit) return l;
      nx();
      l = { t: 'bin', op: t.v, l, r: next(), p: t.p };
    }
  };
  function unary() {
    if (isOp('-') || isOp('+')) { const t = nx(); return { t: 'neg', op: t.v, e: unary(), p: t.p }; }
    return postfix();
  }
  const mul = bin(unary, ['*', '/']);
  const add = bin(mul, ['+', '-', '&']);
  const rel = bin(add, ['<', '>', '<=', '>=']);
  const eq = bin(rel, ['=', '<>']);
  function notE() { if (isKw('not')) { const t = nx(); return { t: 'not', e: notE(), p: t.p }; } return eq(); }
  const andE = bin(notE, ['and'], true);
  const orE0 = bin(andE, ['or'], true);
  function orE() { const l = orE0(); if (isKw('meta')) { nx(); orE0(); } return l; }

  function postfix() {
    let e = primary();
    for (;;) {
      if (isOp('(')) {
        const t = nx(); const args = [];
        while (!isOp(')')) { args.push(expr()); if (isOp(',')) nx(); else if (!isOp(')')) throw err(pk().k === 'eof' ? '関数のカッコ ( が閉じていません。最後に ) を付けてください' : `関数の引数の区切り「,」か「)」が必要です${where(pk())}`); }
        nx(); e = { t: 'call', f: e, args, p: t.p }; continue;
      }
      if (isOp('{')) {
        const t = nx(); const k = expr(); expectOp('}');
        let opt = false; if (isOp('?')) { nx(); opt = true; }
        e = { t: 'item', o: e, k, opt, p: t.p }; continue;
      }
      if (pk().k === 'field') {
        const t = nx(); let opt = false; if (isOp('?')) { nx(); opt = true; }
        e = { t: 'field', o: e, name: t.v, opt, p: t.p }; continue;
      }
      return e;
    }
  }
  function primary() {
    const t = nx();
    if (t.k === 'num') return { t: 'lit', v: t.v };
    if (t.k === 'str') return { t: 'lit', v: t.v };
    if (t.k === 'kw') {
      if (t.v === 'true') return { t: 'lit', v: true };
      if (t.v === 'false') return { t: 'lit', v: false };
      if (t.v === 'null') return { t: 'lit', v: null };
      if (t.v === 'type') {
        if (isKw('nullable')) nx();
        const nt = pk();
        if (isOp('[') || isOp('{')) { skipType(); return { t: 'lit', v: new MType('any') }; }
        nx();
        if (nt.v === 'table' && (isOp('[') || isOp('{'))) skipType();
        return { t: 'lit', v: new MType(nt.v) };
      }
    }
    if (t.k === 'id') return { t: 'id', name: t.v, p: t.p };
    if (t.k === 'field') { let opt = false; if (isOp('?')) { nx(); opt = true; } return { t: 'field', o: { t: 'id', name: '_', implicit: true }, name: t.v, opt, p: t.p }; }
    if (t.k === 'op' && t.v === '(') { const e = expr(); expectOp(')'); return e; }
    if (t.k === 'op' && t.v === '{') {
      const items = [];
      while (!isOp('}')) {
        const a = expr();
        if (isOp('..')) { nx(); items.push({ range: [a, expr()] }); } else items.push(a);
        if (isOp(',')) nx(); else if (!isOp('}')) throw err(`リストの区切り「,」か「}」が必要です${where(pk())}`);
      }
      nx(); return { t: 'list', items, p: t.p };
    }
    if (t.k === 'op' && t.v === '[') {
      const fields = [];
      while (!isOp(']')) {
        const ft = nx();
        if (ft.k !== 'id' && ft.k !== 'kw' && ft.k !== 'str') throw err(`レコードのフィールド名が必要です${where(ft)}`);
        expectOp('=');
        fields.push([ft.v, expr()]);
        if (isOp(',')) nx(); else if (!isOp(']')) throw err(`レコードの区切り「,」か「]」が必要です${where(pk())}`);
      }
      nx(); return { t: 'rec', fields, p: t.p };
    }
    if (t.k === 'eof') throw err('式が途中で終わっています');
    throw err(`ここに「${t.v}」は書けません${where(t)}`);
  }
  const e = expr();
  if (pk().k !== 'eof') throw err(`式の後ろに余分な文字があります${where(pk())}`);
  return e;
}

// ---------- 評価 ----------
class Env {
  constructor(parent) { this.p = parent; this.v = new Map(); }
  has(n) { for (let e = this; e; e = e.p) if (e.v.has(n)) return true; return false; }
  get(n) {
    for (let e = this; e; e = e.p) {
      if (!e.v.has(n)) continue;
      const b = e.v.get(n);
      if (b && b.__thunk) {
        if ('val' in b) return b.val;
        if (b.busy) throw err(`循環参照があります: ${n}`);
        b.busy = true;
        try { b.val = b.f(); } finally { b.busy = false; }
        return b.val;
      }
      return b;
    }
    if (n === '_') throw err('[列名] は each の中（または関数の中）でだけ使えます');
    const hint = /^[a-z]/.test(n) && LIB[n[0].toUpperCase() + n.slice(1)] ? `（大文字・小文字を区別します。${n[0].toUpperCase() + n.slice(1)} では？）` : '';
    throw err(`Expression.Error: 名前 '${n}' は認識されませんでした。${hint}`);
  }
}

const chk = v => { if (v instanceof MError) throw err(v.message); return v; };
export const typeName = v => v == null ? 'Null' : typeof v === 'number' ? 'Number' : typeof v === 'string' ? 'Text' : typeof v === 'boolean' ? 'Logical'
  : v instanceof MDate ? 'Date' : v instanceof MTable ? 'Table' : Array.isArray(v) ? 'List' : v instanceof MFunc ? 'Function' : v instanceof MDuration ? 'Duration' : isRec(v) ? 'Record' : v instanceof MType ? 'Type' : 'Value';

export function equal(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (a instanceof MDate && b instanceof MDate) return a.ms === b.ms;
  if (a instanceof MError && b instanceof MError) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equal(x, b[i]));
  if (isRec(a) && isRec(b)) { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => equal(a[k], b[k])); }
  if (a instanceof MTable && b instanceof MTable) return tableDiff(a, b) == null;
  return false;
}
function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (a instanceof MDate && b instanceof MDate) return a.ms - b.ms;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
  throw err(`Expression.Error: ${typeName(a)} と ${typeName(b)} は比較できません。`);
}

function ev(n, env) {
  switch (n.t) {
    case 'lit': return n.v;
    case 'id': return env.get(n.name);
    case 'field': {
      const o = ev(n.o, env);
      return getField(o, n.name, n.opt);
    }
    case 'item': {
      const o = ev(n.o, env), k = ev(n.k, env);
      if (Array.isArray(o) && typeof k === 'number') {
        if (k < 0 || k >= o.length) { if (n.opt) return null; throw err(`Expression.Error: 列挙に十分な要素がありませんでした（{${k}}）。リストは {0} から数えます。`); }
        return o[k];
      }
      if (o instanceof MTable && typeof k === 'number') {
        if (k < 0 || k >= o.rows.length) { if (n.opt) return null; throw err(`Expression.Error: テーブルに行 {${k}} がありません。`); }
        return rowRec(o, o.rows[k]);
      }
      if (o instanceof MTable && isRec(k)) {
        const keys = Object.keys(k);
        const hit = o.rows.filter(r => keys.every(c => equal(r[colIdx(o, c)], k[c])));
        if (hit.length !== 1) { if (n.opt && !hit.length) return null; throw err(hit.length ? 'Expression.Error: キーに一致する行が複数あります。' : `Expression.Error: キーがテーブルのどの行とも一致しませんでした（${keys.map(c => `${c}="${k[c]}"`).join(', ')}）。`); }
        return rowRec(o, hit[0]);
      }
      throw err(`Expression.Error: ${typeName(o)} に {${typeName(k)}} でアクセスできません。`);
    }
    case 'call': {
      const f = ev(n.f, env);
      if (!(f instanceof MFunc)) throw err(`Expression.Error: ${n.f.name || '値'} は関数ではないので ( ) で呼び出せません。`);
      const args = n.args.map(a => ev(a, env));
      return f.fn(...args);
    }
    case 'fn': return new MFunc((...a) => {
      const e2 = new Env(env);
      n.params.forEach((p, i) => e2.v.set(p, a[i] === undefined ? null : a[i]));
      return ev(n.body, e2);
    });
    case 'let': {
      const e2 = new Env(env);
      for (const b of n.binds) {
        if (e2.v.has(b.name)) throw err(`ステップ名「${b.name}」が重複しています`);
        e2.v.set(b.name, { __thunk: true, f: () => ev(b.e, e2) });
      }
      return ev(n.body, e2);
    }
    case 'if': {
      const c = chk(ev(n.c, env));
      if (c !== true && c !== false) throw err(`Expression.Error: if の条件が論理値（true/false）ではありません（${typeName(c)}）。null の可能性がある列は先に null を判定しましょう。`);
      return c ? ev(n.a, env) : ev(n.b, env);
    }
    case 'try': {
      try { const v = ev(n.body, env); chk(v); return v; }
      catch (e) {
        if (!(e instanceof MErr)) throw e;
        if (n.other) return ev(n.other, env);
        return { HasError: true, Error: { Message: e.message } };
      }
    }
    case 'error': { const v = ev(n.e, env); throw err(typeof v === 'string' ? v : v?.Message || 'エラー'); }
    case 'not': { const v = chk(ev(n.e, env)); if (v == null) return null; if (typeof v !== 'boolean') throw err('not は論理値に使います'); return !v; }
    case 'neg': { const v = chk(ev(n.e, env)); if (v == null) return null; if (typeof v !== 'number') throw err(`Expression.Error: 演算子 ${n.op} を ${typeName(v)} に適用できません。`); return n.op === '-' ? -v : v; }
    case 'bin': return binop(n, env);
    case 'list': {
      const out = [];
      for (const it of n.items) {
        if (it.range) { const a = ev(it.range[0], env), b = ev(it.range[1], env); for (let x = a; x <= b; x++) out.push(x); }
        else out.push(ev(it, env));
      }
      return out;
    }
    case 'rec': { const o = {}; for (const [k, e] of n.fields) o[k] = ev(e, env); return o; }
  }
  throw err('評価できない式です');
}

function binop(n, env) {
  if (n.op === 'and' || n.op === 'or') {
    const a = chk(ev(n.l, env));
    if (n.op === 'and' && a === false) return false;
    if (n.op === 'or' && a === true) return true;
    const b = chk(ev(n.r, env));
    if (a == null || b == null) return n.op === 'and' ? (a === false || b === false ? false : null) : (a === true || b === true ? true : null);
    if (typeof a !== 'boolean' || typeof b !== 'boolean') throw err(`${n.op} は論理値どうしに使います`);
    return n.op === 'and' ? a && b : a || b;
  }
  const a = chk(ev(n.l, env)), b = chk(ev(n.r, env));
  switch (n.op) {
    case '=': return equal(a, b);
    case '<>': return !equal(a, b);
    case '<': case '>': case '<=': case '>=': {
      if (a == null || b == null) return null;
      const c = cmp(a, b);
      return n.op === '<' ? c < 0 : n.op === '>' ? c > 0 : n.op === '<=' ? c <= 0 : c >= 0;
    }
    case '&': {
      if (a == null || b == null) return null;
      if (typeof a === 'string' && typeof b === 'string') return a + b;
      if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
      if (isRec(a) && isRec(b)) return { ...a, ...b };
      throw err(`Expression.Error: 演算子 & を ${typeName(a)} と ${typeName(b)} に適用できません。数値や日付は Text.From(…) でテキストにしてから結合します。`);
    }
    case '+': case '-': case '*': case '/': {
      if (a == null || b == null) return null;
      if (typeof a === 'number' && typeof b === 'number') return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : a / b;
      if (a instanceof MDate && b instanceof MDate && n.op === '-') return new MDuration((a.ms - b.ms) / DAYMS);
      if (a instanceof MDate && b instanceof MDuration) return new MDate(a.ms + (n.op === '-' ? -1 : 1) * b.days * DAYMS);
      if (typeof a === 'string' || typeof b === 'string')
        throw err(`Expression.Error: 演算子 ${n.op} を ${typeName(a)} と ${typeName(b)} に適用できません。${n.op === '+' ? 'テキストの結合は & を使います。' : '数値の列か確認し、必要なら型を「整数」「10進数」に変更します。'}`);
      throw err(`Expression.Error: 演算子 ${n.op} を ${typeName(a)} と ${typeName(b)} に適用できません。`);
    }
  }
  throw err('不明な演算子 ' + n.op);
}

function getField(o, name, opt) {
  if (isRec(o)) {
    if (!(name in o)) { if (opt) return null; throw err(`Expression.Error: レコードのフィールド '${name}' が見つかりませんでした。（列名のつづり・全角/半角を確認）`); }
    return chk(o[name]);
  }
  if (o instanceof MTable) {
    const i = o.cols.indexOf(name);
    if (i < 0) { if (opt) return null; throw err(`Expression.Error: テーブルの列 '${name}' が見つかりませんでした。`); }
    return o.rows.map(r => r[i]);
  }
  if (o == null) { if (opt) return null; throw err(`Expression.Error: null の値のフィールド '${name}' にはアクセスできません。`); }
  throw err(`Expression.Error: ${typeName(o)} からフィールド '${name}' は取り出せません。`);
}

// ---------- テーブル操作の補助 ----------
function colIdx(t, c) {
  const i = t.cols.indexOf(c);
  if (i < 0) throw err(`Expression.Error: テーブルの列 '${c}' が見つかりませんでした。（現在の列: ${t.cols.join(', ')}）`);
  return i;
}
export function rowRec(t, r) { const o = {}; t.cols.forEach((c, i) => { o[c] = r[i]; }); return o; }
const asList = x => x == null ? [] : Array.isArray(x) ? x : [x];
const pairs = x => { const l = asList(x); return l.length && !Array.isArray(l[0]) ? [l] : l; };
function call(f, ...a) { if (!(f instanceof MFunc)) throw err('関数（each …）が必要です'); return f.fn(...a); }
function cell(f, ...a) { try { return call(f, ...a); } catch (e) { if (e instanceof MErr) return new MError(e.message); throw e; } }
function tbl(t, name = 'テーブル') { if (!(t instanceof MTable)) throw err(`Expression.Error: ${name}が必要ですが ${typeName(t)} が渡されました。`); return t; }
const copyTypes = (t, cols) => { const o = {}; for (const c of cols) if (t.types[c]) o[c] = t.types[c]; return o; };
function checkUnique(cols) {
  const s = new Set();
  for (const c of cols) { if (s.has(c)) throw err(`Expression.Error: 列 '${c}' は既にテーブルに存在します。`); s.add(c); }
}

// 型変換（列の型の変更）
const TYPE_ALIAS = { text: 'text', number: 'number', int: 'int', currency: 'currency', percentage: 'percent', date: 'date', datetime: 'date', datetimezone: 'date', logical: 'logical', any: 'any', time: 'any', duration: 'any' };
function parseNum(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    let s = v.trim().replace(/[,，¥￥円\s]/g, '').replace(/[０-９．－]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
    let pct = false;
    if (s.endsWith('%')) { pct = true; s = s.slice(0, -1); }
    if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return pct ? Number(s) / 100 : Number(s);
  }
  if (v instanceof MDate) return v.ms / DAYMS + 25569;
  throw err(`DataFormat.Error: 数値に変換できませんでした。 詳細: ${v}`);
}
function parseDate(v) {
  if (v instanceof MDate) return v;
  if (typeof v === 'number') return new MDate(Math.round((v - 25569) * DAYMS));
  if (typeof v === 'string') {
    const s = v.trim().replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
    let m = /^(\d{4})[/\-.年](\d{1,2})[/\-.月](\d{1,2})日?/.exec(s);
    if (m) return mdate(+m[1], +m[2], +m[3]);
    m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
    if (m) return mdate(+m[1], +m[2], +m[3]);
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (m) return mdate(+m[3], +m[1], +m[2]);
  }
  throw err(`DataFormat.Error: 日付に変換できませんでした。 詳細: ${v}`);
}
export function textOf(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(+v.toPrecision(15));
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof MDate) { const [y, m, d] = ymd(v); return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`; }
  throw err(`Expression.Error: ${typeName(v)} をテキストに変換できません。`);
}
function convert(v, tn) {
  if (v == null || v instanceof MError) return v;
  switch (tn) {
    case 'text': return textOf(v);
    case 'number': case 'currency': return parseNum(v);
    case 'percent': return parseNum(v);
    case 'int': return Math.round(parseNum(v));
    case 'date': return parseDate(v);
    case 'logical':
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string' && /^(true|false)$/i.test(v.trim())) return /^true$/i.test(v.trim());
      if (typeof v === 'number') return v !== 0;
      throw err(`DataFormat.Error: 論理値に変換できませんでした。 詳細: ${v}`);
    default: return v;
  }
}
const typeOf = ty => { if (!(ty instanceof MType)) return 'any'; return TYPE_ALIAS[ty.name] || 'any'; };

function sortRows(t, crit) {
  let cs = asList(crit);
  if (cs.length === 2 && typeof cs[0] === 'string' && typeof cs[1] === 'number') cs = [cs];
  const keys = cs.map(c => {
    if (typeof c === 'string') return { i: colIdx(t, c), d: 1 };
    if (Array.isArray(c)) {
      if (c[0] instanceof MFunc) return { f: c[0], d: c[1] === 1 ? -1 : 1 };
      return { i: colIdx(t, c[0]), d: c[1] === 1 ? -1 : 1 };
    }
    if (c instanceof MFunc) return { f: c, d: 1 };
    throw err('並べ替えの指定が正しくありません');
  });
  const rows = t.rows.map((r, idx) => ({ r, idx }));
  rows.sort((a, b) => {
    for (const k of keys) {
      const va = k.f ? call(k.f, rowRec(t, a.r)) : a.r[k.i];
      const vb = k.f ? call(k.f, rowRec(t, b.r)) : b.r[k.i];
      const c = cmp(va instanceof MError ? null : va, vb instanceof MError ? null : vb);
      if (c) return c * k.d;
    }
    return a.idx - b.idx;
  });
  return rows.map(x => x.r);
}

function parseCsv(text, delim = ',') {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true;
    else if (c === delim) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const WD = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
function fmtDate(d, f) {
  const [y, m, dd] = ymd(d);
  const wd = new Date(d.ms).getUTCDay();
  return f.replace(/yyyy|yy|MMMM|MMM|MM|M|dddd|ddd|dd|d/g, tok => ({
    yyyy: y, yy: String(y).slice(2), MMMM: m + '月', MMM: m + '月', MM: String(m).padStart(2, '0'), M: m,
    dddd: WD[wd], ddd: WD[wd][0], dd: String(dd).padStart(2, '0'), d: dd,
  }[tok]));
}
const addMonths = (d, n) => { const [y, m, dd] = ymd(d); const t = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); return mdate(t.getUTCFullYear(), t.getUTCMonth() + 1, Math.min(dd, last)); };
const nn = f => (v, ...a) => v == null ? null : f(chk(v), ...a);
const txt = (v, name) => { if (typeof v !== 'string') throw err(`Expression.Error: ${name} にはテキストが必要ですが ${typeName(v)} が渡されました。数値なら Text.From で変換します。`); return v; };
const num = (v, name) => { if (typeof v !== 'number') throw err(`Expression.Error: ${name} には数値が必要ですが ${typeName(v)} が渡されました。列の型を数値に変更してください。`); return v; };
const dt = v => { if (!(v instanceof MDate)) { if (typeof v === 'string' || typeof v === 'number') return parseDate(v); throw err('Expression.Error: 日付が必要です'); } return v; };
const listNum = l => asList(l).map(chk).filter(x => x != null);

// ---------- 関数ライブラリ ----------
const F = (fn, name) => new MFunc(fn, name);
export const LIB = {
  // --- Table ---
  'Table.SelectRows': (t, f) => { tbl(t); return new MTable(t.cols, t.rows.filter(r => call(f, rowRec(t, r)) === true), t.types); },
  'Table.AddColumn': (t, name, f, ty) => {
    tbl(t); if (t.cols.includes(name)) throw err(`Expression.Error: 列 '${name}' は既にテーブルに存在します。`);
    const tn = typeOf(ty);
    return new MTable([...t.cols, name], t.rows.map(r => { let v = cell(f, rowRec(t, r)); if (tn !== 'any' && !(v instanceof MError)) { try { v = convert(v, tn); } catch (e) { v = new MError(e.message); } } return [...r, v]; }), { ...t.types, [name]: ty ? tn : 'any' });
  },
  'Table.RemoveColumns': (t, cols, missing) => {
    tbl(t); const rm = asList(cols); if (missing == null) rm.forEach(c => colIdx(t, c));
    const keep = t.cols.map((c, i) => i).filter(i => !rm.includes(t.cols[i]));
    return new MTable(keep.map(i => t.cols[i]), t.rows.map(r => keep.map(i => r[i])), copyTypes(t, keep.map(i => t.cols[i])));
  },
  'Table.SelectColumns': (t, cols, missing) => {
    tbl(t); const sel = asList(cols).filter(c => missing == null || t.cols.includes(c)); const idx = sel.map(c => colIdx(t, c));
    return new MTable(sel, t.rows.map(r => idx.map(i => r[i])), copyTypes(t, sel));
  },
  'Table.RenameColumns': (t, ren, missing) => {
    tbl(t); const cols = [...t.cols]; const types = { ...t.types };
    for (const [o, nw] of pairs(ren)) {
      const i = cols.indexOf(o);
      if (i < 0) { if (missing != null) continue; throw err(`Expression.Error: テーブルの列 '${o}' が見つかりませんでした。`); }
      cols[i] = nw; types[nw] = types[o]; if (o !== nw) delete types[o];
    }
    checkUnique(cols);
    return new MTable(cols, t.rows.map(r => [...r]), types);
  },
  'Table.ReorderColumns': (t, order) => {
    tbl(t); const ord = asList(order); ord.forEach(c => colIdx(t, c));
    const slots = t.cols.map((c, i) => ord.includes(c) ? i : -1).filter(i => i >= 0).sort((a, b) => a - b);
    const cols = [...t.cols]; slots.forEach((s, k) => { cols[s] = ord[k]; });
    const idx = cols.map(c => t.cols.indexOf(c));
    return new MTable(cols, t.rows.map(r => idx.map(i => r[i])), t.types);
  },
  'Table.TransformColumnTypes': (t, specs) => {
    tbl(t); const ps = pairs(specs); const types = { ...t.types };
    const conv = ps.map(([c, ty]) => { const i = colIdx(t, c); const tn = typeOf(ty); types[c] = tn; return [i, tn]; });
    return new MTable(t.cols, t.rows.map(r => { const n = [...r]; for (const [i, tn] of conv) { try { n[i] = convert(n[i], tn); } catch (e) { n[i] = new MError(e.message); } } return n; }), types);
  },
  'Table.TransformColumns': (t, specs, def, missing) => {
    tbl(t); const ps = pairs(specs); const types = { ...t.types };
    const ops = [];
    for (const [c, f, ty] of ps) { const i = t.cols.indexOf(c); if (i < 0) { if (missing != null) continue; colIdx(t, c); } ops.push([i, f, ty]); if (ty) types[c] = typeOf(ty); }
    return new MTable(t.cols, t.rows.map(r => { const n = [...r]; for (const [i, f] of ops) n[i] = n[i] instanceof MError ? n[i] : cell(f, n[i]); return n; }), types);
  },
  'Table.Sort': (t, crit) => { tbl(t); return new MTable(t.cols, sortRows(t, crit), t.types); },
  'Table.Group': (t, keys, aggs) => {
    tbl(t); const ks = asList(keys); const ki = ks.map(k => colIdx(t, k));
    let as = asList(aggs); if (as.length && typeof as[0] === 'string') as = [as];
    const groups = new Map();
    for (const r of t.rows) {
      const key = JSON.stringify(ki.map(i => r[i] instanceof MDate ? 'D' + r[i].ms : r[i]));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    const types = copyTypes(t, ks);
    as.forEach(a => { types[a[0]] = a[2] ? typeOf(a[2]) : 'any'; });
    return new MTable([...ks, ...as.map(a => a[0])], [...groups.values()].map(rs => {
      const sub = new MTable(t.cols, rs, t.types);
      return [...ki.map(i => rs[0][i]), ...as.map(a => cell(a[1], sub))];
    }), types);
  },
  'Table.UnpivotOtherColumns': (t, keep, attr, value) => {
    tbl(t); const kp = asList(keep); const ki = kp.map(c => colIdx(t, c));
    const other = t.cols.map((c, i) => i).filter(i => !kp.includes(t.cols[i]));
    const rows = [];
    for (const r of t.rows) for (const i of other) if (r[i] != null) rows.push([...ki.map(k => r[k]), t.cols[i], r[i]]);
    return new MTable([...kp, attr, value], rows, { ...copyTypes(t, kp), [attr]: 'text' });
  },
  'Table.Unpivot': (t, cols, attr, value) => {
    tbl(t); const uc = asList(cols); uc.forEach(c => colIdx(t, c));
    const kp = t.cols.filter(c => !uc.includes(c));
    return LIB['Table.UnpivotOtherColumns'](t, kp, attr, value);
  },
  'Table.Pivot': (t, values, attrCol, valueCol, agg) => {
    tbl(t); const ai = colIdx(t, attrCol), vi = colIdx(t, valueCol);
    const vals = asList(values).map(v => textOf(v));
    const keyIdx = t.cols.map((c, i) => i).filter(i => i !== ai && i !== vi);
    const groups = new Map();
    for (const r of t.rows) {
      const key = JSON.stringify(keyIdx.map(i => r[i] instanceof MDate ? 'D' + r[i].ms : r[i]));
      if (!groups.has(key)) groups.set(key, { base: keyIdx.map(i => r[i]), cells: new Map() });
      const g = groups.get(key); const a = textOf(r[ai]);
      if (!g.cells.has(a)) g.cells.set(a, []);
      g.cells.get(a).push(r[vi]);
    }
    return new MTable([...keyIdx.map(i => t.cols[i]), ...vals], [...groups.values()].map(g => [...g.base, ...vals.map(v => {
      const l = g.cells.get(v) || [];
      if (agg) return cell(agg, l);
      if (l.length > 1) return new MError('Expression.Error: 列挙に含まれる要素が多すぎるため、操作を完了できませんでした。（集計関数を指定してください）');
      return l.length ? l[0] : null;
    })]), copyTypes(t, keyIdx.map(i => t.cols[i])));
  },
  'Table.NestedJoin': (t1, k1, t2, k2, newCol, kind = 1) => {
    tbl(t1, '1つ目のテーブル'); tbl(t2, '2つ目のテーブル');
    if (t1.cols.includes(newCol)) throw err(`Expression.Error: 列 '${newCol}' は既にテーブルに存在します。`);
    const a = asList(k1).map(c => colIdx(t1, c)), b = asList(k2).map(c => colIdx(t2, c));
    const keyOf = (r, idx) => JSON.stringify(idx.map(i => r[i] instanceof MDate ? 'D' + r[i].ms : r[i]));
    const index = new Map(); t2.rows.forEach((r, j) => { const k = keyOf(r, b); if (!index.has(k)) index.set(k, []); index.get(k).push(j); });
    const used = new Set(); const rows = [];
    const nest = js => new MTable(t2.cols, js.map(j => t2.rows[j]), t2.types);
    for (const r of t1.rows) {
      const m = index.get(keyOf(r, a)) || [];
      m.forEach(j => used.add(j));
      const keep = kind === 1 || kind === 3 || ((kind === 0 || kind === 2) && m.length) || (kind === 4 && !m.length);
      if (keep) rows.push([...r, nest(m)]);
    }
    if (kind === 2 || kind === 3 || kind === 5) {
      const rest = new Map();
      t2.rows.forEach((r, j) => { if (used.has(j)) return; const k = keyOf(r, b); if (!rest.has(k)) rest.set(k, []); rest.get(k).push(j); });
      for (const js of rest.values()) rows.push([...t1.cols.map(() => null), nest(js)]);
    }
    return new MTable([...t1.cols, newCol], rows, { ...t1.types, [newCol]: 'table' });
  },
  'Table.ExpandTableColumn': (t, col, cols, names) => {
    tbl(t); const ci = colIdx(t, col); const cs = asList(cols); const ns = names ? asList(names) : cs;
    const newCols = [...t.cols.slice(0, ci), ...ns, ...t.cols.slice(ci + 1)];
    checkUnique(newCols);
    const rows = [];
    let subTypes = {};
    for (const r of t.rows) {
      const sub = r[ci];
      const pre = r.slice(0, ci), post = r.slice(ci + 1);
      if (!(sub instanceof MTable) || !sub.rows.length) { rows.push([...pre, ...cs.map(() => null), ...post]); continue; }
      const idx = cs.map(c => colIdx(sub, c)); subTypes = sub.types;
      for (const sr of sub.rows) rows.push([...pre, ...idx.map(i => sr[i]), ...post]);
    }
    const types = { ...t.types }; delete types[col];
    cs.forEach((c, k) => { types[ns[k]] = subTypes[c] || 'any'; });
    return new MTable(newCols, rows, types);
  },
  'Table.ExpandListColumn': (t, col) => {
    tbl(t); const ci = colIdx(t, col); const rows = [];
    for (const r of t.rows) { const l = r[ci]; if (Array.isArray(l)) { if (!l.length) rows.push([...r.slice(0, ci), null, ...r.slice(ci + 1)]); for (const x of l) rows.push([...r.slice(0, ci), x, ...r.slice(ci + 1)]); } else rows.push([...r]); }
    return new MTable(t.cols, rows, { ...t.types, [col]: 'any' });
  },
  'Table.Distinct': (t, cols) => {
    tbl(t); const idx = cols == null ? t.cols.map((c, i) => i) : asList(cols).map(c => colIdx(t, c));
    const seen = new Set();
    return new MTable(t.cols, t.rows.filter(r => { const k = JSON.stringify(idx.map(i => r[i] instanceof MDate ? 'D' + r[i].ms : r[i])); if (seen.has(k)) return false; seen.add(k); return true; }), t.types);
  },
  'Table.FirstN': (t, n) => { tbl(t); if (n instanceof MFunc) { const out = []; for (const r of t.rows) { if (call(n, rowRec(t, r)) !== true) break; out.push(r); } return new MTable(t.cols, out, t.types); } return new MTable(t.cols, t.rows.slice(0, n), t.types); },
  'Table.LastN': (t, n) => { tbl(t); return new MTable(t.cols, t.rows.slice(Math.max(0, t.rows.length - n)), t.types); },
  'Table.Skip': (t, n = 1) => { tbl(t); if (n instanceof MFunc) { let k = 0; while (k < t.rows.length && call(n, rowRec(t, t.rows[k])) === true) k++; return new MTable(t.cols, t.rows.slice(k), t.types); } return new MTable(t.cols, t.rows.slice(n), t.types); },
  'Table.RemoveLastN': (t, n = 1) => { tbl(t); return new MTable(t.cols, t.rows.slice(0, Math.max(0, t.rows.length - n)), t.types); },
  'Table.RemoveRows': (t, off, cnt = 1) => { tbl(t); return new MTable(t.cols, t.rows.filter((r, i) => i < off || i >= off + cnt), t.types); },
  'Table.PromoteHeaders': t => {
    tbl(t); if (!t.rows.length) return t;
    const cols = t.rows[0].map((v, i) => v == null || v === '' ? `Column${i + 1}` : textOf(v));
    const seen = {}; const uniq = cols.map(c => { if (seen[c]) { seen[c]++; return `${c}_${seen[c] - 1}`; } seen[c] = 1; return c; });
    return new MTable(uniq, t.rows.slice(1), {});
  },
  'Table.DemoteHeaders': t => { tbl(t); return new MTable(t.cols.map((c, i) => `Column${i + 1}`), [t.cols, ...t.rows], {}); },
  'Table.FillDown': (t, cols) => {
    tbl(t); const idx = asList(cols).map(c => colIdx(t, c)); const last = {};
    return new MTable(t.cols, t.rows.map(r => { const n = [...r]; for (const i of idx) { if (n[i] == null) n[i] = last[i] ?? null; else last[i] = n[i]; } return n; }), t.types);
  },
  'Table.FillUp': (t, cols) => {
    tbl(t); const idx = asList(cols).map(c => colIdx(t, c)); const last = {};
    const rows = t.rows.map(r => [...r]);
    for (let k = rows.length - 1; k >= 0; k--) for (const i of idx) { if (rows[k][i] == null) rows[k][i] = last[i] ?? null; else last[i] = rows[k][i]; }
    return new MTable(t.cols, rows, t.types);
  },
  'Table.ReplaceValue': (t, oldV, newV, replacer, cols) => {
    tbl(t); const idx = asList(cols).map(c => colIdx(t, c));
    return new MTable(t.cols, t.rows.map(r => { const n = [...r]; for (const i of idx) if (!(n[i] instanceof MError)) n[i] = call(replacer, n[i], oldV, newV); return n; }), t.types);
  },
  'Table.SplitColumn': (t, col, splitter, names) => {
    tbl(t); const ci = colIdx(t, col);
    let ns = typeof names === 'number' ? Array.from({ length: names }, (_, k) => `${col}.${k + 1}`) : names ? asList(names) : null;
    const parts = t.rows.map(r => r[ci] instanceof MError ? [r[ci]] : asList(call(splitter, r[ci])));
    if (!ns) { const mx = Math.max(1, ...parts.map(p => p.length)); ns = Array.from({ length: mx }, (_, k) => `${col}.${k + 1}`); }
    const newCols = [...t.cols.slice(0, ci), ...ns, ...t.cols.slice(ci + 1)];
    checkUnique(newCols);
    const types = { ...t.types }; delete types[col]; ns.forEach(c => { types[c] = 'any'; });
    return new MTable(newCols, t.rows.map((r, k) => [...r.slice(0, ci), ...ns.map((_, j) => parts[k][j] ?? null), ...r.slice(ci + 1)]), types);
  },
  'Table.Combine': list => {
    const ts = asList(list).map(x => tbl(x)); const cols = [];
    for (const x of ts) for (const c of x.cols) if (!cols.includes(c)) cols.push(c);
    const types = {}; for (const x of ts) Object.assign(types, x.types);
    return new MTable(cols, ts.flatMap(x => x.rows.map(r => cols.map(c => { const i = x.cols.indexOf(c); return i < 0 ? null : r[i]; }))), types);
  },
  'Table.DuplicateColumn': (t, col, name, ty) => { tbl(t); const i = colIdx(t, col); if (t.cols.includes(name)) throw err(`Expression.Error: 列 '${name}' は既にテーブルに存在します。`); return new MTable([...t.cols, name], t.rows.map(r => [...r, r[i]]), { ...t.types, [name]: ty ? typeOf(ty) : t.types[col] }); },
  'Table.AddIndexColumn': (t, name, start = 0, step = 1) => { tbl(t); return new MTable([...t.cols, name], t.rows.map((r, k) => [...r, start + k * step]), { ...t.types, [name]: 'int' }); },
  'Table.RowCount': t => tbl(t).rows.length,
  'Table.ColumnCount': t => tbl(t).cols.length,
  'Table.ColumnNames': t => [...tbl(t).cols],
  'Table.Column': (t, c) => { tbl(t); const i = colIdx(t, c); return t.rows.map(r => r[i]); },
  'Table.ToRecords': t => tbl(t).rows.map(r => rowRec(t, r)),
  'Table.FromRecords': recs => { const l = asList(recs); const cols = l.length ? Object.keys(l[0]) : []; return new MTable(cols, l.map(o => cols.map(c => o[c] ?? null))); },
  'Table.FromRows': (rows, cols) => { const rs = asList(rows); const cs = cols ? asList(cols) : (rs[0] || []).map((_, i) => `Column${i + 1}`); return new MTable(cs, rs.map(r => cs.map((_, i) => r[i] ?? null))); },
  'Table.Transpose': (t, cols) => {
    tbl(t); const n = t.rows.length; const cs = cols ? asList(cols) : Array.from({ length: n }, (_, i) => `Column${i + 1}`);
    return new MTable(cs, t.cols.map((c, j) => cs.map((_, i) => t.rows[i] ? t.rows[i][j] : null)));
  },
  'Table.Buffer': t => tbl(t),
  'Table.TransformColumnNames': (t, f) => { tbl(t); const cols = t.cols.map(c => call(f, c)); checkUnique(cols); const types = {}; t.cols.forEach((c, i) => { if (t.types[c]) types[cols[i]] = t.types[c]; }); return new MTable(cols, t.rows, types); },
  'Table.RemoveRowsWithErrors': (t, cols) => { tbl(t); const idx = cols == null ? t.cols.map((c, i) => i) : asList(cols).map(c => colIdx(t, c)); return new MTable(t.cols, t.rows.filter(r => !idx.some(i => r[i] instanceof MError)), t.types); },
  'Table.SelectRowsWithErrors': (t, cols) => { tbl(t); const idx = cols == null ? t.cols.map((c, i) => i) : asList(cols).map(c => colIdx(t, c)); return new MTable(t.cols, t.rows.filter(r => idx.some(i => r[i] instanceof MError)), t.types); },
  'Table.ReplaceErrorValues': (t, specs) => { tbl(t); const ps = pairs(specs).map(([c, v]) => [colIdx(t, c), v]); return new MTable(t.cols, t.rows.map(r => { const n = [...r]; for (const [i, v] of ps) if (n[i] instanceof MError) n[i] = v; return n; }), t.types); },
  'Table.IsEmpty': t => tbl(t).rows.length === 0,
  'Table.First': (t, def = null) => { tbl(t); return t.rows.length ? rowRec(t, t.rows[0]) : def; },
  'Table.Last': (t, def = null) => { tbl(t); return t.rows.length ? rowRec(t, t.rows[t.rows.length - 1]) : def; },
  'Table.Max': (t, c) => { tbl(t); const i = colIdx(t, c); let best = null; for (const r of t.rows) if (r[i] != null && (best == null || cmp(r[i], best[i]) > 0)) best = r; return best ? rowRec(t, best) : null; },
  'Table.Min': (t, c) => { tbl(t); const i = colIdx(t, c); let best = null; for (const r of t.rows) if (r[i] != null && (best == null || cmp(r[i], best[i]) < 0)) best = r; return best ? rowRec(t, best) : null; },
  'Table.Profile': t => { tbl(t); return new MTable(['Column', 'Count', 'NullCount', 'DistinctCount'], t.cols.map((c, i) => [c, t.rows.length, t.rows.filter(r => r[i] == null).length, new Set(t.rows.map(r => JSON.stringify(r[i]))).size])); },
  '#table': (cols, rows) => { const cs = cols instanceof MType ? [] : asList(cols); return new MTable(cs, asList(rows).map(r => cs.map((_, i) => r[i] ?? null))); },

  // --- Splitter / Replacer ---
  'Splitter.SplitTextByDelimiter': d => F(v => v == null ? [null] : txt(v, '列の分割').split(d)),
  'Splitter.SplitTextByEachDelimiter': (ds, qs, fromEnd) => F(v => {
    if (v == null) return [null];
    let rest = txt(v, '列の分割'); const out = [];
    for (const d of asList(ds)) {
      const i = fromEnd ? rest.lastIndexOf(d) : rest.indexOf(d);
      if (i < 0) break;
      out.push(rest.slice(0, i)); rest = rest.slice(i + d.length);
    }
    out.push(rest); return out;
  }),
  'Splitter.SplitTextByPositions': pos => F(v => { if (v == null) return [null]; const s = txt(v, '列の分割'); const ps = asList(pos); return ps.map((p, k) => s.slice(p, ps[k + 1] ?? undefined)); }),
  'Splitter.SplitTextByLengths': lens => F(v => { if (v == null) return [null]; const s = txt(v, '列の分割'); let o = 0; return asList(lens).map(l => { const r = s.slice(o, o + l); o += l; return r; }); }),
  'Splitter.SplitTextByCharacterTransition': (a, b) => F(v => { if (v == null) return [null]; const s = txt(v, '列の分割'); const isA = c => typeof a === 'function' ? false : asList(a).includes(c); const isB = c => asList(b).includes(c); const out = []; let cur = ''; for (let i = 0; i < s.length; i++) { if (i > 0 && isA(s[i - 1]) && isB(s[i])) { out.push(cur); cur = ''; } cur += s[i]; } out.push(cur); return out; }),
  'Replacer.ReplaceText': F((v, o, n) => typeof v === 'string' && o !== '' ? v.split(o).join(n ?? '') : v, 'Replacer.ReplaceText'),
  'Replacer.ReplaceValue': F((v, o, n) => equal(v, o) ? n : v, 'Replacer.ReplaceValue'),

  // --- Text ---
  'Text.From': v => v == null ? null : textOf(chk(v)),
  'Text.Upper': nn(v => txt(v, 'Text.Upper').toUpperCase()),
  'Text.Lower': nn(v => txt(v, 'Text.Lower').toLowerCase()),
  'Text.Proper': nn(v => txt(v, 'Text.Proper').toLowerCase().replace(/(^|[^A-Za-z])([a-z])/g, (m, a, b) => a + b.toUpperCase())),
  'Text.Trim': nn((v, chars) => { txt(v, 'Text.Trim'); if (chars == null) return v.replace(/^[\s\u3000]+|[\s\u3000]+$/g, ''); const cs = asList(chars); let s = v; while (s && cs.includes(s[0])) s = s.slice(1); while (s && cs.includes(s[s.length - 1])) s = s.slice(0, -1); return s; }),
  'Text.TrimStart': nn(v => txt(v, 'Text.TrimStart').replace(/^[\s\u3000]+/, '')),
  'Text.TrimEnd': nn(v => txt(v, 'Text.TrimEnd').replace(/[\s\u3000]+$/, '')),
  'Text.Clean': nn(v => txt(v, 'Text.Clean').replace(/[\x00-\x1F\x7F]/g, '')),
  'Text.Length': nn(v => txt(v, 'Text.Length').length),
  'Text.Start': nn((v, n) => txt(v, 'Text.Start').slice(0, n)),
  'Text.End': nn((v, n) => txt(v, 'Text.End').slice(Math.max(0, v.length - n))),
  'Text.Middle': nn((v, s, c) => txt(v, 'Text.Middle').substr(s, c ?? undefined)),
  'Text.Range': nn((v, s, c) => { txt(v, 'Text.Range'); if (s > v.length) throw err('Expression.Error: オフセットが範囲外です。'); return v.substr(s, c ?? undefined); }),
  'Text.Contains': nn((v, s) => txt(v, 'Text.Contains').includes(s)),
  'Text.StartsWith': nn((v, s) => txt(v, 'Text.StartsWith').startsWith(s)),
  'Text.EndsWith': nn((v, s) => txt(v, 'Text.EndsWith').endsWith(s)),
  'Text.Replace': nn((v, o, n) => txt(v, 'Text.Replace').split(o).join(n)),
  'Text.Split': nn((v, s) => txt(v, 'Text.Split').split(s)),
  'Text.Combine': (l, sep = '') => asList(l).map(chk).filter(x => x != null).map(x => txt(x, 'Text.Combine')).join(sep),
  'Text.PadStart': nn((v, n, c = ' ') => txt(v, 'Text.PadStart').padStart(n, c)),
  'Text.PadEnd': nn((v, n, c = ' ') => txt(v, 'Text.PadEnd').padEnd(n, c)),
  'Text.BeforeDelimiter': nn((v, d, idx = 0) => { txt(v, 'Text.BeforeDelimiter'); const parts = v.split(d); return parts.length <= idx + 1 ? v : parts.slice(0, idx + 1).join(d); }),
  'Text.AfterDelimiter': nn((v, d, idx = 0) => { txt(v, 'Text.AfterDelimiter'); const parts = v.split(d); return parts.length <= idx + 1 ? '' : parts.slice(idx + 1).join(d); }),
  'Text.BetweenDelimiters': nn((v, a, b) => { txt(v, 'Text.BetweenDelimiters'); const i = v.indexOf(a); if (i < 0) return ''; const rest = v.slice(i + a.length); const j = rest.indexOf(b); return j < 0 ? rest : rest.slice(0, j); }),
  'Text.PositionOf': nn((v, s) => txt(v, 'Text.PositionOf').indexOf(s)),
  'Text.Select': nn((v, cs) => { const l = asList(cs); return [...txt(v, 'Text.Select')].filter(c => l.includes(c)).join(''); }),
  'Text.Remove': nn((v, cs) => { const l = asList(cs); return [...txt(v, 'Text.Remove')].filter(c => !l.includes(c)).join(''); }),
  'Text.Reverse': nn(v => [...txt(v, 'Text.Reverse')].reverse().join('')),
  'Text.Repeat': nn((v, n) => txt(v, 'Text.Repeat').repeat(n)),
  'Text.Insert': nn((v, i, s) => txt(v, 'Text.Insert').slice(0, i) + s + v.slice(i)),
  'Text.ToList': nn(v => [...txt(v, 'Text.ToList')]),
  'Character.FromNumber': n => String.fromCharCode(n),

  // --- Number ---
  'Number.From': v => v == null ? null : parseNum(chk(v)),
  'Number.Round': nn((v, d = 0) => { num(v, 'Number.Round'); const f = 10 ** d; const x = v * f; const r = Math.round(x); return (Math.abs(x % 1) === 0.5 ? (r % 2 === 0 ? r : r - 1) : r) / f; }),
  'Number.RoundUp': nn((v, d = 0) => Math.ceil(num(v, 'Number.RoundUp') * 10 ** d) / 10 ** d),
  'Number.RoundDown': nn((v, d = 0) => Math.floor(num(v, 'Number.RoundDown') * 10 ** d) / 10 ** d),
  'Number.Abs': nn(v => Math.abs(num(v, 'Number.Abs'))),
  'Number.Mod': nn((v, d) => num(v, 'Number.Mod') % d),
  'Number.IntegerDivide': nn((v, d) => Math.trunc(num(v, 'Number.IntegerDivide') / d)),
  'Number.Power': nn((v, p) => num(v, 'Number.Power') ** p),
  'Number.Sqrt': nn(v => Math.sqrt(num(v, 'Number.Sqrt'))),
  'Number.ToText': nn((v, f) => { num(v, 'Number.ToText'); if (f === 'N0' || f === '#,##0') return Math.round(v).toLocaleString('en-US'); if (/^0+$/.test(f || '')) return String(Math.round(v)).padStart(f.length, '0'); return textOf(v); }),
  'Value.Is': (v, ty) => typeOf(ty) === 'any' || (typeOf(ty) === 'text' ? typeof v === 'string' : typeOf(ty) === 'date' ? v instanceof MDate : ['number', 'int', 'currency'].includes(typeOf(ty)) ? typeof v === 'number' : false),
  'Logical.From': v => v == null ? null : convert(v, 'logical'),

  // --- Date ---
  '#date': (y, m, d) => mdate(y, m, d),
  '#datetime': (y, m, d) => mdate(y, m, d),
  '#duration': (d = 0, h = 0, mi = 0, s = 0) => new MDuration(d + h / 24 + mi / 1440 + s / 86400),
  'Date.From': v => v == null ? null : parseDate(chk(v)),
  'Date.FromText': v => v == null ? null : parseDate(chk(v)),
  'DateTime.Date': v => v == null ? null : dt(v),
  'Date.Year': nn(v => ymd(dt(v))[0]),
  'Date.Month': nn(v => ymd(dt(v))[1]),
  'Date.Day': nn(v => ymd(dt(v))[2]),
  'Date.QuarterOfYear': nn(v => Math.ceil(ymd(dt(v))[1] / 3)),
  'Date.DayOfWeek': nn((v, first = 0) => (new Date(dt(v).ms).getUTCDay() - first + 7) % 7),
  'Date.DayOfWeekName': nn(v => WD[new Date(dt(v).ms).getUTCDay()]),
  'Date.MonthName': nn(v => ymd(dt(v))[1] + '月'),
  'Date.AddDays': nn((v, n) => new MDate(dt(v).ms + n * DAYMS)),
  'Date.AddMonths': nn((v, n) => addMonths(dt(v), n)),
  'Date.AddYears': nn((v, n) => addMonths(dt(v), 12 * n)),
  'Date.StartOfMonth': nn(v => { const [y, m] = ymd(dt(v)); return mdate(y, m, 1); }),
  'Date.EndOfMonth': nn(v => { const [y, m] = ymd(dt(v)); return new MDate(Date.UTC(y, m, 0)); }),
  'Date.StartOfYear': nn(v => mdate(ymd(dt(v))[0], 1, 1)),
  'Date.EndOfYear': nn(v => mdate(ymd(dt(v))[0], 12, 31)),
  'Date.StartOfQuarter': nn(v => { const [y, m] = ymd(dt(v)); return mdate(y, Math.floor((m - 1) / 3) * 3 + 1, 1); }),
  'Date.ToText': nn((v, f) => { const fmt = isRec(f) ? f.Format : f; return fmt ? fmtDate(dt(v), fmt) : textOf(dt(v)); }),
  'Duration.Days': nn(v => { if (!(v instanceof MDuration)) throw err('Duration.Days には期間（日付どうしの引き算の結果）が必要です'); return Math.floor(v.days); }),
  'Duration.TotalDays': nn(v => v.days),

  // --- List ---
  'List.Sum': l => { const v = listNum(l); if (!v.length) return null; return v.reduce((a, b) => a + num(b, 'List.Sum'), 0); },
  'List.Average': l => { const v = listNum(l); return v.length ? v.reduce((a, b) => a + num(b, 'List.Average'), 0) / v.length : null; },
  'List.Max': l => { const v = listNum(l); return v.length ? v.reduce((a, b) => cmp(a, b) >= 0 ? a : b) : null; },
  'List.Min': l => { const v = listNum(l); return v.length ? v.reduce((a, b) => cmp(a, b) <= 0 ? a : b) : null; },
  'List.Median': l => { const v = listNum(l).sort((a, b) => a - b); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; },
  'List.Product': l => { const v = listNum(l); return v.length ? v.reduce((a, b) => a * b, 1) : null; },
  'List.Count': l => asList(l).length,
  'List.NonNullCount': l => asList(l).filter(x => x != null).length,
  'List.Distinct': l => { const out = []; for (const x of asList(l)) if (!out.some(y => equal(x, y))) out.push(x); return out; },
  'List.Contains': (l, v) => asList(l).some(x => equal(x, v)),
  'List.ContainsAny': (l, vs) => asList(vs).some(v => asList(l).some(x => equal(x, v))),
  'List.First': (l, d = null) => asList(l).length ? asList(l)[0] : d,
  'List.Last': (l, d = null) => { const a = asList(l); return a.length ? a[a.length - 1] : d; },
  'List.FirstN': (l, n) => asList(l).slice(0, n),
  'List.Sort': (l, o = 0) => [...asList(l)].sort((a, b) => cmp(a, b) * (o === 1 ? -1 : 1)),
  'List.Select': (l, f) => asList(l).filter(x => call(f, x) === true),
  'List.Transform': (l, f) => asList(l).map(x => call(f, x)),
  'List.Numbers': (s, c, step = 1) => Array.from({ length: c }, (_, i) => s + i * step),
  'List.RemoveNulls': l => asList(l).filter(x => x != null),
  'List.Combine': ls => asList(ls).flatMap(x => asList(x)),
  'List.PositionOf': (l, v) => asList(l).findIndex(x => equal(x, v)),
  'List.Accumulate': (l, seed, f) => asList(l).reduce((acc, x) => call(f, acc, x), seed),
  'List.Zip': ls => { const a = asList(ls); const n = Math.max(0, ...a.map(x => x.length)); return Array.from({ length: n }, (_, i) => a.map(x => x[i] ?? null)); },
  'List.Range': (l, off, cnt) => asList(l).slice(off, cnt == null ? undefined : off + cnt),

  // --- Record ---
  'Record.Field': (r, f) => getField(r, f),
  'Record.FieldNames': r => Object.keys(r),
  'Record.FieldValues': r => Object.values(r),

  // --- 定数 ---
  'Order.Ascending': 0, 'Order.Descending': 1,
  'JoinKind.Inner': 0, 'JoinKind.LeftOuter': 1, 'JoinKind.RightOuter': 2, 'JoinKind.FullOuter': 3, 'JoinKind.LeftAnti': 4, 'JoinKind.RightAnti': 5,
  'QuoteStyle.Csv': 1, 'QuoteStyle.None': 0, 'MissingField.Ignore': 1, 'MissingField.UseNull': 2, 'GroupKind.Local': 0, 'GroupKind.Global': 1,
  'ExtraValues.Ignore': 2, 'ExtraValues.List': 0, 'ExtraValues.Error': 1,
  'Day.Sunday': 0, 'Day.Monday': 1, 'Day.Tuesday': 2, 'Day.Wednesday': 3, 'Day.Thursday': 4, 'Day.Friday': 5, 'Day.Saturday': 6,
  'Int64.Type': new MType('int'), 'Currency.Type': new MType('currency'), 'Percentage.Type': new MType('percentage'), 'Number.Type': new MType('number'), 'Text.Type': new MType('text'), 'Date.Type': new MType('date'),
  'Comparer.OrdinalIgnoreCase': F((a, b) => cmp(String(a).toLowerCase(), String(b).toLowerCase())),
};
for (const [k, v] of Object.entries(LIB)) if (typeof v === 'function') LIB[k] = F(v, k);

// ---------- 実行（ソース付き） ----------
// sources: { 名前: MTable } … Excel.CurrentWorkbook() の中のテーブル
// files:   { ファイル名: csv文字列 } … File.Contents("C:\…\ファイル名")
export function makeEnv(sources = {}, files = {}, queries = {}) {
  const env = new Env(null);
  for (const [k, v] of Object.entries(LIB)) env.v.set(k, v);
  for (const [k, v] of Object.entries(queries)) env.v.set(k, v);
  env.v.set('Excel.CurrentWorkbook', F(() => new MTable(['Content', 'Name'], Object.entries(sources).map(([n, t]) => [t, n]))));
  env.v.set('File.Contents', F(path => {
    const name = String(path).split(/[\\/]/).pop();
    if (!(name in files)) throw err(`DataSource.Error: ファイル '${path}' が見つかりませんでした。（使えるファイル: ${Object.keys(files).join(', ') || 'なし'}）`);
    return new MBinary(name, files[name]);
  }));
  env.v.set('Csv.Document', F((bin, opts) => {
    if (!(bin instanceof MBinary)) throw err('Csv.Document には File.Contents(…) を渡します');
    const delim = (isRec(opts) && opts.Delimiter) || ',';
    const rows = parseCsv(bin.text.replace(/\n+$/, ''), delim);
    const n = Math.max(...rows.map(r => r.length));
    return new MTable(Array.from({ length: n }, (_, i) => `Column${i + 1}`), rows.map(r => Array.from({ length: n }, (_, i) => r[i] ?? null)));
  }));
  env.v.set('Excel.Workbook', F(bin => {
    if (!(bin instanceof MBinary)) throw err('Excel.Workbook には File.Contents(…) を渡します');
    throw err('このアプリでは Excel ファイルの読み込みは Excel.CurrentWorkbook() で代用します');
  }));
  return env;
}

export function run(src, sources, files, queries) {
  const ast = parse(src);
  const env = makeEnv(sources, files, queries);
  return ev(ast, env);
}

// let 式をステップに分解（適用したステップ・詳細エディター用）
export function splitSteps(src) {
  const ast = parse(src);
  if (ast.t !== 'let') return { steps: [{ name: '式', src: src.trim() }], result: null };
  return { steps: ast.binds.map(b => ({ name: b.name, src: b.src })), result: ast.body.t === 'id' ? ast.body.name : null };
}
export const quoteName = n => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(n) && !KW.has(n)) || n === 'ソース' ? n : `#"${n.replace(/"/g, '""')}"`;
export function joinSteps(steps) {
  if (!steps.length) return '';
  return `let\n${steps.map((s, i) => `    ${quoteName(s.name)} = ${s.src}${i < steps.length - 1 ? ',' : ''}`).join('\n')}\nin\n    ${quoteName(steps[steps.length - 1].name)}`;
}
export const mstr = s => `"${String(s).replace(/"/g, '""')}"`;

// テーブルの比較（採点用）。違いがあれば説明文、同じなら null
const TCLASS = { int: 'num', number: 'num', currency: 'num', percent: 'num', text: 'text', date: 'date', logical: 'logical' };
const TLABEL = { num: '数値（整数・10進数など）', text: 'テキスト', date: '日付', logical: 'True/False', any: '任意（ABC123）' };
function looseEq(x, y) {
  if (equal(x, y)) return true;
  if (x == null || y == null || x instanceof MError || y instanceof MError) return false;
  try {
    if (typeof y === 'number' && typeof x === 'string' && x.trim() !== '' && !isNaN(+x)) return Math.abs(+x - y) < 1e-9;
    if (typeof x === 'number' && typeof y === 'string' && y.trim() !== '' && !isNaN(+y)) return Math.abs(+y - x) < 1e-9;
    if (x instanceof MDate || y instanceof MDate) return textOf(x) === textOf(y) || (typeof x === 'string' && parseDate(x).ms === y.ms) || (typeof y === 'string' && parseDate(y).ms === x.ms);
  } catch { return false; }
  return false;
}
export function typeDiff(a, b) {
  for (const c of b.cols) {
    const want = TCLASS[b.types[c]] || 'any', got = TCLASS[a.types[c]] || 'any';
    if (want !== 'any' && want !== got) return `列「${c}」のデータ型が違います（あなた: ${TLABEL[got]} / 期待: ${TLABEL[want]}）`;
  }
  return null;
}
export function tableDiff(a, b, opt = {}) {
  if (!(a instanceof MTable)) return `結果がテーブルではありません（${typeName(a)}）`;
  if (a.cols.length !== b.cols.length || a.cols.some((c, i) => c !== b.cols[i])) {
    const sa = [...a.cols].sort().join('|'), sb = [...b.cols].sort().join('|');
    if (sa === sb) return `列の並び順が違います。期待: ${b.cols.join(', ')}`;
    const miss = b.cols.filter(c => !a.cols.includes(c)), extra = a.cols.filter(c => !b.cols.includes(c));
    return `列が違います。${miss.length ? `足りない列: ${miss.join(', ')}。` : ''}${extra.length ? `余分な列: ${extra.join(', ')}。` : ''}`;
  }
  if (a.rows.length !== b.rows.length) return `行数が違います（あなた: ${a.rows.length} 行 / 期待: ${b.rows.length} 行）`;
  for (let r = 0; r < a.rows.length; r++)
    for (let c = 0; c < a.cols.length; c++) {
      const x = a.rows[r][c], y = b.rows[r][c];
      if (x instanceof MTable && y instanceof MTable) continue;
      if (!(opt.loose ? looseEq(x, y) : equal(x, y))) {
        const show = v => v instanceof MError ? 'Error' : v == null ? 'null' : typeof v === 'string' ? `"${v}"` : textOf(v);
        const hint = typeof x === 'string' && typeof y === 'number' ? '（数値型に変換されていません）' : typeof x === 'number' && typeof y === 'string' ? '（テキスト型が期待されています）' : '';
        return `${r + 1} 行目の「${a.cols[c]}」が違います（あなた: ${show(x)} / 期待: ${show(y)}）${hint}`;
      }
    }
  return null;
}

// 画面表示用の文字列
export function display(v) {
  if (v === null || v === undefined) return { t: 'null', s: 'null' };
  if (v instanceof MError) return { t: 'err', s: 'Error', title: v.message };
  if (v instanceof MTable) return { t: 'nest', s: 'Table' };
  if (Array.isArray(v)) return { t: 'nest', s: 'List' };
  if (isRec(v)) return { t: 'nest', s: 'Record' };
  if (v instanceof MFunc) return { t: 'nest', s: 'Function' };
  if (v instanceof MDuration) return { t: 'num', s: `${v.days}.00:00:00` };
  if (typeof v === 'number') return { t: 'num', s: String(+v.toPrecision(12)) };
  if (typeof v === 'boolean') return { t: 'num', s: v ? 'TRUE' : 'FALSE' };
  if (v instanceof MDate) return { t: 'num', s: textOf(v) };
  return { t: 'txt', s: String(v) };
}
// ソース定義から MTable を作る（読み込んだ直後なので型はすべて「任意」）
export function toTable(def) {
  return new MTable([...def.cols], def.rows.map(r => [...r]), {});
}
