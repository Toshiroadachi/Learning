// DAX のミニ実行エンジン（学習用サブセット）
// スター スキーマのモデル（多対一・単方向）で、フィルターコンテキスト・行コンテキスト・
// コンテキスト遷移・CALCULATE・ALL 系・イテレーター・タイムインテリジェンスを再現する。

export class DaxErr extends Error {}
const err = m => new DaxErr(m);
export class DDate {
  constructor(ms) { this.ms = ms; }
  get y() { return new Date(this.ms).getUTCFullYear(); }
  get m() { return new Date(this.ms).getUTCMonth() + 1; }
  get d() { return new Date(this.ms).getUTCDate(); }
}
export const ddate = (y, m, d) => new DDate(Date.UTC(y, m - 1, d));
const DAY = 86400000;
const key = v => v == null ? '∅' : v instanceof DDate ? 'D' + v.ms : typeof v === 'number' ? 'N' + v : typeof v === 'boolean' ? 'B' + v : 'S' + v;
const SEP = '\u0001';

// ---------- 字句解析 ----------
function lex(src) {
  const t = []; let i = 0; const n = src.length;
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if ((c === '/' && src[i + 1] === '/') || (c === '-' && src[i + 1] === '-')) { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    const p = i;
    if (c === '"') {
      let s = ''; i++;
      for (;;) { if (i >= n) throw err('文字列の " が閉じていません'); if (src[i] === '"') { if (src[i + 1] === '"') { s += '"'; i += 2; continue; } i++; break; } s += src[i++]; }
      t.push({ k: 'str', v: s, p }); continue;
    }
    if (c === "'") { const e = src.indexOf("'", i + 1); if (e < 0) throw err("テーブル名の ' が閉じていません"); t.push({ k: 'tname', v: src.slice(i + 1, e), p }); i = e + 1; continue; }
    if (c === '[') { const e = src.indexOf(']', i + 1); if (e < 0) throw err('列名の ] が閉じていません'); t.push({ k: 'col', v: src.slice(i + 1, e).trim(), p }); i = e + 1; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) { const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i)); t.push({ k: 'num', v: Number(m[0]), p }); i += m[0].length; continue; }
    if (/[A-Za-z_À-￿]/.test(c)) {
      let s = ''; while (i < n && /[A-Za-z0-9_.À-￿]/.test(src[i])) s += src[i++];
      t.push({ k: 'id', v: s, p }); continue;
    }
    const two = src.slice(i, i + 2);
    if (['<=', '>=', '<>', '==', '&&', '||'].includes(two)) { t.push({ k: 'op', v: two, p }); i += 2; continue; }
    if ('+-*/&=<>(),{}^'.includes(c)) { t.push({ k: 'op', v: c, p }); i++; continue; }
    if (c === '，' || c === '（' || c === '）' || c === '”' || c === '“') throw err(`全角の記号「${c}」が入っています。半角で入力してください`);
    throw err(`使えない文字があります: 「${c}」`);
  }
  t.push({ k: 'eof', p: n });
  return t;
}

// ---------- 構文解析 ----------
export function parse(src) {
  const toks = lex(src); let i = 0;
  const pk = (o = 0) => toks[i + o], nx = () => toks[i++];
  const isOp = v => pk().k === 'op' && pk().v === v;
  const isId = v => pk().k === 'id' && pk().v.toUpperCase() === v;
  const near = tk => `（「${src.slice(tk.p, tk.p + 14)}」付近）`;
  const expect = v => { if (!isOp(v)) throw err(`「${v}」が必要です${near(pk())}`); nx(); };
  function expr() {
    if (isId('VAR')) {
      const vars = [];
      while (isId('VAR')) { nx(); const nt = nx(); if (nt.k !== 'id') throw err('VAR の後に変数名が必要です'); expect('='); vars.push([nt.v, expr()]); }
      if (!isId('RETURN')) throw err('VAR を使ったら最後に RETURN が必要です');
      nx();
      return { t: 'var', vars, body: expr() };
    }
    return orE();
  }
  const bin = (next, ops) => () => {
    let l = next();
    for (;;) {
      const t = pk();
      const v = t.k === 'op' ? t.v : t.k === 'id' && t.v.toUpperCase() === 'IN' ? 'IN' : null;
      if (!v || !ops.includes(v)) return l;
      nx(); l = { t: 'bin', op: v === '==' ? '=' : v, l, r: next() };
    }
  };
  function unary() { if (isOp('-') || isOp('+')) { const op = nx().v; return { t: 'neg', op, e: unary() }; } if (isId('NOT') && !(pk(1).k === 'op' && pk(1).v === '(')) { nx(); return { t: 'not', e: unary() }; } return pow(); }
  const pow = bin(primary, ['^']);
  const mul = bin(unary, ['*', '/']);
  const add = bin(mul, ['+', '-']);
  const cat = bin(add, ['&']);
  const cmp = bin(cat, ['=', '==', '<>', '<', '>', '<=', '>=', 'IN']);
  const andE = bin(cmp, ['&&']);
  const orE = bin(andE, ['||']);
  function primary() {
    const t = nx();
    if (t.k === 'num') return { t: 'lit', v: t.v };
    if (t.k === 'str') return { t: 'lit', v: t.v };
    if (t.k === 'op' && t.v === '(') { const e = expr(); expect(')'); return e; }
    if (t.k === 'op' && t.v === '{') {
      const rows = [];
      while (!isOp('}')) {
        if (isOp('(')) { nx(); const r = []; while (!isOp(')')) { r.push(expr()); if (isOp(',')) nx(); } nx(); rows.push(r); }
        else rows.push([expr()]);
        if (isOp(',')) nx(); else if (!isOp('}')) throw err('{ } の中の区切りは「,」です');
      }
      nx(); return { t: 'tcons', rows };
    }
    if (t.k === 'col') return { t: 'bare', name: t.v, p: t.p };
    if (t.k === 'tname') {
      if (pk().k === 'col') return { t: 'col', table: t.v, name: nx().v, p: t.p };
      return { t: 'table', name: t.v, p: t.p };
    }
    if (t.k === 'id') {
      if (isOp('(')) {
        nx(); const args = [];
        while (!isOp(')')) { if (isOp(',')) { args.push({ t: 'lit', v: null, empty: true }); nx(); continue; } args.push(expr()); if (isOp(',')) { nx(); if (isOp(')')) throw err('引数が足りません（最後の「,」の後）'); } else if (!isOp(')')) throw err(pk().k === 'eof' ? `${t.v}( のカッコが閉じていません。最後に ) を付けてください` : `関数の引数の区切り「,」か「)」が必要です${near(pk())}`); }
        nx(); return { t: 'call', f: t.v.toUpperCase(), args, p: t.p, raw: t.v };
      }
      if (pk().k === 'col') return { t: 'col', table: t.v, name: nx().v, p: t.p };
      const U = t.v.toUpperCase();
      if (U === 'TRUE') return { t: 'lit', v: true };
      if (U === 'FALSE') return { t: 'lit', v: false };
      return { t: 'name', name: t.v, p: t.p };
    }
    if (t.k === 'eof') throw err('式が途中で終わっています（カッコの閉じ忘れ？）');
    throw err(`ここに「${t.v}」は書けません${near(t)}`);
  }
  const e = expr();
  if (pk().k !== 'eof') throw err(`式の後ろに余分な文字があります${near(pk())}（関数の引数を「,」で区切り忘れていませんか？）`);
  return e;
}

// ---------- 評価エンジン ----------
const AGG = new Set(['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'COUNTA', 'COUNTBLANK', 'DISTINCTCOUNT']);
const TABLE_FN = new Set(['FILTER', 'ALL', 'ALLEXCEPT', 'ALLSELECTED', 'REMOVEFILTERS', 'VALUES', 'DISTINCT', 'CALCULATETABLE', 'RELATEDTABLE', 'TOPN', 'ADDCOLUMNS', 'SUMMARIZE', 'SELECTCOLUMNS', 'DATESYTD', 'DATESMTD', 'DATESQTD', 'SAMEPERIODLASTYEAR', 'DATEADD', 'PREVIOUSMONTH', 'PREVIOUSYEAR', 'PREVIOUSQUARTER', 'NEXTMONTH', 'DATESBETWEEN', 'DATESINPERIOD', 'PARALLELPERIOD', 'FIRSTDATE', 'LASTDATE', 'KEEPFILTERS', 'TREATAS', 'GENERATESERIES', 'CROSSJOIN']);
const SYMBOLS = new Set(['DAY', 'MONTH', 'QUARTER', 'YEAR', 'ASC', 'DESC', 'SKIP', 'DENSE']);

export class Engine {
  // model: { tables: {名: {cols:[...], rows:[{...}]}}, rels:[{from, fromCol, to, toCol}], dateTable, dateCol }
  constructor(model) {
    this.m = model;
    this.measures = {};     // 名前 -> { src, ast }
    this.calcCols = {};     // "表|列" -> 計算済み
    this.vcache = new WeakMap();
    this.slicerFc = [];
    this.steps = 0;
  }
  setMeasure(name, src) { this.measures[name] = { src, ast: parse(src) }; }
  hasTable(t) { return !!this.m.tables[t]; }
  table(t) { const tb = this.m.tables[t]; if (!tb) throw err(`テーブル '${t}' がモデルにありません（${Object.keys(this.m.tables).join('・')}）`); return tb; }
  hasCol(t, c) { return this.table(t).cols.includes(c); }
  checkCol(t, c) {
    if (!this.hasCol(t, c)) {
      if (this.measures[c]) throw err(`${t}[${c}] は列ではなくメジャーです。メジャーは [${c}] のようにテーブル名を付けずに書きます`);
      throw err(`列 ${t}[${c}] が見つかりません（${t} の列: ${this.table(t).cols.join('、')}）`);
    }
  }
  // 計算列を追加（行コンテキストで評価）
  addCalcColumn(t, c, src) {
    const ast = parse(src); const tb = this.table(t);
    const vals = tb.rows.map((r, idx) => this.ev(ast, { fc: [], rows: [{ v: {}, lin: { [t]: idx } }], vars: new Map() }));
    if (!tb.cols.includes(c)) tb.cols.push(c);
    tb.rows.forEach((r, k) => { r[c] = vals[k]; });
    this.vcache = new WeakMap();
    return vals;
  }

  // ----- フィルター -----
  expanded(t) {
    const out = new Set([t]); const q = [t];
    while (q.length) { const x = q.shift(); for (const r of this.m.rels) if (r.from === x && !out.has(r.to)) { out.add(r.to); q.push(r.to); } }
    return out;
  }
  isFiltered(t, fc, seen = new Set()) {
    if (fc.some(f => f.t === t)) return true;
    seen.add(t);
    return this.m.rels.some(r => r.from === t && !seen.has(r.to) && this.isFiltered(r.to, fc, seen));
  }
  visible(t, fc) {
    let cache = this.vcache.get(fc);
    if (!cache) { cache = new Map(); this.vcache.set(fc, cache); }
    if (cache.has(t)) return cache.get(t);
    const tb = this.table(t);
    const fs = fc.filter(f => f.t === t);
    const rel = [];
    for (const r of this.m.rels) {
      if (r.from !== t || !this.isFiltered(r.to, fc)) continue;
      const to = this.table(r.to);
      rel.push({ col: r.fromCol, keys: new Set(this.visible(r.to, fc).map(i => key(to.rows[i][r.toCol]))) });
    }
    const out = [];
    tb.rows.forEach((row, i) => {
      for (const f of fs) {
        if (f.cols === null) { if (!f.keys.has(i)) return; }
        else { const k = f.cols.length === 1 ? key(row[f.cols[0]]) : f.cols.map(c => key(row[c])).join(SEP); if (!f.keys.has(k)) return; }
      }
      for (const r of rel) if (!r.keys.has(key(row[r.col]))) return;
      out.push(i);
    });
    cache.set(t, out);
    return out;
  }
  removeTables(fc, tables) { return fc.filter(f => !tables.has(f.t)); }
  removeCols(fc, t, cols) { return fc.filter(f => !(f.t === t && f.cols && f.cols.some(c => cols.includes(c)))); }
  addFilter(fc, f, keep) {
    let out = fc;
    if (!keep) {
      if (f.cols === null) out = this.removeTables(out, this.expanded(f.t));
      else if (this.m.dateTable === f.t && f.cols.includes(this.m.dateCol)) out = out.filter(x => x.t !== f.t);
      else out = this.removeCols(out, f.t, f.cols);
    }
    return [...out, f];
  }
  // テーブル値 → フィルター
  tableToFilters(tv) {
    if (!tv.rows.length) {
      const ks = tv.cols.filter(k => !k.startsWith('|'));
      if (tv.lin) return [{ t: tv.lin, cols: null, keys: new Set() }];
      const byT = groupCols(ks);
      return Object.entries(byT).map(([t, cols]) => ({ t, cols, keys: new Set() }));
    }
    if (tv.lin) return [{ t: tv.lin, cols: null, keys: new Set(tv.rows.map(r => r.lin[tv.lin])) }];
    const ks = tv.cols.filter(k => !k.startsWith('|'));
    if (!ks.length) throw err('このテーブルはフィルターとして使えません（モデルの列が含まれていません）');
    const byT = groupCols(ks);
    return Object.entries(byT).map(([t, cols]) => ({
      t, cols, keys: new Set(tv.rows.map(r => cols.length === 1 ? key(this.rv(r, t, cols[0])) : cols.map(c => key(this.rv(r, t, c))).join(SEP))),
    }));
  }
  transition(ctx) {
    let fc = ctx.fc;
    for (const row of ctx.rows) {
      for (const [t, idx] of Object.entries(row.lin)) fc = [...this.removeTables(fc, new Set([t])), { t, cols: null, keys: new Set([idx]) }];
      const byT = groupCols(Object.keys(row.v).filter(k => !k.startsWith('|')));
      for (const [t, cols] of Object.entries(byT)) {
        if (row.lin[t] != null) continue;
        fc = this.addFilter(fc, { t, cols, keys: new Set([cols.length === 1 ? key(row.v[t + '|' + cols[0]]) : cols.map(c => key(row.v[t + '|' + c])).join(SEP)]) });
      }
    }
    return fc;
  }

  // 行の値
  rv(row, t, c) {
    const k = t + '|' + c;
    if (k in row.v) return row.v[k];
    if (row.lin[t] != null) return this.table(t).rows[row.lin[t]][c];
    return undefined;
  }
  findRowVal(ctx, t, c, ast) {
    for (let k = ctx.rows.length - 1; k >= 0; k--) {
      const v = this.rv(ctx.rows[k], t, c);
      if (v !== undefined) return v;
    }
    const usedTables = ctx.rows.flatMap(r => Object.keys(r.lin));
    const rel = usedTables.find(u => this.expanded(u).has(t));
    if (rel) throw err(`${t}[${c}] は別のテーブルの列です。行コンテキスト（${rel} の行）から参照するには RELATED(${t}[${c}]) を使います`);
    throw err(`列 ${t}[${c}] の単一の値を特定できません。メジャーの中で列をそのまま書くことはできません。SUM(${t}[${c}]) のような集計関数で囲むか、SUMX などの反復関数の中で使ってください`);
  }

  // ----- 評価 -----
  run(src, fc = []) { return this.ev(parse(src), { fc, rows: [], vars: new Map() }); }
  ev(n, ctx) {
    if (++this.steps > 3e6) throw err('計算が複雑すぎます（無限ループの可能性）');
    switch (n.t) {
      case 'lit': return n.v;
      case 'var': {
        const vars = new Map(ctx.vars);
        for (const [name, e] of n.vars) vars.set(name, this.ev(e, { ...ctx, vars }));
        return this.ev(n.body, { ...ctx, vars });
      }
      case 'name': {
        if (ctx.vars.has(n.name)) { const v = ctx.vars.get(n.name); return v; }
        const U = n.name.toUpperCase();
        if (SYMBOLS.has(U)) return { sym: U };
        if (this.hasTable(n.name)) return this.evTable(n, ctx);
        throw err(`'${n.name}' が見つかりません。変数・テーブル名のつづりを確認してください（関数なら ( ) が必要です）`);
      }
      case 'table': return this.evTable(n, ctx);
      case 'col': {
        this.checkCol(n.table, n.name);
        return this.findRowVal(ctx, n.table, n.name, n);
      }
      case 'bare': {
        if (this.measures[n.name]) return this.measureRef(n.name, ctx);
        for (let k = ctx.rows.length - 1; k >= 0; k--) {
          const row = ctx.rows[k];
          const hit = Object.keys(row.v).find(x => x.split('|')[1] === n.name);
          if (hit) return row.v[hit];
          for (const t of Object.keys(row.lin)) if (this.hasCol(t, n.name)) return this.rv(row, t, n.name);
        }
        throw err(`[${n.name}] というメジャーはありません。列ならテーブル名を付けて 表名[${n.name}] と書きます`);
      }
      case 'neg': { const v = this.scalar(this.ev(n.e, ctx)); return v == null ? null : n.op === '-' ? -num(v) : num(v); }
      case 'not': return !truthy(this.scalar(this.ev(n.e, ctx)));
      case 'bin': return this.bin(n, ctx);
      case 'tcons': return this.evTable(n, ctx);
      case 'call': return this.call(n, ctx);
    }
    throw err('評価できない式です');
  }
  scalar(v) {
    if (v && v.rows && v.cols) {
      if (v.rows.length === 0) return null;
      if (v.rows.length === 1 && v.cols.length === 1) { const k = v.cols[0]; const [t, c] = k.split('|'); return this.rv(v.rows[0], t, c); }
      throw err('複数の値を含むテーブルが、単一の値が必要な場所で使われました（VALUES などが2行以上返しています）');
    }
    if (v && v.sym) throw err(`${v.sym} はここでは使えません`);
    return v;
  }
  measureRef(name, ctx) {
    const m = this.measures[name];
    if (ctx.stack?.includes(name)) throw err(`メジャー [${name}] が自分自身を参照しています（循環参照）`);
    const fc = ctx.rows.length ? this.transition(ctx) : ctx.fc;
    return this.scalar(this.ev(m.ast, { fc, rows: [], vars: new Map(), stack: [...(ctx.stack || []), name] }));
  }
  bin(n, ctx) {
    if (n.op === '&&') return truthy(this.scalar(this.ev(n.l, ctx))) && truthy(this.scalar(this.ev(n.r, ctx)));
    if (n.op === '||') return truthy(this.scalar(this.ev(n.l, ctx))) || truthy(this.scalar(this.ev(n.r, ctx)));
    if (n.op === 'IN') {
      const v = this.scalar(this.ev(n.l, ctx)); const tv = this.toTable(this.ev(n.r, ctx), ctx);
      const k = tv.cols[0]; const [t, c] = k.split('|');
      return tv.rows.some(r => key(this.rv(r, t, c)) === key(v));
    }
    const a = this.scalar(this.ev(n.l, ctx)), b = this.scalar(this.ev(n.r, ctx));
    switch (n.op) {
      case '&': return str(a) + str(b);
      case '+': if (a == null && b == null) return null; return toNum(a) + toNum(b);
      case '-': if (a == null && b == null) return null; return toNum(a) - toNum(b);
      case '*': if (a == null || b == null) return null; return toNum(a) * toNum(b);
      case '/': if (a == null) return null; if (b == null || toNum(b) === 0) { if (toNum(a) === 0) return NaN; return toNum(a) > 0 ? Infinity : -Infinity; } return toNum(a) / toNum(b);
      case '^': return toNum(a) ** toNum(b);
      case '=': return cmpv(a, b) === 0;
      case '<>': return cmpv(a, b) !== 0;
      case '<': return cmpv(a, b) < 0;
      case '>': return cmpv(a, b) > 0;
      case '<=': return cmpv(a, b) <= 0;
      case '>=': return cmpv(a, b) >= 0;
    }
    throw err('不明な演算子');
  }

  // ----- テーブル式 -----
  modelTable(t, rowsIdx) {
    return { cols: this.table(t).cols.map(c => t + '|' + c), rows: rowsIdx.map(i => ({ v: {}, lin: { [t]: i } })), lin: t };
  }
  toTable(v, ctx) {
    if (v && v.rows && v.cols) return v;
    throw err('テーブルが必要な場所に単一の値が指定されました（テーブル名・FILTER・VALUES などを指定します）');
  }
  evTable(n, ctx) {
    if (n.t === 'name' || n.t === 'table') {
      if (ctx.vars?.has(n.name)) return this.toTable(ctx.vars.get(n.name), ctx);
      this.table(n.name);
      return this.modelTable(n.name, this.visible(n.name, ctx.fc));
    }
    if (n.t === 'tcons') {
      const w = Math.max(...n.rows.map(r => r.length), 1);
      const cols = w === 1 ? ['|Value'] : Array.from({ length: w }, (_, i) => `|Value${i + 1}`);
      return { cols, rows: n.rows.map(r => { const v = {}; cols.forEach((c, i) => { v[c] = this.scalar(this.ev(r[i], ctx)); }); return { v, lin: {} }; }) };
    }
    if (n.t === 'col') throw err(`${n.table}[${n.name}] は列です。テーブルが必要な場所では VALUES(${n.table}[${n.name}]) や ALL(${n.table}[${n.name}]) を使います`);
    const v = this.ev(n, ctx);
    return this.toTable(v, ctx);
  }
  colArgs(args, fname) {
    return args.map(a => { if (a.t !== 'col') throw err(`${fname} の引数には 表名[列名] を指定します`); this.checkCol(a.table, a.name); return a; });
  }
  distinctCols(cols, rowsByT) {
    const t = cols[0].table;
    if (cols.some(c => c.table !== t)) throw err('複数のテーブルの列をまとめて指定することはできません');
    const tb = this.table(t); const seen = new Map();
    for (const i of rowsByT(t)) {
      const r = tb.rows[i]; const k = cols.map(c => key(r[c.name])).join(SEP);
      if (!seen.has(k)) { const v = {}; cols.forEach(c => { v[t + '|' + c.name] = r[c.name]; }); seen.set(k, { v, lin: {} }); }
    }
    return { cols: cols.map(c => t + '|' + c.name), rows: [...seen.values()] };
  }
  iterate(tv, ctx, fn) {
    return tv.rows.map(row => fn({ ...ctx, rows: [...ctx.rows, row] }, row));
  }

  // 日付テーブル関連
  dateInfo() {
    const t = this.m.dateTable, c = this.m.dateCol;
    if (!t) throw err('モデルに日付テーブルがありません');
    return { t, c, tb: this.table(t) };
  }
  visDates(ctx, arg) {
    if (arg && arg.t !== 'col') {
      const tv = this.evTable(arg, ctx);
      const k = tv.cols[0]; const [t, c] = k.split('|');
      return tv.rows.map(r => this.rv(r, t, c)).filter(Boolean).sort((a, b) => a.ms - b.ms);
    }
    const { t, c, tb } = this.dateInfo();
    if (arg && (arg.table !== t || arg.name !== c)) throw err(`タイムインテリジェンス関数には日付テーブルの列 ${t}[${c}] を指定します（売上の日付列ではなく）`);
    return this.visible(t, ctx.fc).map(i => tb.rows[i][c]).sort((a, b) => a.ms - b.ms);
  }
  dateTable(dates) {
    const { t, c, tb } = this.dateInfo();
    const set = new Set(dates.map(d => d.ms));
    const rows = []; const seen = new Set();
    for (const r of tb.rows) { const d = r[c]; if (set.has(d.ms) && !seen.has(d.ms)) { seen.add(d.ms); rows.push({ v: { [t + '|' + c]: d }, lin: {} }); } }
    return { cols: [t + '|' + c], rows };
  }
  allDates() { const { c, tb } = this.dateInfo(); return tb.rows.map(r => r[c]); }
  shift(dates, n, unit) {
    if (!dates.length) return [];
    if (unit === 'DAY') return dates.map(d => new DDate(d.ms + n * DAY));
    const months = unit === 'YEAR' ? 12 * n : unit === 'QUARTER' ? 3 * n : n;
    const out = new Map();
    const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (const d of dates) {
      const tm = new Date(Date.UTC(d.y, d.m - 1 + months, 1));
      const ty = tm.getUTCFullYear(), tmo = tm.getUTCMonth() + 1, ld = lastDay(ty, tmo);
      const nd = ddate(ty, tmo, Math.min(d.d, ld)); out.set(nd.ms, nd);
      if (d.d === lastDay(d.y, d.m)) for (let x = Math.min(d.d, ld) + 1; x <= ld; x++) { const e = ddate(ty, tmo, x); out.set(e.ms, e); }
    }
    return [...out.values()];
  }
  ytd(dates, yearEnd, unit = 'YEAR') {
    if (!dates.length) return [];
    const last = dates[dates.length - 1];
    let start;
    if (unit === 'MONTH') start = ddate(last.y, last.m, 1);
    else if (unit === 'QUARTER') start = ddate(last.y, Math.floor((last.m - 1) / 3) * 3 + 1, 1);
    else {
      let em = 12, ed = 31;
      if (yearEnd) { const m = /^(\d{1,2})[/-](\d{1,2})$/.exec(String(yearEnd)); if (!m) throw err('年度末は "3/31" のように指定します'); em = +m[1]; ed = +m[2]; }
      const endThis = ddate(last.y, em, ed);
      start = last.ms > endThis.ms ? new DDate(endThis.ms + DAY) : new DDate(ddate(last.y - 1, em, ed).ms + DAY);
    }
    return this.allDates().filter(d => d.ms >= start.ms && d.ms <= last.ms);
  }

  // ----- CALCULATE -----
  filterOps(args, ctx) {
    return args.map(a => {
      if (a.t === 'call' && ['ALL', 'REMOVEFILTERS', 'ALLEXCEPT', 'ALLSELECTED', 'ALLNOBLANKROW'].includes(a.f)) return { kind: 'remove', node: a };
      if (a.t === 'call' && a.f === 'KEEPFILTERS') return { kind: 'filter', keep: true, filters: this.filtersFromArg(a.args[0], ctx) };
      if (a.t === 'call' && (a.f === 'USERELATIONSHIP' || a.f === 'CROSSFILTER')) throw err(`${a.f} はこのアプリでは未対応です`);
      return { kind: 'filter', filters: this.filtersFromArg(a, ctx) };
    });
  }
  filtersFromArg(a, ctx) {
    const isTableExpr = (a.t === 'call' && TABLE_FN.has(a.f)) || a.t === 'table' || a.t === 'tcons' || (a.t === 'name' && (this.hasTable(a.name) || (ctx.vars.has(a.name) && ctx.vars.get(a.name)?.rows)));
    if (isTableExpr) return this.tableToFilters(this.evTable(a, ctx));
    if (a.t === 'col') throw err(`CALCULATE のフィルター引数に列 ${a.table}[${a.name}] だけを書くことはできません。${a.table}[${a.name}] = "値" のような条件にします`);
    // 真偽式 → ALL(列) を条件で絞ったテーブル
    const cols = []; let hasMeasure = false;
    const walk = x => {
      if (!x || typeof x !== 'object') return;
      if (x.t === 'col') { if (!cols.some(c => c.table === x.table && c.name === x.name)) cols.push(x); return; }
      if (x.t === 'bare' && this.measures[x.name]) hasMeasure = true;
      if (x.t === 'call' && AGG.has(x.f)) hasMeasure = true;
      for (const v of Object.values(x)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
    };
    walk(a);
    if (hasMeasure) throw err('CALCULATE のフィルター引数（True/False の条件）ではメジャーや集計関数を使えません。FILTER(テーブル, 条件) を使ってください');
    if (!cols.length) throw err('CALCULATE のフィルター引数には 表名[列名] を使った条件を書きます（例: 商品[カテゴリ] = "菓子"）');
    if (cols.some(c => c.table !== cols[0].table)) throw err('1つのフィルター条件で使えるのは1つのテーブルの列だけです。条件を「,」で分けるか FILTER を使ってください');
    cols.forEach(c => this.checkCol(c.table, c.name));
    const all = this.distinctCols(cols, t => this.table(t).rows.map((_, i) => i));
    const rows = all.rows.filter(r => truthy(this.scalar(this.ev(a, { ...ctx, rows: [...ctx.rows, r] }))));
    return this.tableToFilters({ cols: all.cols, rows });
  }
  applyRemove(fc, n, ctx) {
    const a = n.args;
    if (n.f === 'ALLSELECTED') {
      if (!a.length) return [...this.slicerFc];
      const restore = (f) => this.slicerFc.filter(f);
      if (a[0].t === 'col') { const cs = this.colArgs(a, n.f); const t = cs[0].table; const names = cs.map(c => c.name); return [...this.removeCols(fc, t, names), ...restore(f => f.t === t && f.cols && f.cols.some(c => names.includes(c)))]; }
      const t = a[0].name; const ex = this.expanded(t); return [...this.removeTables(fc, ex), ...restore(f => ex.has(f.t))];
    }
    if (!a.length) return [];
    if (n.f === 'ALLEXCEPT') {
      const t = a[0].name; this.table(t); const keep = this.colArgs(a.slice(1), 'ALLEXCEPT');
      const ex = this.expanded(t);
      return fc.filter(f => !ex.has(f.t) || (f.cols && f.cols.every(c => keep.some(k => k.table === f.t && k.name === c))));
    }
    if (a[0].t === 'col') { const cs = this.colArgs(a, n.f); return this.removeCols(fc, cs[0].table, cs.map(c => c.name)); }
    if (a[0].t === 'name' || a[0].t === 'table') { this.table(a[0].name); let out = fc; for (const x of a) out = this.removeTables(out, this.expanded(x.name)); return out; }
    throw err(`${n.f} にはテーブル名か 表名[列名] を指定します`);
  }
  calculate(exprNode, fargs, ctx) {
    const ops = this.filterOps(fargs, ctx);
    let fc = ctx.rows.length ? this.transition(ctx) : ctx.fc;
    for (const op of ops) if (op.kind === 'remove') fc = this.applyRemove(fc, op.node, ctx);
    for (const op of ops) if (op.kind === 'filter') for (const f of op.filters) fc = this.addFilter(fc, f, op.keep);
    return { ...ctx, fc, rows: [] };
  }

  // ----- 関数 -----
  call(n, ctx) {
    const a = n.args, F = n.f;
    const S = i => this.scalar(this.ev(a[i], ctx));
    const need = (k, sig) => { if (a.length < k) throw err(`${F} の引数が足りません。書き方: ${sig}`); };
    const aggCol = () => {
      need(1, `${F}(表名[列名])`);
      if (a[0].t !== 'col') {
        if (a[0].t === 'bare' && this.measures[a[0].name]) throw err(`${F} にはメジャーではなく列を指定します。メジャー [${a[0].name}] はそのまま使えます`);
        throw err(`${F} の引数には 表名[列名] を指定します。式を集計したいときは ${F === 'COUNT' ? 'COUNTX' : F + 'X'}(テーブル, 式) を使います`);
      }
      this.checkCol(a[0].table, a[0].name);
      const tb = this.table(a[0].table);
      return this.visible(a[0].table, ctx.fc).map(i => tb.rows[i][a[0].name]);
    };
    switch (F) {
      // 集計
      case 'SUM': { const v = aggCol().filter(x => x != null); if (v.some(x => typeof x !== 'number')) throw err('SUM は数値の列にだけ使えます'); return v.length ? v.reduce((s, x) => s + x, 0) : null; }
      case 'AVERAGE': { const v = aggCol().filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; }
      case 'MIN': case 'MAX': {
        if (a.length === 2) { const x = S(0), y = S(1); if (x == null) return y; if (y == null) return x; return (F === 'MIN' ? cmpv(x, y) <= 0 : cmpv(x, y) >= 0) ? x : y; }
        const v = aggCol().filter(x => x != null); if (!v.length) return null;
        return v.reduce((p, x) => (F === 'MIN' ? cmpv(x, p) < 0 : cmpv(x, p) > 0) ? x : p);
      }
      case 'COUNT': { const v = aggCol().filter(x => x != null && x !== ''); return v.length || null; }
      case 'COUNTA': { const v = aggCol().filter(x => x != null && x !== ''); return v.length || null; }
      case 'COUNTBLANK': { const v = aggCol().filter(x => x == null || x === ''); return v.length || null; }
      case 'DISTINCTCOUNT': { const v = aggCol(); return new Set(v.map(key)).size || null; }
      case 'COUNTROWS': { need(1, 'COUNTROWS(テーブル)'); const tv = this.evTable(a[0], ctx); return tv.rows.length || null; }
      case 'SUMX': case 'AVERAGEX': case 'MINX': case 'MAXX': case 'COUNTX': case 'COUNTAX': case 'PRODUCTX': {
        need(2, `${F}(テーブル, 式)`);
        const tv = this.evTable(a[0], ctx);
        const vals = this.iterate(tv, ctx, c => this.scalar(this.ev(a[1], c))).filter(x => x != null);
        if (!vals.length) return null;
        if (F === 'SUMX') return vals.reduce((s, x) => s + toNum(x), 0);
        if (F === 'AVERAGEX') return vals.reduce((s, x) => s + toNum(x), 0) / vals.length;
        if (F === 'PRODUCTX') return vals.reduce((s, x) => s * toNum(x), 1);
        if (F === 'COUNTX' || F === 'COUNTAX') return vals.length;
        return vals.reduce((p, x) => (F === 'MINX' ? cmpv(x, p) < 0 : cmpv(x, p) > 0) ? x : p);
      }
      case 'CONCATENATEX': {
        need(2, 'CONCATENATEX(テーブル, 式, 区切り)');
        const tv = this.evTable(a[0], ctx);
        let rows = tv.rows;
        if (a[3]) { const keys = new Map(rows.map(r => [r, this.scalar(this.ev(a[3], { ...ctx, rows: [...ctx.rows, r] }))])); const desc = a[4] && this.ev(a[4], ctx)?.sym === 'DESC'; rows = [...rows].sort((x, y) => cmpv(keys.get(x), keys.get(y)) * (desc ? -1 : 1)); }
        return rows.map(r => str(this.scalar(this.ev(a[1], { ...ctx, rows: [...ctx.rows, r] })))).join(a[2] ? str(S(2)) : '');
      }
      case 'RANKX': {
        need(2, 'RANKX(テーブル, 式, [値], [順序], [同順位])');
        const tv = this.evTable(a[0], ctx);
        const vals = this.iterate(tv, ctx, c => this.scalar(this.ev(a[1], c)));
        const cur = a[2] && !a[2].empty ? S(2) : this.scalar(this.ev(a[1], ctx));
        const asc = a[3] && !a[3].empty && this.ev(a[3], ctx)?.sym === 'ASC';
        const dense = a[4] && this.ev(a[4], ctx)?.sym === 'DENSE';
        const better = v => v != null || cur == null ? (asc ? cmpv(v, cur) < 0 : cmpv(v, cur) > 0) : false;
        if (dense) return new Set(vals.filter(better).map(key)).size + 1;
        return vals.filter(better).length + 1;
      }
      // CALCULATE
      case 'CALCULATE': { need(1, 'CALCULATE(式, フィルター1, フィルター2, …)'); const c2 = this.calculate(a[0], a.slice(1), ctx); return this.scalar(this.ev(a[0], c2)); }
      case 'CALCULATETABLE': { need(1, 'CALCULATETABLE(テーブル, フィルター…)'); const c2 = this.calculate(a[0], a.slice(1), ctx); return this.evTable(a[0], c2); }
      case 'FILTER': {
        need(2, 'FILTER(テーブル, 条件)');
        if (a[0].t === 'col') throw err(`FILTER の1つ目の引数はテーブルです。列で絞るなら FILTER(ALL(${a[0].table}[${a[0].name}]), 条件) や FILTER(VALUES(${a[0].table}[${a[0].name}]), 条件) と書きます`);
        const tv = this.evTable(a[0], ctx);
        return { ...tv, rows: tv.rows.filter(r => truthy(this.scalar(this.ev(a[1], { ...ctx, rows: [...ctx.rows, r] })))) };
      }
      case 'ALL': case 'REMOVEFILTERS': case 'ALLNOBLANKROW': {
        if (!a.length) throw err(`${F}() をテーブルとして使うときはテーブル名か列を指定します`);
        if (a[0].t === 'col') return this.distinctCols(this.colArgs(a, F), t => this.table(t).rows.map((_, i) => i));
        const t = a[0].name; this.table(t); return this.modelTable(t, this.table(t).rows.map((_, i) => i));
      }
      case 'ALLSELECTED': {
        const fc = this.applyRemove(ctx.fc, n, ctx);
        if (a[0]?.t === 'col') return this.distinctCols(this.colArgs(a, F), t => this.visible(t, fc));
        const t = a[0].name; return this.modelTable(t, this.visible(t, fc));
      }
      case 'ALLEXCEPT': { const t = a[0].name; this.table(t); const fc = this.applyRemove(ctx.fc, n, ctx); return this.modelTable(t, this.visible(t, fc)); }
      case 'VALUES': case 'DISTINCT': {
        need(1, `${F}(表名[列名])`);
        if (a[0].t === 'col') return this.distinctCols(this.colArgs(a, F), t => this.visible(t, ctx.fc));
        return this.evTable(a[0], ctx);
      }
      case 'KEEPFILTERS': return this.evTable(a[0], ctx);
      case 'RELATED': {
        need(1, 'RELATED(表名[列名])');
        if (a[0].t !== 'col') throw err('RELATED には 表名[列名] を指定します');
        const { table: t, name: c } = a[0]; this.checkCol(t, c);
        for (let k = ctx.rows.length - 1; k >= 0; k--) {
          const row = ctx.rows[k];
          for (const [from, idx] of Object.entries(row.lin)) {
            const path = this.relPath(from, t);
            if (!path) continue;
            let cur = this.table(from).rows[idx];
            for (const r of path) { const target = this.table(r.to).rows.find(x => key(x[r.toCol]) === key(cur[r.fromCol])); if (!target) return null; cur = target; }
            return cur[c];
          }
        }
        if (!ctx.rows.length) throw err('RELATED は行コンテキストの中（計算列、または SUMX・FILTER などの反復関数の中）で使います');
        throw err(`RELATED(${t}[${c}]): 現在の行のテーブルから ${t} へのリレーションシップ（多対一）がありません。一側から多側をたどるときは RELATEDTABLE を使います`);
      }
      case 'RELATEDTABLE': {
        need(1, 'RELATEDTABLE(テーブル)');
        if (!ctx.rows.length) throw err('RELATEDTABLE は行コンテキストの中で使います');
        const c2 = { ...ctx, fc: this.transition(ctx), rows: [] };
        return this.evTable(a[0], c2);
      }
      case 'TOPN': {
        need(2, 'TOPN(件数, テーブル, 並べ替えの式, [DESC/ASC])');
        const k = toNum(S(0)); const tv = this.evTable(a[1], ctx);
        if (!a[2]) return { ...tv, rows: tv.rows.slice(0, k) };
        const asc = a[3] && this.ev(a[3], ctx)?.sym === 'ASC';
        const scored = this.iterate(tv, ctx, (c, r) => ({ r, s: this.scalar(this.ev(a[2], c)) }));
        scored.sort((x, y) => cmpv(x.s, y.s) * (asc ? 1 : -1));
        if (scored.length <= k) return { ...tv, rows: scored.map(x => x.r) };
        const cut = scored[k - 1].s;
        return { ...tv, rows: scored.filter((x, i) => i < k || cmpv(x.s, cut) === 0).map(x => x.r) };
      }
      case 'ADDCOLUMNS': {
        need(3, 'ADDCOLUMNS(テーブル, "列名", 式, …)');
        const tv = this.evTable(a[0], ctx); const names = [];
        for (let k = 1; k < a.length; k += 2) names.push('|' + str(S(k)));
        return { cols: [...tv.cols, ...names], lin: undefined, rows: tv.rows.map(r => { const v = { ...r.v }; for (let k = 1; k < a.length; k += 2) v['|' + str(S(k))] = this.scalar(this.ev(a[k + 1], { ...ctx, rows: [...ctx.rows, r] })); return { v, lin: r.lin }; }) };
      }
      case 'SELECTCOLUMNS': {
        const tv = this.evTable(a[0], ctx); const names = [];
        for (let k = 1; k < a.length; k += 2) names.push('|' + str(S(k)));
        return { cols: names, rows: tv.rows.map(r => { const v = {}; for (let k = 1; k < a.length; k += 2) v['|' + str(S(k))] = this.scalar(this.ev(a[k + 1], { ...ctx, rows: [...ctx.rows, r] })); return { v, lin: {} }; }) };
      }
      case 'SUMMARIZE': {
        need(2, 'SUMMARIZE(テーブル, 表名[列名], …)');
        const tv = this.evTable(a[0], ctx);
        const gcols = []; let k = 1;
        while (k < a.length && a[k].t === 'col') { this.checkCol(a[k].table, a[k].name); gcols.push(a[k]); k++; }
        const seen = new Map();
        for (const r of tv.rows) {
          const vals = gcols.map(g => this.rv(r, g.table, g.name) !== undefined ? this.rv(r, g.table, g.name) : this.call({ f: 'RELATED', args: [g] }, { ...ctx, rows: [r] }));
          const kk = vals.map(key).join(SEP);
          if (!seen.has(kk)) { const v = {}; gcols.forEach((g, i) => { v[g.table + '|' + g.name] = vals[i]; }); seen.set(kk, { v, lin: {} }); }
        }
        let out = { cols: gcols.map(g => g.table + '|' + g.name), rows: [...seen.values()] };
        if (k < a.length) out = this.call({ f: 'ADDCOLUMNS', args: [{ t: '__tv', tv: out }, ...a.slice(k)] }, ctx);
        return out;
      }
      case 'GENERATESERIES': { const s = toNum(S(0)), e = toNum(S(1)), st = a[2] ? toNum(S(2)) : 1; const rows = []; for (let x = s; x <= e + 1e-9; x += st) rows.push({ v: { '|Value': x }, lin: {} }); return { cols: ['|Value'], rows }; }
      case 'TREATAS': {
        const tv = this.evTable(a[0], ctx); const cs = this.colArgs(a.slice(1), 'TREATAS');
        return { cols: cs.map(c => c.table + '|' + c.name), rows: tv.rows.map(r => { const v = {}; cs.forEach((c, i) => { const [t0, c0] = tv.cols[i].split('|'); v[c.table + '|' + c.name] = this.rv(r, t0, c0); }); return { v, lin: {} }; }) };
      }
      // タイムインテリジェンス
      case 'DATESYTD': return this.dateTable(this.ytd(this.visDates(ctx, a[0]), a[1] ? S(1) : null));
      case 'DATESMTD': return this.dateTable(this.ytd(this.visDates(ctx, a[0]), null, 'MONTH'));
      case 'DATESQTD': return this.dateTable(this.ytd(this.visDates(ctx, a[0]), null, 'QUARTER'));
      case 'TOTALYTD': case 'TOTALMTD': case 'TOTALQTD': {
        need(2, `${F}(式, 日付テーブル[日付])`);
        const unit = F === 'TOTALMTD' ? 'MONTH' : F === 'TOTALQTD' ? 'QUARTER' : 'YEAR';
        let ye = null; const extra = [];
        for (const x of a.slice(2)) { if (x.t === 'lit' && typeof x.v === 'string') ye = x.v; else extra.push(x); }
        const dates = this.ytd(this.visDates(ctx, a[1]), ye, unit);
        const c2 = this.calculate(a[0], extra, ctx);
        let fc = c2.fc; for (const f of this.tableToFilters(this.dateTable(dates))) fc = this.addFilter(fc, f);
        return this.scalar(this.ev(a[0], { ...c2, fc }));
      }
      case 'SAMEPERIODLASTYEAR': return this.dateTable(this.shift(this.visDates(ctx, a[0]), -1, 'YEAR'));
      case 'DATEADD': { need(3, 'DATEADD(日付テーブル[日付], 数, MONTH)'); const u = this.ev(a[2], ctx)?.sym; if (!u) throw err('DATEADD の3つ目の引数は DAY / MONTH / QUARTER / YEAR です'); return this.dateTable(this.shift(this.visDates(ctx, a[0]), toNum(S(1)), u)); }
      case 'PARALLELPERIOD': {
        const u = this.ev(a[2], ctx)?.sym; const ds = this.visDates(ctx, a[0]); if (!ds.length) return this.dateTable([]);
        const n0 = toNum(S(1)); const months = u === 'YEAR' ? 12 : u === 'QUARTER' ? 3 : 1;
        const first = ds[0], last = ds[ds.length - 1];
        const sm = u === 'YEAR' ? 1 : u === 'QUARTER' ? Math.floor((first.m - 1) / 3) * 3 + 1 : first.m;
        const em = u === 'YEAR' ? 12 : u === 'QUARTER' ? Math.floor((last.m - 1) / 3) * 3 + 3 : last.m;
        const s = new Date(Date.UTC(first.y, sm - 1 + n0 * months, 1)), e = new Date(Date.UTC(last.y, em + n0 * months, 0));
        return this.dateTable(this.allDates().filter(d => d.ms >= s.getTime() && d.ms <= e.getTime()));
      }
      case 'PREVIOUSMONTH': case 'NEXTMONTH': case 'PREVIOUSYEAR': case 'PREVIOUSQUARTER': {
        const ds = this.visDates(ctx, a[0]); if (!ds.length) return this.dateTable([]);
        const ref = F === 'NEXTMONTH' ? ds[ds.length - 1] : ds[0];
        let s, e;
        if (F === 'PREVIOUSYEAR') { s = Date.UTC(ref.y - 1, 0, 1); e = Date.UTC(ref.y - 1, 11, 31); }
        else if (F === 'PREVIOUSQUARTER') { const q0 = Math.floor((ref.m - 1) / 3) * 3; s = Date.UTC(ref.y, q0 - 3, 1); e = Date.UTC(ref.y, q0, 0); }
        else { const off = F === 'NEXTMONTH' ? 1 : -1; s = Date.UTC(ref.y, ref.m - 1 + off, 1); e = Date.UTC(ref.y, ref.m + off, 0); }
        return this.dateTable(this.allDates().filter(d => d.ms >= s && d.ms <= e));
      }
      case 'DATESBETWEEN': { const s = S(1), e = S(2); return this.dateTable(this.allDates().filter(d => (s == null || d.ms >= s.ms) && (e == null || d.ms <= e.ms))); }
      case 'DATESINPERIOD': {
        need(4, 'DATESINPERIOD(日付テーブル[日付], 基準日, 数, MONTH)');
        const end = S(1); if (!end) return this.dateTable([]);
        const nn = toNum(S(2)); const u = this.ev(a[3], ctx)?.sym;
        const other = u === 'DAY' ? new DDate(end.ms + nn * DAY) : this.shift([end], nn, u)[0];
        const [lo, hi] = nn < 0 ? [other.ms + DAY, end.ms] : [end.ms, other.ms - DAY];
        return this.dateTable(this.allDates().filter(d => d.ms >= lo && d.ms <= hi));
      }
      case 'FIRSTDATE': case 'LASTDATE': { const ds = this.visDates(ctx, a[0]); return this.dateTable(ds.length ? [F === 'FIRSTDATE' ? ds[0] : ds[ds.length - 1]] : []); }
      // 論理・情報
      case 'IF': { need(2, 'IF(条件, 真のとき, [偽のとき])'); return truthy(S(0)) ? S(1) : a[2] ? S(2) : null; }
      case 'IFERROR': { try { const v = S(0); if (typeof v === 'number' && !isFinite(v)) return S(1); return v; } catch (e) { if (e instanceof DaxErr) return S(1); throw e; } }
      case 'SWITCH': {
        need(3, 'SWITCH(式, 値1, 結果1, …, [その他])');
        const v = S(0);
        let k = 1;
        for (; k + 1 < a.length; k += 2) if (cmpv(v, S(k)) === 0 && (v !== true || S(k) === true)) return S(k + 1);
        return k < a.length ? S(k) : null;
      }
      case 'AND': need(2, 'AND(条件1, 条件2)'); return truthy(S(0)) && truthy(S(1));
      case 'OR': need(2, 'OR(条件1, 条件2)'); return truthy(S(0)) || truthy(S(1));
      case 'NOT': return !truthy(S(0));
      case 'TRUE': return true;
      case 'FALSE': return false;
      case 'BLANK': return null;
      case 'ISBLANK': return S(0) == null;
      case 'COALESCE': { for (let k = 0; k < a.length; k++) { const v = S(k); if (v != null) return v; } return null; }
      case 'ISFILTERED': {
        if (a[0].t === 'col') return ctx.fc.some(f => f.t === a[0].table && f.cols && f.cols.includes(a[0].name));
        return ctx.fc.some(f => f.t === a[0].name);
      }
      case 'ISINSCOPE': { if (a[0].t !== 'col') throw err('ISINSCOPE には 表名[列名] を指定します'); return (ctx.axis || this.axis || []).includes(a[0].table + '|' + a[0].name) && ctx.fc.some(f => f.t === a[0].table && f.cols && f.cols.includes(a[0].name)); }
      case 'HASONEVALUE': { const tv = this.call({ f: 'VALUES', args: a }, ctx); return tv.rows.length === 1; }
      case 'SELECTEDVALUE': { const tv = this.call({ f: 'VALUES', args: [a[0]] }, ctx); if (tv.rows.length === 1) return this.rv(tv.rows[0], a[0].table, a[0].name); return a[1] ? S(1) : null; }
      // 数学
      case 'DIVIDE': { need(2, 'DIVIDE(分子, 分母, [代替値])'); const x = S(0), y = S(1); if (y == null || toNum(y) === 0) return a[2] ? S(2) : null; if (x == null) return null; return toNum(x) / toNum(y); }
      case 'ROUND': return round(toNum(S(0)), a[1] ? toNum(S(1)) : 0);
      case 'ROUNDUP': { const d = 10 ** toNum(S(1) ?? 0); const v = toNum(S(0)); return Math.sign(v) * Math.ceil(Math.abs(v) * d - 1e-9) / d; }
      case 'ROUNDDOWN': { const d = 10 ** toNum(S(1) ?? 0); const v = toNum(S(0)); return Math.sign(v) * Math.floor(Math.abs(v) * d + 1e-9) / d; }
      case 'INT': return Math.floor(toNum(S(0)));
      case 'ABS': return Math.abs(toNum(S(0)));
      case 'MOD': return toNum(S(0)) % toNum(S(1));
      case 'SQRT': return Math.sqrt(toNum(S(0)));
      case 'POWER': return toNum(S(0)) ** toNum(S(1));
      case 'VALUE': return toNum(S(0));
      // テキスト
      case 'FORMAT': return format(S(0), str(S(1)));
      case 'CONCATENATE': return str(S(0)) + str(S(1));
      case 'LEFT': return str(S(0)).slice(0, a[1] ? toNum(S(1)) : 1);
      case 'RIGHT': { const s = str(S(0)); const k = a[1] ? toNum(S(1)) : 1; return s.slice(Math.max(0, s.length - k)); }
      case 'MID': return str(S(0)).substr(toNum(S(1)) - 1, toNum(S(2)));
      case 'LEN': return str(S(0)).length;
      case 'UPPER': return str(S(0)).toUpperCase();
      case 'LOWER': return str(S(0)).toLowerCase();
      case 'TRIM': return str(S(0)).trim().replace(/\s+/g, ' ');
      case 'CONTAINSSTRING': return str(S(0)).toLowerCase().includes(str(S(1)).toLowerCase());
      case 'SEARCH': { const i = str(S(1)).toLowerCase().indexOf(str(S(0)).toLowerCase()); if (i < 0) { if (a[3]) return S(3); throw err('SEARCH: 文字列が見つかりません'); } return i + 1; }
      case 'SUBSTITUTE': return str(S(0)).split(str(S(1))).join(str(S(2)));
      case 'REPT': return str(S(0)).repeat(toNum(S(1)));
      case 'UNICHAR': return String.fromCodePoint(toNum(S(0)));
      // 日付
      case 'DATE': return ddate(toNum(S(0)), toNum(S(1)), toNum(S(2)));
      case 'YEAR': { const d = S(0); return d ? asDate(d).y : null; }
      case 'MONTH': { const d = S(0); return d ? asDate(d).m : null; }
      case 'DAY': { const d = S(0); return d ? asDate(d).d : null; }
      case 'QUARTER': { const d = S(0); return d ? Math.ceil(asDate(d).m / 3) : null; }
      case 'WEEKDAY': { const d = S(0); if (!d) return null; const w = new Date(asDate(d).ms).getUTCDay(); const t = a[1] ? toNum(S(1)) : 1; return t === 2 ? (w + 6) % 7 + 1 : t === 3 ? (w + 6) % 7 : w + 1; }
      case 'EOMONTH': { const d = asDate(S(0)); const k = toNum(S(1)); return new DDate(Date.UTC(d.y, d.m + k, 0)); }
      case 'EDATE': { const d = asDate(S(0)); return this.shift([d], toNum(S(1)), 'MONTH')[0]; }
      case 'DATEDIFF': { const s = asDate(S(0)), e = asDate(S(1)); const u = this.ev(a[2], ctx)?.sym; if (u === 'DAY') return Math.round((e.ms - s.ms) / DAY); if (u === 'MONTH') return (e.y - s.y) * 12 + e.m - s.m; if (u === 'YEAR') return e.y - s.y; if (u === 'QUARTER') return Math.floor(((e.y - s.y) * 12 + e.m - s.m) / 3); throw err('DATEDIFF の単位は DAY / MONTH / QUARTER / YEAR'); }
      case 'TODAY': return ddate(2026, 6, 30);
      case 'USERPRINCIPALNAME': case 'USERNAME': return 'user@contoso.co.jp';
      case '__TV': return n.tv;
    }
    if (F === 'TOTALSALES' || /^[A-Z]+$/.test(F)) throw err(`${n.raw} という関数は（このアプリでは）使えません。つづりを確認してください`);
    throw err(`${n.raw} という関数はありません`);
  }
  relPath(from, to) {
    const q = [[from, []]]; const seen = new Set([from]);
    while (q.length) {
      const [x, path] = q.shift();
      if (x === to) return path;
      for (const r of this.m.rels) if (r.from === x && !seen.has(r.to)) { seen.add(r.to); q.push([r.to, [...path, r]]); }
    }
    return null;
  }
}
// __tv ノード（内部用）
const _ev = Engine.prototype.ev;
Engine.prototype.ev = function (n, ctx) { if (n.t === '__tv') return n.tv; return _ev.call(this, n, ctx); };

function groupCols(keys) { const o = {}; for (const k of keys) { const [t, c] = k.split('|'); (o[t] ||= []).push(c); } return o; }
const truthy = v => v === true || (typeof v === 'number' && v !== 0) || (typeof v === 'string' && v !== '');
const num = v => { if (typeof v !== 'number') throw err(`数値が必要な場所にテキスト "${v}" があります`); return v; };
function toNum(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof DDate) return v.ms / DAY + 25569;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(+v)) return +v;
  throw err(`テキスト "${v}" を数値として計算できません`);
}
function asDate(v) { if (v instanceof DDate) return v; throw err('日付が必要です'); }
function str(v) {
  if (v == null) return '';
  if (v instanceof DDate) return `${v.y}/${v.m}/${v.d}`;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(+v.toPrecision(15));
  return String(v);
}
function cmpv(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) a = typeof b === 'string' ? '' : b instanceof DDate ? new DDate(-Infinity) : typeof b === 'boolean' ? false : 0;
  if (b == null) b = typeof a === 'string' ? '' : a instanceof DDate ? new DDate(-Infinity) : typeof a === 'boolean' ? false : 0;
  if (a instanceof DDate && b instanceof DDate) return a.ms - b.ms;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9 ? 0 : a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
  if (typeof a === 'string' && typeof b === 'string') { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }
  if ((typeof a === 'number' && typeof b === 'string') || (typeof a === 'string' && typeof b === 'number'))
    throw err(`数値とテキストは比較できません（${str(a)} と "${str(b)}"）。数値なら " " で囲まないで書きます`);
  if (a instanceof DDate || b instanceof DDate) throw err('日付と日付以外は比較できません。日付は DATE(2025, 4, 1) のように書きます');
  return 0;
}
function round(v, d) { const f = 10 ** d; const x = v * f; return Math.sign(x) * Math.round(Math.abs(x) + 1e-9) / f; }
export function format(v, f) {
  if (v == null) return '';
  if (v instanceof DDate) {
    return f.replace(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|q/gi, t => {
      const lt = t.toLowerCase();
      return { yyyy: v.y, yy: String(v.y).slice(2), mmmm: v.m + '月', mmm: v.m + '月', mm: String(v.m).padStart(2, '0'), m: v.m, dddd: '日月火水木金土'[new Date(v.ms).getUTCDay()] + '曜日', ddd: '日月火水木金土'[new Date(v.ms).getUTCDay()], dd: String(v.d).padStart(2, '0'), d: v.d, q: Math.ceil(v.m / 3) }[lt];
    });
  }
  if (typeof v === 'number') {
    const pct = f.includes('%');
    const x = pct ? v * 100 : v;
    const dec = (f.split('.')[1] || '').replace(/[^0#]/g, '').length;
    let s = round(x, dec).toFixed(dec);
    if (f.includes(',')) { const [ip, fp] = s.split('.'); s = Number(ip).toLocaleString('en-US') + (fp ? '.' + fp : ''); }
    const prefix = (f.match(/^[^0#,.]*/) || [''])[0].replace(/"/g, '');
    return prefix + s + (pct ? '%' : '');
  }
  return str(v);
}

// ---------- ビジュアル（マトリックス）の計算 ----------
// spec: { rows: "表|列", cols?: "表|列", measures: [名], slicers?: [{col:"表|列", values:[…]}], sort?: "表|列" }
export function matrix(engine, spec) {
  engine.steps = 0;
  const slicerFc = (spec.slicers || []).map(s => { const [t, c] = s.col.split('|'); return { t, cols: [c], keys: new Set(s.values.map(key)) }; });
  engine.slicerFc = slicerFc;
  engine.axis = [spec.rows, spec.cols].filter(Boolean);
  const axisVals = colKey => {
    if (!colKey) return [undefined];
    const [t, c] = colKey.split('|');
    const tb = engine.table(t);
    const vals = new Map();
    for (const i of engine.visible(t, slicerFc)) { const v = tb.rows[i][c]; vals.set(key(v), v); }
    let list = [...vals.values()];
    const sortCol = spec.sortBy?.[colKey];
    if (sortCol) { const order = new Map(); tb.rows.forEach(r => { if (!order.has(key(r[c]))) order.set(key(r[c]), r[sortCol]); }); list.sort((x, y) => cmpv(order.get(key(x)), order.get(key(y)))); }
    else list.sort((x, y) => cmpv(x, y));
    return list;
  };
  const fcFor = (rv, cv) => {
    let fc = slicerFc;
    if (rv !== undefined) { const [t, c] = spec.rows.split('|'); fc = [...fc, { t, cols: [c], keys: new Set([key(rv)]) }]; }
    if (cv !== undefined) { const [t, c] = spec.cols.split('|'); fc = [...fc, { t, cols: [c], keys: new Set([key(cv)]) }]; }
    return fc;
  };
  const cellv = (m, fc) => {
    try { return engine.measureRef(m, { fc, rows: [], vars: new Map() }); }
    catch (e) { if (e instanceof DaxErr) return { error: e.message }; throw e; }
  };
  const rowVals = spec.rows ? axisVals(spec.rows) : [];
  const colVals = axisVals(spec.cols);
  const rows = [];
  for (const rv of rowVals) {
    const cells = colVals.map(cv => spec.measures.map(m => cellv(m, fcFor(rv, cv))));
    if (cells.flat().every(v => v == null)) continue;   // すべて空白の行は表示しない（Power BI と同じ）
    rows.push({ label: rv, cells });
  }
  const total = colVals.map(cv => spec.measures.map(m => cellv(m, fcFor(undefined, cv))));
  const colTotal = spec.cols ? spec.measures.map(m => cellv(m, fcFor(undefined, undefined))) : null;
  const rowTotals = spec.cols ? rows.map(r => spec.measures.map(m => cellv(m, fcFor(r.label, undefined)))) : null;
  engine.axis = [];
  return { rows, colVals: spec.cols ? colVals : null, total, colTotal, rowTotals, measures: spec.measures };
}
export function displayVal(v, fmt) {
  if (v == null) return '';
  if (v && v.error) return '⚠';
  if (v instanceof DDate) return `${v.y}/${String(v.m).padStart(2, '0')}/${String(v.d).padStart(2, '0')}`;
  if (typeof v === 'number') {
    if (!isFinite(v)) return isNaN(v) ? 'NaN' : v > 0 ? '∞' : '-∞';
    if (fmt) return format(v, fmt);
    return Number.isInteger(v) ? v.toLocaleString('en-US') : (+v.toFixed(4)).toLocaleString('en-US', { maximumFractionDigits: 4 });
  }
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return String(v);
}
export const labelOf = v => typeof v === 'number' ? String(v) : displayVal(v) || '（空白）';
export const sameVal = (a, b) => {
  if (a && a.error) return !!(b && b.error);
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === 'number' && typeof b === 'number') return (isNaN(a) && isNaN(b)) || Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
  if (a instanceof DDate && b instanceof DDate) return a.ms === b.ms;
  return a === b;
};
export function cloneModel(m) {
  return { ...m, tables: Object.fromEntries(Object.entries(m.tables).map(([k, t]) => [k, { cols: [...t.cols], rows: t.rows.map(r => ({ ...r })) }])) };
}
