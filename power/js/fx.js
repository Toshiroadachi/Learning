// Power Fx（Power Apps キャンバスアプリの数式）のミニ実行エンジン（学習用サブセット）
// テーブル = レコード（オブジェクト）の配列。コントロールのプロパティ・変数・コレクション・Patch なども再現する。

export class FxErr extends Error {}
const err = m => new FxErr(m);
export class FxDate { constructor(ms, time = false) { this.ms = ms; this.time = time; } }
const isRec = v => v != null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const isTable = Array.isArray;
const DAY = 86400000;

// ---------- 字句解析 ----------
function lex(src) {
  const t = []; let i = 0; const n = src.length;
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    const p = i;
    const readStr = () => {
      let s = ''; i++;
      for (;;) { if (i >= n) throw err('文字列の " が閉じていません'); if (src[i] === '"') { if (src[i + 1] === '"') { s += '"'; i += 2; continue; } i++; break; } s += src[i++]; }
      return s;
    };
    if (c === '$' && src[i + 1] === '"') {
      i++; const parts = []; let s = ''; i++;
      for (;;) {
        if (i >= n) throw err('文字列の " が閉じていません');
        if (src[i] === '"') { if (src[i + 1] === '"') { s += '"'; i += 2; continue; } i++; break; }
        if (src[i] === '{') { if (src[i + 1] === '{') { s += '{'; i += 2; continue; } parts.push(s); s = ''; let d = 1, j = i + 1; for (; j < n && d; j++) { if (src[j] === '{') d++; else if (src[j] === '}') d--; } parts.push({ code: src.slice(i + 1, j - 1) }); i = j; continue; }
        if (src[i] === '}' && src[i + 1] === '}') { s += '}'; i += 2; continue; }
        s += src[i++];
      }
      parts.push(s);
      t.push({ k: 'interp', v: parts, p }); continue;
    }
    if (c === '"') { t.push({ k: 'str', v: readStr(), p }); continue; }
    if (c === '“' || c === '”') throw err('全角の “ ” が入っています。半角の " を使ってください');
    if (c === "'") { const e = src.indexOf("'", i + 1); if (e < 0) throw err("名前の ' が閉じていません"); t.push({ k: 'id', v: src.slice(i + 1, e), p, q: true }); i = e + 1; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) { const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i)); t.push({ k: 'num', v: Number(m[0]), p }); i += m[0].length; continue; }
    if (/[A-Za-z_À-￿]/.test(c) && !/[　-〿！-／：-＠]/.test(c)) {
      let s = ''; while (i < n && /[A-Za-z0-9_À-￿]/.test(src[i]) && !/[　-〿！-／：-＠]/.test(src[i])) s += src[i++];
      t.push({ k: 'id', v: s, p }); continue;
    }
    const two = src.slice(i, i + 2);
    if (['<>', '<=', '>=', '&&', '||'].includes(two)) { t.push({ k: 'op', v: two, p }); i += 2; continue; }
    if ('+-*/^&=<>!()[]{},;.:@%'.includes(c)) { t.push({ k: 'op', v: c, p }); i++; continue; }
    if ('，（）；＝'.includes(c)) throw err(`全角の記号「${c}」が入っています。半角で入力してください`);
    throw err(`使えない文字があります: 「${c}」`);
  }
  t.push({ k: 'eof', p: n });
  return t;
}

// ---------- 構文解析 ----------
export function parse(src) {
  if (!String(src).trim()) return { t: 'lit', v: null };
  const toks = lex(src); let i = 0;
  const pk = (o = 0) => toks[i + o], nx = () => toks[i++];
  const isOp = v => pk().k === 'op' && pk().v === v;
  const isWord = v => pk().k === 'id' && !pk().q && pk().v === v;
  const near = tk => `（「${src.slice(tk.p, tk.p + 14)}」付近）`;
  const expect = v => { if (!isOp(v)) throw err(`「${v}」が必要です${near(pk())}`); nx(); };
  function chain() {
    const items = [expr()];
    while (isOp(';')) { nx(); if (pk().k === 'eof') break; items.push(expr()); }
    return items.length === 1 ? items[0] : { t: 'chain', items };
  }
  const expr = () => orE();
  const bin = (next, ops) => () => {
    let l = next();
    for (;;) {
      const t = pk();
      const v = (t.k === 'op' || (t.k === 'id' && !t.q)) ? t.v : null;
      const op = { Or: '||', And: '&&' }[v] || v;
      if (!v || !ops.includes(v)) return l;
      nx(); l = { t: 'bin', op, l, r: next() };
    }
  };
  function notE() { if (isOp('!') || isWord('Not')) { if (isWord('Not') && pk(1).k === 'op' && pk(1).v === '(') return cmpE(); nx(); return { t: 'not', e: notE() }; } return cmpE(); }
  function unary() { if (isOp('-')) { nx(); return { t: 'neg', e: unary() }; } if (isOp('+')) { nx(); return unary(); } return postfix(); }
  const pow = bin(unary, ['^']);
  const mul = bin(pow, ['*', '/']);
  const add = bin(mul, ['+', '-']);
  const cat = bin(add, ['&']);
  const inE = bin(cat, ['in', 'exactin']);
  const cmpE = bin(inE, ['=', '<>', '<', '>', '<=', '>=']);
  const andE = bin(notE, ['&&', 'And']);
  const orE = bin(andE, ['||', 'Or']);
  function postfix() {
    let e = primary();
    for (;;) {
      if (isOp('.')) {
        nx(); const t = nx();
        if (t.k !== 'id') throw err(`「.」の後に名前が必要です${near(t)}`);
        e = { t: 'dot', o: e, name: t.v }; continue;
      }
      if (isOp('%')) { nx(); e = { t: 'bin', op: '/', l: e, r: { t: 'lit', v: 100 } }; continue; }
      return e;
    }
  }
  function primary() {
    const t = nx();
    if (t.k === 'num') return { t: 'lit', v: t.v };
    if (t.k === 'str') return { t: 'lit', v: t.v };
    if (t.k === 'interp') return { t: 'interp', parts: t.v.map(p => typeof p === 'string' ? p : parse(p.code)) };
    if (t.k === 'op' && t.v === '(') { const e = chain(); expect(')'); return e; }
    if (t.k === 'op' && t.v === '{') {
      const fields = [];
      while (!isOp('}')) {
        const ft = nx(); if (ft.k !== 'id' && ft.k !== 'str') throw err(`レコードのフィールド名が必要です${near(ft)}`);
        if (!isOp(':')) throw err(`レコードは {名前: 値} の形で書きます（「:」が必要）${near(pk())}`);
        nx(); fields.push([ft.v, expr()]);
        if (isOp(',')) nx(); else if (!isOp('}')) throw err(`レコードの区切り「,」か「}」が必要です${near(pk())}`);
      }
      nx(); return { t: 'rec', fields };
    }
    if (t.k === 'op' && t.v === '[') {
      const items = [];
      while (!isOp(']')) { items.push(expr()); if (isOp(',')) nx(); else if (!isOp(']')) throw err(`テーブル [ ] の区切りは「,」です${near(pk())}`); }
      nx(); return { t: 'arr', items };
    }
    if (t.k === 'id') {
      if (!t.q && t.v === 'true') return { t: 'lit', v: true };
      if (!t.q && t.v === 'false') return { t: 'lit', v: false };
      if (!t.q && isOp('(')) {
        nx(); const args = [];
        while (!isOp(')')) {
          let a = expr();
          if (isWord('As')) { nx(); const nm = nx(); a = { t: 'as', e: a, name: nm.v }; }
          args.push(a);
          if (isOp(',')) nx(); else if (!isOp(')')) throw err(pk().k === 'eof' ? `${t.v}( のカッコが閉じていません。最後に ) を付けてください` : `関数の引数の区切り「,」か「)」が必要です${near(pk())}`);
        }
        nx(); return { t: 'call', f: t.v, args };
      }
      return { t: 'id', name: t.v, q: t.q };
    }
    if (t.k === 'eof') throw err('式が途中で終わっています（カッコの閉じ忘れ？）');
    throw err(`ここに「${t.v}」は書けません${near(t)}`);
  }
  const e = chain();
  if (pk().k !== 'eof') throw err(`式の後ろに余分な文字があります${near(pk())}（動作の式を続けるときは「;」で区切ります）`);
  return e;
}

// ---------- 値の補助 ----------
export const typeName = v => v == null ? '空白' : typeof v === 'number' ? '数値' : typeof v === 'string' ? 'テキスト' : typeof v === 'boolean' ? 'ブール値' : v instanceof FxDate ? '日付' : isTable(v) ? 'テーブル' : v.__ctl ? 'コントロール' : 'レコード';
const toNum = v => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') { const s = v.replace(/,/g, '').trim(); if (s !== '' && !isNaN(+s)) return +s; throw err(`テキスト "${v}" を数値に変換できません。Value("…") で変換するか、数値の列を使ってください`); }
  if (v instanceof FxDate) return v.ms;
  throw err(`${typeName(v)} は数値として使えません`);
};
const toStr = v => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(+v.toPrecision(15));
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof FxDate) return fmtDate(v, v.time ? 'yyyy/mm/dd hh:mm' : 'yyyy/mm/dd');
  if (isTable(v)) throw err('テーブルはテキストとして使えません（Concat(テーブル, 列, ", ") などを使います）');
  if (isRec(v)) throw err('レコードはテキストとして使えません。.列名 で値を取り出します（例: Gallery1.Selected.件名）');
  return String(v);
};
const toBool = v => {
  if (typeof v === 'boolean') return v;
  if (v == null) return false;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') { if (v === 'true') return true; if (v === 'false' || v === '') return false; }
  throw err(`${typeName(v)} は true/false として使えません`);
};
export function eq(a, b) {
  if (a == null || a === '') return b == null || b === '';
  if (b == null || b === '') return false;
  if (a instanceof FxDate && b instanceof FxDate) return a.ms === b.ms;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (typeof a !== typeof b) {
    if ((typeof a === 'number' && typeof b === 'string') || (typeof a === 'string' && typeof b === 'number')) throw err(`数値とテキストは比較できません（${toStr(a)} と "${toStr(b)}"）`);
    return false;
  }
  if (isRec(a) && isRec(b)) return deepEq(a, b);
  return a === b;
}
export function deepEq(a, b) {
  if (a == null || a === '') return b == null || b === '';
  if (b == null || b === '') return false;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (a instanceof FxDate && b instanceof FxDate) return a.ms === b.ms;
  if (isTable(a) && isTable(b)) return a.length === b.length && a.every((x, i) => deepEq(x, b[i]));
  if (isRec(a) && isRec(b)) {
    const ka = Object.keys(a).filter(k => !k.startsWith('__')), kb = Object.keys(b).filter(k => !k.startsWith('__'));
    if (ka.length !== kb.length) return false;
    return ka.every(k => deepEq(a[k], b[k]));
  }
  return a === b;
}
function cmp(a, b) {
  if (a instanceof FxDate && b instanceof FxDate) return a.ms - b.ms;
  if (a == null && b == null) return 0;
  if (typeof a === 'string' || typeof b === 'string') {
    if ((typeof a === 'number') || (typeof b === 'number')) throw err(`数値とテキストは大小比較できません（${toStr(a)} と "${toStr(b)}"）`);
    const x = toStr(a), y = toStr(b); return x.localeCompare(y, 'ja');
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
  return toNum(a) - toNum(b);
}
export const fxdate = (y, m, d) => new FxDate(Date.UTC(y, m - 1, d));
const ymd = d => { const x = new Date(d.ms); return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate(), x.getUTCHours(), x.getUTCMinutes()]; };
function fmtDate(d, f) {
  const [y, m, dd, hh, mi] = ymd(d); const wd = new Date(d.ms).getUTCDay();
  let prevH = false;
  return f.replace(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|nn|ss/gi, t => {
    const l = t.toLowerCase();
    if ((l === 'mm' || l === 'm') && prevH) { prevH = false; return l === 'mm' ? String(mi).padStart(2, '0') : mi; }
    prevH = l === 'hh' || l === 'h';
    return { yyyy: y, yy: String(y).slice(2), mmmm: m + '月', mmm: m + '月', mm: String(m).padStart(2, '0'), m, dddd: '日月火水木金土'[wd] + '曜日', ddd: '日月火水木金土'[wd], dd: String(dd).padStart(2, '0'), d: dd, hh: String(hh).padStart(2, '0'), h: hh, nn: String(mi).padStart(2, '0'), ss: '00' }[l];
  });
}
function fmtNum(v, f) {
  const fmt = f.replace(/\[\$-[^\]]*\]/g, '');
  const pct = fmt.includes('%');
  const x = pct ? v * 100 : v;
  const dec = (fmt.split('.')[1] || '').replace(/[^0#]/g, '').length;
  let s = (Math.round(x * 10 ** dec) / 10 ** dec).toFixed(dec);
  if (fmt.includes(',')) { const [ip, fp] = s.split('.'); s = Number(ip).toLocaleString('en-US') + (fp ? '.' + fp : ''); }
  const pre = (fmt.match(/^[^0#,.]*/) || [''])[0].replace(/"/g, '');
  const post = (fmt.match(/[^0#,.%]*$/) || [''])[0].replace(/"/g, '');
  return pre + s + (pct ? '%' : '') + post;
}
const one = t => isTable(t) ? t : [t];
const colTable = (vals, name = 'Value') => vals.map(v => isRec(v) ? v : { [name]: v });

// ---------- 定数 ----------
const ENUMS = {
  Color: { Red: '#e81123', Blue: '#0078d4', Green: '#107c10', Black: '#000000', White: '#ffffff', Gray: '#808080', Orange: '#ff8c00', Yellow: '#ffb900', Purple: '#5c2d91', LightGray: '#d3d3d3', DarkGreen: '#006400', Transparent: 'transparent', LightBlue: '#add8e6', Pink: '#ffc0cb', DarkRed: '#8b0000' },
  SortOrder: { Ascending: 'Ascending', Descending: 'Descending' },
  NotificationType: { Success: 'Success', Error: 'Error', Warning: 'Warning', Information: 'Information' },
  TimeUnit: { Days: 'Days', Months: 'Months', Years: 'Years', Hours: 'Hours', Minutes: 'Minutes', Quarters: 'Quarters' },
  DisplayMode: { Edit: 'Edit', View: 'View', Disabled: 'Disabled' },
  ScreenTransition: { None: 'None', Fade: 'Fade', Cover: 'Cover', UnCover: 'UnCover', CoverRight: 'CoverRight' },
  StartOfWeek: { Sunday: 1, Monday: 2 },
  DateTimeFormat: { ShortDate: 'yyyy/mm/dd', LongDate: 'yyyy年m月d日', ShortTime: 'hh:mm' },
  Align: { Left: 'Left', Center: 'Center', Right: 'Right' },
  FontWeight: { Normal: 'Normal', Bold: 'Bold', Semibold: 'Semibold' },
};

// ---------- アプリの状態 ----------
// def: { data: {名前: rows}, screens: [{name, controls:[…]}], delegable: [データソース名] }
export class App {
  constructor(def, today) {
    this.def = def;
    this.today = today || (() => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); })();
    this.reset();
  }
  reset() {
    const d = this.def;
    this.data = {}; for (const [k, rows] of Object.entries(d.data || {})) this.data[k] = rows.map(r => reviveRec(r));
    this.collections = {}; for (const [k, rows] of Object.entries(d.collections || {})) this.collections[k] = rows.map(r => reviveRec(r));
    this.globals = { ...(d.globals || {}) };
    this.ctxVars = {};
    this.screen = d.screens[0].name;
    this.nav = [];
    this.notes = [];
    this.state = {};   // コントロールの入力状態 {name: {Text, sel, Value…}}
    this.formulas = {}; // 上書きされたプロパティ "ctl.Prop" -> src
    this.astCache = new Map();
    this.ctlIndex = {};
    for (const s of d.screens) for (const c of walkCtls(s.controls)) this.ctlIndex[c.name] = { ...c, screen: s.name };
    this.evalDepth = 0;
  }
  setFormula(ctl, prop, src) { this.formulas[ctl + '.' + prop] = src; }
  propSrc(ctl, prop) {
    const k = ctl + '.' + prop;
    if (k in this.formulas) return this.formulas[k];
    const c = this.ctlIndex[ctl];
    return c?.props?.[prop];
  }
  ast(src) { if (!this.astCache.has(src)) this.astCache.set(src, parse(src)); return this.astCache.get(src); }
  evalProp(ctl, prop, extra = {}) {
    const src = this.propSrc(ctl, prop);
    if (src == null) return defaultProp(this.ctlIndex[ctl], prop);
    if (++this.evalDepth > 60) { this.evalDepth = 0; throw err(`${ctl}.${prop} が循環参照しています`); }
    try { return this.ev(this.ast(String(src)), { self: ctl, ...extra }); } finally { this.evalDepth--; }
  }
  run(src, extra = {}) { return this.ev(this.ast(src), { self: null, ...extra }); }
  ev(n, env) { return evalNode(n, { app: this, scopes: [], locals: [], ...env }); }
  ctxOf(screen = this.screen) { return (this.ctxVars[screen] ||= {}); }
  // 入力系コントロールの値
  ctlValue(name, prop) {
    const c = this.ctlIndex[name]; const st = this.state[name] || {};
    const items = () => { const v = this.evalProp(name, 'Items'); return v == null ? [] : isTable(v) ? v : one(v); };
    switch (c.type) {
      case 'TextInput': if (prop === 'Text' || prop === 'Value') return st.Text ?? toStr(this.evalProp(name, 'Default')); break;
      case 'Toggle': case 'Checkbox': if (prop === 'Value' || prop === 'Checked') return st.Value ?? toBool(this.evalProp(name, 'Default') ?? false); break;
      case 'Slider': if (prop === 'Value') return st.Value ?? toNum(this.evalProp(name, 'Default') ?? 0); break;
      case 'DatePicker': if (prop === 'SelectedDate' || prop === 'Value') return st.Value ?? this.evalProp(name, 'DefaultDate'); break;
      case 'Dropdown': case 'ComboBox': case 'Gallery': case 'ListBox': case 'RadioGroup': {
        if (prop === 'Selected' || prop === 'SelectedText') { const it = items(); const i = st.sel ?? (c.type === 'Gallery' || c.type === 'Dropdown' || c.type === 'RadioGroup' ? 0 : -1); return it[i] ?? null; }
        if (prop === 'SelectedItems') { const it = items(); return (st.sels || []).map(i => it[i]).filter(Boolean); }
        if (prop === 'AllItems') return items();
        if (prop === 'AllItemsCount') return items().length;
        break;
      }
    }
    return undefined;
  }
  snapshot() {
    const ctx = {}; for (const [s, v] of Object.entries(this.ctxVars)) if (Object.keys(v).length) ctx[s] = v;
    return { data: this.data, collections: this.collections, globals: this.globals, ctxVars: ctx, screen: this.screen, notes: this.notes.map(n => n.msg) };
  }
}
function reviveRec(r) {
  const o = {};
  for (const [k, v] of Object.entries(r)) o[k] = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new FxDate(Date.parse(v + 'T00:00:00Z')) : v;
  return o;
}
export function* walkCtls(list) { for (const c of list || []) { yield c; if (c.template) yield* walkCtls(c.template); if (c.children) yield* walkCtls(c.children); } }
function defaultProp(c, prop) {
  if (!c) return null;
  const D = { Visible: true, DisplayMode: 'Edit', Fill: null, Color: null, Text: '', Default: '', Items: [], X: 0, Y: 0, Size: 13 };
  return prop in D ? D[prop] : null;
}

// ---------- 評価 ----------
function lookupName(name, env) {
  const app = env.app;
  if (name === 'ThisItem') { if (env.thisItem === undefined) throw err('ThisItem はギャラリーの中のコントロールでだけ使えます'); return env.thisItem; }
  if (name === 'ThisRecord') { if (!env.scopes.length) throw err('ThisRecord は Filter や ForAll などの中で使います'); return env.scopes[env.scopes.length - 1].rec; }
  if (name === 'Self') { if (!env.self) throw err('Self はコントロールのプロパティでだけ使えます'); return ctlObj(env.self, env); }
  for (let k = env.locals.length - 1; k >= 0; k--) if (name in env.locals[k]) return env.locals[k][name];
  for (let k = env.scopes.length - 1; k >= 0; k--) {
    const s = env.scopes[k];
    if (s.name) { if (s.name === name) return s.rec; continue; }
    if (s.rec && isRec(s.rec) && name in s.rec) return s.rec[name];
  }
  if (env.thisItem && isRec(env.thisItem) && name in env.thisItem && !(name in app.data)) return env.thisItem[name];
  const cv = app.ctxOf();
  if (name in cv) return cv[name];
  if (name in app.globals) return app.globals[name];
  if (name in app.collections) return app.collections[name];
  if (name in app.data) return app.data[name];
  if (app.ctlIndex[name]) return ctlObj(name, env);
  if (app.def.screens.some(s => s.name === name)) return { __screen: name };
  if (name in ENUMS) return { __enum: name, ...ENUMS[name] };
  if (env.scopes.length) {
    const cols = Object.keys(env.scopes[env.scopes.length - 1].rec || {}).filter(c => !c.startsWith('__'));
    throw err(`名前が無効です。'${name}' が認識されません。（このテーブルの列: ${cols.join('、')}）`);
  }
  throw err(`名前が無効です。'${name}' が認識されません。（コントロール名・変数名・列名のつづりを確認）`);
}
function ctlObj(name, env) { return { __ctl: name, __env: env }; }
function member(o, name, env) {
  if (o == null) return null;
  if (o.__ctl) {
    const app = env.app; const c = app.ctlIndex[o.__ctl];
    const v = app.ctlValue(o.__ctl, name);
    if (v !== undefined) return v;
    if (name === 'Selected' || name === 'AllItems' || name === 'Text' || name === 'Value') {
      if (c.type === 'Label' || c.type === 'Button') return app.evalProp(o.__ctl, 'Text');
    }
    const inTemplate = env.thisItem !== undefined && isTemplateCtl(app, o.__ctl);
    return app.evalProp(o.__ctl, name, inTemplate ? { thisItem: env.thisItem } : {});
  }
  if (o.__enum) { if (!(name in o)) throw err(`${o.__enum}.${name} はありません（${Object.keys(ENUMS[o.__enum]).join(', ')}）`); return o[name]; }
  if (isTable(o)) {
    if (!o.length) return [];
    if (!o.some(r => isRec(r) && name in r)) throw err(`テーブルに列 '${name}' がありません`);
    return o.map(r => ({ Value: r[name] }));
  }
  if (isRec(o)) {
    if (!(name in o)) {
      const cols = Object.keys(o).filter(k => !k.startsWith('__'));
      if (o.Value !== undefined && cols.length === 1) throw err(`このレコードには '${name}' 列がありません。単一列の値は .Value で取り出します`);
      throw err(`レコードに '${name}' 列がありません（列: ${cols.join('、')}）`);
    }
    return o[name];
  }
  if (o instanceof FxDate) throw err('日付の年・月は Year(…) / Month(…) で取り出します');
  throw err(`${typeName(o)} に .${name} は使えません`);
}
function isTemplateCtl(app, name) {
  for (const s of app.def.screens) for (const c of walkCtls(s.controls)) if (c.template && [...walkCtls(c.template)].some(x => x.name === name)) return true;
  return false;
}

function evalNode(n, env) {
  switch (n.t) {
    case 'lit': return n.v;
    case 'interp': return n.parts.map(p => typeof p === 'string' ? p : toStr(evalNode(p, env))).join('');
    case 'id': return lookupName(n.name, env);
    case 'dot': return member(evalNode(n.o, env), n.name, env);
    case 'rec': { const o = {}; for (const [k, e] of n.fields) o[k] = evalNode(e, env); return o; }
    case 'arr': return n.items.map(e => { const v = evalNode(e, env); return isRec(v) ? v : { Value: v }; });
    case 'chain': { let v = null; for (const it of n.items) v = evalNode(it, env); return v; }
    case 'neg': return -toNum(evalNode(n.e, env));
    case 'not': return !toBool(evalNode(n.e, env));
    case 'as': throw err('As はテーブル関数の1つ目の引数で使います');
    case 'bin': {
      if (n.op === '&&') return toBool(evalNode(n.l, env)) && toBool(evalNode(n.r, env));
      if (n.op === '||') return toBool(evalNode(n.l, env)) || toBool(evalNode(n.r, env));
      const a = evalNode(n.l, env), b = evalNode(n.r, env);
      switch (n.op) {
        case '+': if (a instanceof FxDate) return new FxDate(a.ms + toNum(b) * DAY, a.time); if (typeof a === 'string' && isNaN(+a.replace(/,/g, '')) || typeof b === 'string' && isNaN(+b.replace(/,/g, ''))) throw err('テキストの結合には & を使います（+ は数値の足し算）'); return toNum(a) + toNum(b);
        case '-': if (a instanceof FxDate && b instanceof FxDate) return (a.ms - b.ms) / DAY; if (a instanceof FxDate) return new FxDate(a.ms - toNum(b) * DAY, a.time); return toNum(a) - toNum(b);
        case '*': return toNum(a) * toNum(b);
        case '/': { const d = toNum(b); if (d === 0) throw err('0 で割ることはできません'); return toNum(a) / d; }
        case '^': return toNum(a) ** toNum(b);
        case '&': return toStr(a) + toStr(b);
        case '=': return eq(a, b);
        case '<>': return !eq(a, b);
        case '<': return cmp(a, b) < 0;
        case '>': return cmp(a, b) > 0;
        case '<=': return cmp(a, b) <= 0;
        case '>=': return cmp(a, b) >= 0;
        case 'in': case 'exactin': {
          if (isTable(b)) return b.some(r => { const vals = isRec(r) ? Object.entries(r).filter(([k]) => !k.startsWith('__')).map(([, v]) => v) : [r]; return vals.length === 1 ? (n.op === 'in' && typeof vals[0] === 'string' && typeof a === 'string' ? vals[0].toLowerCase() === a.toLowerCase() : eq(vals[0], a)) : deepEq(r, a); });
          if (n.op === 'in') return toStr(b).toLowerCase().includes(toStr(a).toLowerCase());
          return toStr(b).includes(toStr(a));
        }
      }
      throw err('不明な演算子 ' + n.op);
    }
    case 'call': return callFn(n, env);
  }
  throw err('評価できない式です');
}

// テーブルの各行で式を評価するための環境
function rowEnv(env, rec, asName) { return { ...env, scopes: [...env.scopes, asName ? { name: asName, rec } : { rec }] }; }
function tableArg(n, env, fname) {
  const a = n.args[0];
  if (!a) throw err(`${fname} の1つ目の引数にテーブル（データソース名など）を指定します`);
  const node = a.t === 'as' ? a.e : a;
  const v = evalNode(node, env);
  if (v == null) return { rows: [], as: a.t === 'as' ? a.name : null };
  if (!isTable(v)) throw err(`${fname} の1つ目の引数はテーブルです（${typeName(v)} が指定されました）`);
  return { rows: v, as: a.t === 'as' ? a.name : null, srcName: node.t === 'id' ? node.name : null };
}
function sourceRef(n, env, fname) {
  const a = n.args[0];
  if (!a || a.t !== 'id') throw err(`${fname} の1つ目の引数はデータソース名かコレクション名です`);
  const app = env.app;
  if (a.name in app.collections) return { kind: 'col', name: a.name, rows: app.collections[a.name] };
  if (a.name in app.data) return { kind: 'data', name: a.name, rows: app.data[a.name] };
  return { kind: 'new', name: a.name };
}
function setSource(env, ref, rows) {
  if (ref.kind === 'data') env.app.data[ref.name] = rows; else env.app.collections[ref.name] = rows;
}
function matchRec(rows, target) {
  if (target && target.__idx != null) return rows.findIndex(r => r === target.__row);
  if (target && 'ID' in target) return rows.findIndex(r => eq(r.ID, target.ID));
  return rows.findIndex(r => deepEq(r, target));
}

function callFn(n, env) {
  const A = n.args, F = n.f;
  const E = i => evalNode(A[i], env);
  const need = (k, sig) => { if (A.length < k) throw err(`${F} の引数が足りません。書き方: ${sig}`); };
  const app = env.app;
  switch (F) {
    // --- テーブル ---
    case 'Filter': {
      need(2, 'Filter(テーブル, 条件1, [条件2]…)');
      const { rows, as } = tableArg(n, env, F);
      return rows.filter(r => A.slice(1).every(c => toBool(evalNode(c, rowEnv(env, r, as)))));
    }
    case 'Search': {
      need(3, 'Search(テーブル, 検索する文字, "列名1", ["列名2"]…)');
      const { rows } = tableArg(n, env, F);
      const q = toStr(E(1)).toLowerCase();
      const cols = A.slice(2).map((a, k) => { if (a.t !== 'lit' || typeof a.v !== 'string') throw err('Search の3つ目以降の引数は列名を " " で囲んで書きます（例: "件名"）'); return a.v; });
      if (!q) return rows;
      return rows.filter(r => cols.some(c => { if (rows.length && !(c in r)) throw err(`列 "${c}" がありません`); return toStr(r[c]).toLowerCase().includes(q); }));
    }
    case 'LookUp': {
      need(2, 'LookUp(テーブル, 条件, [取り出す列])');
      const { rows, as } = tableArg(n, env, F);
      const hit = rows.find(r => toBool(evalNode(A[1], rowEnv(env, r, as))));
      if (!hit) return null;
      return A[2] ? evalNode(A[2], rowEnv(env, hit, as)) : hit;
    }
    case 'Sort': {
      need(2, 'Sort(テーブル, 並べ替える式, [SortOrder.Descending])');
      const { rows, as } = tableArg(n, env, F);
      const desc = A[2] ? toStr(E(2)) === 'Descending' : false;
      const keyed = rows.map((r, i) => ({ r, i, k: evalNode(A[1], rowEnv(env, r, as)) }));
      keyed.sort((x, y) => (cmp(x.k, y.k) * (desc ? -1 : 1)) || x.i - y.i);
      return keyed.map(x => x.r);
    }
    case 'SortByColumns': {
      need(2, 'SortByColumns(テーブル, "列名", [SortOrder.Descending]…)');
      const { rows } = tableArg(n, env, F);
      const specs = [];
      for (let k = 1; k < A.length; k++) {
        const c = E(k); if (typeof c !== 'string') throw err('SortByColumns の列名は " " で囲みます');
        let ord = 'Ascending';
        if (k + 1 < A.length) { const nx = E(k + 1); if (nx === 'Ascending' || nx === 'Descending') { ord = nx; k++; } }
        specs.push([c, ord]);
      }
      return rows.map((r, i) => ({ r, i })).sort((x, y) => { for (const [c, o] of specs) { const d = cmp(x.r[c], y.r[c]) * (o === 'Descending' ? -1 : 1); if (d) return d; } return x.i - y.i; }).map(x => x.r);
    }
    case 'First': { const t = E(0); return isTable(t) ? t[0] ?? null : null; }
    case 'Last': { const t = E(0); return isTable(t) ? t[t.length - 1] ?? null : null; }
    case 'FirstN': { const t = E(0) || []; return t.slice(0, A[1] ? toNum(E(1)) : 1); }
    case 'LastN': { const t = E(0) || []; const k = A[1] ? toNum(E(1)) : 1; return t.slice(Math.max(0, t.length - k)); }
    case 'Index': { const t = E(0) || []; const k = toNum(E(1)); if (k < 1 || k > t.length) throw err(`Index: ${k} 番目の行はありません（1 から ${t.length}）`); return t[k - 1]; }
    case 'CountRows': { need(1, 'CountRows(テーブル)'); const t = E(0); if (t != null && !isTable(t)) throw err('CountRows にはテーブルを指定します'); return (t || []).length; }
    case 'CountIf': {
      need(2, 'CountIf(テーブル, 条件)');
      const { rows, as } = tableArg(n, env, F);
      return rows.filter(r => toBool(evalNode(A[1], rowEnv(env, r, as)))).length;
    }
    case 'CountA': case 'Count': { const t = E(0) || []; return t.filter(r => { const v = isRec(r) ? Object.values(r)[0] : r; return F === 'Count' ? typeof v === 'number' : v != null && v !== ''; }).length; }
    case 'Sum': case 'Average': case 'Max': case 'Min': {
      need(1, `${F}(テーブル, 式) または ${F}(値1, 値2…)`);
      let vals;
      const first = A[0].t === 'as' ? null : evalNode(A[0], env);
      if (A[0].t === 'as' || isTable(first)) {
        if (A.length < 2) throw err(`${F}(テーブル, 式) の形で、集計する列か式を2つ目に指定します`);
        const { rows, as } = tableArg(n, env, F);
        vals = rows.map(r => evalNode(A[1], rowEnv(env, r, as)));
      } else vals = A.map((_, i) => i === 0 ? first : E(i));
      vals = vals.filter(v => v != null && v !== '').map(toNum);
      if (!vals.length) return F === 'Sum' ? 0 : null;
      if (F === 'Sum') return vals.reduce((s, x) => s + x, 0);
      if (F === 'Average') return vals.reduce((s, x) => s + x, 0) / vals.length;
      return F === 'Max' ? Math.max(...vals) : Math.min(...vals);
    }
    case 'AddColumns': {
      need(3, 'AddColumns(テーブル, "列名", 式, …)');
      const { rows, as } = tableArg(n, env, F);
      return rows.map(r => { const o = { ...r }; for (let k = 1; k + 1 < A.length; k += 2) o[toStr(E(k))] = evalNode(A[k + 1], rowEnv(env, r, as)); return o; });
    }
    case 'DropColumns': case 'ShowColumns': {
      const { rows } = tableArg(n, env, F); const cs = A.slice(1).map((_, i) => toStr(E(i + 1)));
      return rows.map(r => { const o = {}; for (const [k, v] of Object.entries(r)) if (F === 'ShowColumns' ? cs.includes(k) : !cs.includes(k)) o[k] = v; return o; });
    }
    case 'RenameColumns': {
      const { rows } = tableArg(n, env, F);
      return rows.map(r => { const o = {}; for (const [k, v] of Object.entries(r)) { let nk = k; for (let j = 1; j + 1 < A.length; j += 2) if (toStr(E(j)) === k) nk = toStr(E(j + 1)); o[nk] = v; } return o; });
    }
    case 'Distinct': {
      need(2, 'Distinct(テーブル, 列または式)');
      const { rows, as } = tableArg(n, env, F); const out = [];
      for (const r of rows) { const v = evalNode(A[1], rowEnv(env, r, as)); if (!out.some(x => eq(x.Value, v))) out.push({ Value: v }); }
      return out;
    }
    case 'GroupBy': {
      const { rows } = tableArg(n, env, F); const cs = A.slice(1, -1).map((_, i) => toStr(E(i + 1))); const gname = toStr(E(A.length - 1));
      const out = [];
      for (const r of rows) { let g = out.find(o => cs.every(c => eq(o[c], r[c]))); if (!g) { g = {}; cs.forEach(c => { g[c] = r[c]; }); g[gname] = []; out.push(g); } const rest = { ...r }; cs.forEach(c => delete rest[c]); g[gname].push(rest); }
      return out;
    }
    case 'Concat': {
      need(2, 'Concat(テーブル, 式, [区切り])');
      const { rows, as } = tableArg(n, env, F);
      return rows.map(r => toStr(evalNode(A[1], rowEnv(env, r, as)))).join(A[2] ? toStr(E(2)) : '');
    }
    case 'ForAll': {
      need(2, 'ForAll(テーブル, 式)');
      const { rows, as } = tableArg(n, env, F);
      const out = rows.map(r => evalNode(A[1], rowEnv(env, r, as)));
      return out.every(v => v == null) ? out.filter(v => v != null) : out.map(v => isRec(v) ? v : { Value: v });
    }
    case 'Sequence': { const k = toNum(E(0)), s = A[1] ? toNum(E(1)) : 1, st = A[2] ? toNum(E(2)) : 1; return Array.from({ length: k }, (_, i) => ({ Value: s + i * st })); }
    case 'Table': return A.flatMap((_, i) => { const v = E(i); return isTable(v) ? v : [v]; });
    case 'IsEmpty': { const t = E(0); return !t || (isTable(t) && !t.length); }
    case 'With': {
      need(2, 'With({名前: 値}, 式)');
      const rec = E(0); if (!isRec(rec)) throw err('With の1つ目の引数はレコード {名前: 値} です');
      return evalNode(A[1], { ...env, locals: [...env.locals, rec] });
    }
    // --- 論理 ---
    case 'If': {
      need(2, 'If(条件, 真のとき, [偽のとき])');
      let k = 0;
      for (; k + 1 < A.length; k += 2) if (toBool(E(k))) return E(k + 1);
      return k < A.length ? E(k) : null;
    }
    case 'Switch': {
      need(3, 'Switch(式, 値1, 結果1, …, [その他])');
      const v = E(0); let k = 1;
      for (; k + 1 < A.length; k += 2) if (eq(v, E(k))) return E(k + 1);
      return k < A.length ? E(k) : null;
    }
    case 'And': return A.every((_, i) => toBool(E(i)));
    case 'Or': return A.some((_, i) => toBool(E(i)));
    case 'Not': return !toBool(E(0));
    case 'IsBlank': { const v = E(0); return v == null || v === '' ; }
    case 'IsBlankOrError': { try { const v = E(0); return v == null || v === ''; } catch { return true; } }
    case 'Blank': return null;
    case 'Coalesce': { for (let k = 0; k < A.length; k++) { const v = E(k); if (v != null && v !== '') return v; } return null; }
    case 'IsNumeric': { const v = E(0); return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(+v)); }
    case 'IfError': { try { return E(0); } catch (e) { if (e instanceof FxErr) return A[1] ? E(1) : null; throw e; } }
    case 'Error': throw err(toStr(isRec(E(0)) ? E(0).Message : E(0)));
    // --- テキスト ---
    case 'Len': return toStr(E(0)).length;
    case 'Left': return toStr(E(0)).slice(0, toNum(E(1)));
    case 'Right': { const s = toStr(E(0)); return s.slice(Math.max(0, s.length - toNum(E(1)))); }
    case 'Mid': return toStr(E(0)).substr(toNum(E(1)) - 1, A[2] ? toNum(E(2)) : undefined);
    case 'Upper': return toStr(E(0)).toUpperCase();
    case 'Lower': return toStr(E(0)).toLowerCase();
    case 'Proper': return toStr(E(0)).toLowerCase().replace(/(^|[^a-z])([a-z])/g, (m, a, b) => a + b.toUpperCase());
    case 'Trim': return toStr(E(0)).replace(/[\s　]+/g, ' ').trim();
    case 'TrimEnds': return toStr(E(0)).replace(/^[\s　]+|[\s　]+$/g, '');
    case 'Substitute': return toStr(E(0)).split(toStr(E(1))).join(toStr(E(2)));
    case 'Replace': { const s = toStr(E(0)); const st = toNum(E(1)) - 1; return s.slice(0, st) + toStr(E(3)) + s.slice(st + toNum(E(2))); }
    case 'Find': { const i = toStr(E(1)).indexOf(toStr(E(0))); return i < 0 ? null : i + 1; }
    case 'StartsWith': return toStr(E(0)).toLowerCase().startsWith(toStr(E(1)).toLowerCase());
    case 'EndsWith': return toStr(E(0)).toLowerCase().endsWith(toStr(E(1)).toLowerCase());
    case 'Concatenate': return A.map((_, i) => toStr(E(i))).join('');
    case 'Char': return String.fromCharCode(toNum(E(0)));
    case 'Split': return toStr(E(0)).split(toStr(E(1))).map(v => ({ Value: v }));
    case 'Value': { const v = E(0); if (v == null || v === '') return null; return toNum(typeof v === 'string' ? v.replace(/[¥￥円%]/g, '') : v); }
    case 'Text': {
      const v = E(0); if (A.length < 2) return toStr(v);
      const f = toStr(E(1));
      if (v == null) return '';
      if (v instanceof FxDate) return fmtDate(v, f.replace(/\[\$-[^\]]*\]/g, ''));
      return fmtNum(toNum(v), f);
    }
    case 'DateValue': case 'DateTimeValue': {
      const s = toStr(E(0)); const m = /^(\d{4})[/\-年](\d{1,2})[/\-月](\d{1,2})/.exec(s);
      if (!m) return null; return fxdate(+m[1], +m[2], +m[3]);
    }
    // --- 数値 ---
    case 'Round': { const d = 10 ** toNum(E(1) ?? 0); const v = toNum(E(0)); return Math.sign(v) * Math.round(Math.abs(v) * d) / d; }
    case 'RoundUp': { const d = 10 ** toNum(E(1) ?? 0); const v = toNum(E(0)); return Math.sign(v) * Math.ceil(Math.abs(v) * d - 1e-9) / d; }
    case 'RoundDown': { const d = 10 ** toNum(E(1) ?? 0); const v = toNum(E(0)); return Math.sign(v) * Math.floor(Math.abs(v) * d + 1e-9) / d; }
    case 'Int': return Math.floor(toNum(E(0)));
    case 'Trunc': return Math.trunc(toNum(E(0)));
    case 'Abs': return Math.abs(toNum(E(0)));
    case 'Mod': return toNum(E(0)) % toNum(E(1));
    case 'Sqrt': return Math.sqrt(toNum(E(0)));
    case 'Power': return toNum(E(0)) ** toNum(E(1));
    // --- 日付 ---
    case 'Today': return new FxDate(app.today);
    case 'Now': return new FxDate(app.today + 9 * 3600000, true);
    case 'Date': return fxdate(toNum(E(0)), toNum(E(1)), toNum(E(2)));
    case 'Year': case 'Month': case 'Day': { const d = E(0); if (d == null) return null; if (!(d instanceof FxDate)) throw err(`${F} には日付を指定します`); const [y, m, dd] = ymd(d); return F === 'Year' ? y : F === 'Month' ? m : dd; }
    case 'Weekday': { const d = E(0); if (!(d instanceof FxDate)) throw err('Weekday には日付を指定します'); const w = new Date(d.ms).getUTCDay(); return A[1] && toNum(E(1)) === 2 ? (w + 6) % 7 + 1 : w + 1; }
    case 'DateAdd': {
      need(2, 'DateAdd(日付, 数, [TimeUnit.Days])');
      const d = E(0); if (!(d instanceof FxDate)) throw err('DateAdd の1つ目の引数は日付です');
      const k = toNum(E(1)); const u = A[2] ? toStr(E(2)) : 'Days';
      if (u === 'Days') return new FxDate(d.ms + k * DAY, d.time);
      if (u === 'Hours') return new FxDate(d.ms + k * 3600000, true);
      if (u === 'Minutes') return new FxDate(d.ms + k * 60000, true);
      const months = u === 'Years' ? 12 * k : u === 'Quarters' ? 3 * k : k;
      const [y, m, dd] = ymd(d); const t = new Date(Date.UTC(y, m - 1 + months, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
      return new FxDate(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(dd, last)), d.time);
    }
    case 'DateDiff': {
      need(2, 'DateDiff(開始日, 終了日, [TimeUnit.Days])');
      const s = E(0), e = E(1); if (!(s instanceof FxDate) || !(e instanceof FxDate)) return null;
      const u = A[2] ? toStr(E(2)) : 'Days';
      const [y1, m1] = ymd(s), [y2, m2] = ymd(e);
      if (u === 'Days') return Math.round((Date.UTC(...ymd(e).slice(0, 3).map((v, i) => i === 1 ? v - 1 : v)) - Date.UTC(...ymd(s).slice(0, 3).map((v, i) => i === 1 ? v - 1 : v))) / DAY);
      if (u === 'Months') return (y2 - y1) * 12 + m2 - m1;
      if (u === 'Years') return y2 - y1;
      if (u === 'Hours') return Math.round((e.ms - s.ms) / 3600000);
      return Math.round((e.ms - s.ms) / 60000);
    }
    // --- 色 ---
    case 'RGBA': return `rgba(${toNum(E(0))},${toNum(E(1))},${toNum(E(2))},${toNum(E(3))})`;
    case 'ColorValue': return toStr(E(0));
    case 'ColorFade': return E(0);
    // --- 動作（ボタンの OnSelect など） ---
    case 'Set': {
      need(2, 'Set(変数名, 値)');
      if (A[0].t !== 'id') throw err('Set の1つ目の引数は変数名です');
      const nm = A[0].name;
      if (nm in app.ctxOf()) throw err(`'${nm}' はコンテキスト変数（UpdateContext）として使われています。同じ名前をグローバル変数にはできません`);
      if (nm in app.collections) throw err(`'${nm}' はコレクションです。Set ではなく ClearCollect を使います`);
      app.globals[nm] = E(1); return true;
    }
    case 'UpdateContext': {
      const rec = E(0); if (!isRec(rec)) throw err('UpdateContext は UpdateContext({名前: 値}) の形で書きます');
      for (const k of Object.keys(rec)) if (k in app.globals) throw err(`'${k}' はグローバル変数（Set）として使われています`);
      Object.assign(app.ctxOf(), rec); return true;
    }
    case 'Navigate': {
      need(1, 'Navigate(画面名, [ScreenTransition.Fade], [{変数: 値}])');
      const s = E(0); if (!s || !s.__screen) throw err('Navigate の1つ目の引数は画面名です（例: Navigate(詳細画面)）');
      app.nav.push(app.screen); app.screen = s.__screen;
      const rec = A[2] ? E(2) : A[1] ? (() => { const v = E(1); return isRec(v) && !v.__enum ? v : null; })() : null;
      if (rec) Object.assign(app.ctxOf(s.__screen), rec);
      return true;
    }
    case 'Back': { if (app.nav.length) app.screen = app.nav.pop(); return true; }
    case 'Notify': { app.notes.push({ msg: toStr(E(0)), type: A[1] ? toStr(E(1)) : 'Information' }); return true; }
    case 'Reset': { if (A[0].t !== 'id' || !app.ctlIndex[A[0].name]) throw err('Reset にはコントロール名を指定します'); delete app.state[A[0].name]; return true; }
    case 'Refresh': case 'Select': case 'SetFocus': case 'Launch': case 'Exit': case 'Concurrent': return true;
    case 'Collect': case 'ClearCollect': {
      need(2, `${F}(コレクション名, レコードまたはテーブル)`);
      const ref = sourceRef(n, env, F);
      if (ref.kind === 'new' && Object.keys(app.globals).includes(ref.name)) throw err(`'${ref.name}' は変数です`);
      const add = A.slice(1).flatMap((_, i) => { const v = E(i + 1); return isTable(v) ? v.map(r => ({ ...r })) : [isRec(v) ? { ...v } : { Value: v }]; });
      const base = F === 'ClearCollect' || ref.kind === 'new' ? [] : [...ref.rows];
      if (ref.kind === 'data') { const maxId = Math.max(0, ...ref.rows.map(r => r.ID || 0)); add.forEach((r, k) => { if (!('ID' in r)) r.ID = maxId + k + 1; }); }
      setSource(env, ref.kind === 'new' ? { kind: 'col', name: ref.name } : ref, [...base, ...add]);
      return add.length === 1 ? add[0] : add;
    }
    case 'Clear': { const ref = sourceRef(n, env, F); if (ref.kind === 'data') throw err('Clear はコレクションにだけ使えます'); app.collections[ref.name] = []; return true; }
    case 'Remove': {
      need(2, 'Remove(データソース, レコード)');
      const ref = sourceRef(n, env, F); if (ref.kind === 'new') throw err(`データソース '${ref.name}' がありません`);
      let rows = [...ref.rows];
      for (let k = 1; k < A.length; k++) { const v = E(k); for (const rec of one(v)) { const i = matchRec(rows, rec); if (i < 0) throw err('削除するレコードが見つかりません'); rows.splice(i, 1); } }
      setSource(env, ref, rows); return true;
    }
    case 'RemoveIf': {
      need(2, 'RemoveIf(データソース, 条件)');
      const ref = sourceRef(n, env, F); if (ref.kind === 'new') throw err(`データソース '${ref.name}' がありません`);
      setSource(env, ref, ref.rows.filter(r => !A.slice(1).every(c => toBool(evalNode(c, rowEnv(env, r)))))); return true;
    }
    case 'Defaults': { const ref = sourceRef(n, env, F); const cols = ref.rows?.[0] ? Object.keys(ref.rows[0]) : []; const o = { __new: true }; cols.forEach(c => { o[c] = null; }); return o; }
    case 'Patch': {
      need(2, 'Patch(データソース, 元のレコード または Defaults(データソース), {列: 値})');
      const ref = sourceRef(n, env, F); if (ref.kind === 'new') throw err(`データソース '${ref.name}' がありません（データソース名かコレクション名を指定）`);
      const base = E(1);
      const changes = Object.assign({}, ...A.slice(2).map((_, i) => E(i + 2)));
      let rows = [...ref.rows];
      if (isTable(base)) throw err('このアプリでは Patch の2つ目の引数はレコードにしてください');
      if (!isRec(base)) throw err('Patch の2つ目の引数はレコード（LookUp(…) や Gallery1.Selected、Defaults(…)）です');
      if (base.__new || A.length === 2) {
        const nr = {}; const cols = rows[0] ? Object.keys(rows[0]) : Object.keys(changes);
        cols.forEach(c => { nr[c] = null; });
        Object.assign(nr, A.length === 2 ? base : {}, changes); delete nr.__new;
        if (ref.kind === 'data' && ('ID' in nr || rows.some(r => 'ID' in r))) nr.ID = Math.max(0, ...rows.map(r => r.ID || 0)) + 1;
        for (const k of Object.keys(changes)) if (rows.length && !(k in rows[0])) throw err(`列 '${k}' はデータソース '${ref.name}' にありません`);
        rows.push(nr); setSource(env, ref, rows); return nr;
      }
      const i = matchRec(rows, base);
      if (i < 0) throw err('Patch: 更新するレコードがデータソースに見つかりません');
      for (const k of Object.keys(changes)) if (!(k in rows[i])) throw err(`列 '${k}' はデータソース '${ref.name}' にありません`);
      rows[i] = { ...rows[i], ...changes }; setSource(env, ref, rows); return rows[i];
    }
    case 'User': return { FullName: '山田 太郎', Email: 'yamada@contoso.co.jp' };
    case 'SubmitForm': case 'ResetForm': case 'NewForm': case 'EditForm': return true;
  }
  if (/^[a-z]/.test(F)) {
    const cand = F[0].toUpperCase() + F.slice(1);
    throw err(`'${F}' は不明な関数です。Power Fx の関数名は大文字で始まります（${cand} ？）`);
  }
  throw err(`'${F}' は不明な関数です（このアプリで未対応の可能性もあります）`);
}

// ---------- 委任（Delegation）の簡易チェック ----------
const NON_DELEGABLE = ['Len', 'Left', 'Mid', 'Right', 'Upper', 'Lower', 'Trim', 'Year', 'Month', 'Day', 'Text', 'Value', 'Find', 'Substitute', 'Search', 'IsBlank', 'Concatenate', 'AddColumns', 'ForAll', 'CountRows', 'CountIf', 'Sum', 'Average', 'Max', 'Min'];
export function delegationWarnings(src, delegable) {
  if (!delegable?.length) return [];
  let ast; try { ast = parse(src); } catch { return []; }
  const out = new Set();
  const usesNonDeleg = node => {
    let bad = null;
    const walk = x => { if (!x || typeof x !== 'object' || bad) return; if (x.t === 'call' && NON_DELEGABLE.includes(x.f)) bad = x.f + '()'; if (x.t === 'bin' && x.op === 'in') bad = 'in 演算子'; for (const v of Object.values(x)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v); };
    walk(node); return bad;
  };
  const walk = x => {
    if (!x || typeof x !== 'object') return;
    if (x.t === 'call') {
      const a0 = x.args[0]?.t === 'as' ? x.args[0].e : x.args[0];
      const src0 = a0?.t === 'id' && delegable.includes(a0.name) ? a0.name : null;
      if (src0) {
        if (['Filter', 'LookUp'].includes(x.f)) { const b = usesNonDeleg({ t: 'list', items: x.args.slice(1) }); if (b) out.add(`${x.f} の条件で ${b} を使っているため、${src0} の先頭 500 件（設定で最大 2000 件）しか処理されない可能性があります`); }
        if (x.f === 'Search') out.add(`SharePoint の ${src0} では Search は委任できません。StartsWith(列, 文字) を使った Filter にすると委任できます`);
        if (['CountRows', 'Sum', 'Average', 'CountIf', 'Max', 'Min'].includes(x.f)) out.add(`SharePoint の ${src0} に対する ${x.f} は委任できず、件数が多いと正しい結果になりません`);
      }
    }
    for (const v of Object.values(x)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
  };
  walk(ast);
  return [...out];
}

// 表示用
export function show(v) {
  if (v == null) return '（空白）';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(+v.toPrecision(12));
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof FxDate) return toStr(v);
  if (isTable(v)) return `テーブル（${v.length} 行）`;
  if (v.__ctl) return `コントロール ${v.__ctl}`;
  if (v.__screen) return `画面 ${v.__screen}`;
  if (isRec(v)) return '{' + Object.entries(v).filter(([k]) => !k.startsWith('__')).map(([k, x]) => `${k}: ${isTable(x) ? 'テーブル' : isRec(x) ? 'レコード' : show(x)}`).join(', ') + '}';
  return String(v);
}
export { toStr, toBool, toNum, isTable, isRec };
