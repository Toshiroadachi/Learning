// 答えの式を計算・比較する小さなエンジン
// 入力例: 9.8, 1/3, √2, 2√3, 2π, 3.0×10^8, 1.6e-19, sin(π/6), 2x+3, x^2-1, log10(2), ln(2)
export class MathErr extends Error {}
const err = m => new MathErr(m);
const FUNCS = {
  sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  ln: Math.log, log: Math.log, log10: Math.log10, log2: Math.log2, exp: Math.exp, abs: Math.abs, floor: Math.floor,
};
const CONSTS = { pi: Math.PI, π: Math.PI, e: Math.E };

export function normalize(s) {
  return String(s ?? '').trim()
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[．。]/g, '.').replace(/[，、]/g, ',').replace(/[（]/g, '(').replace(/[）]/g, ')')
    .replace(/[＋]/g, '+').replace(/[－−ー‐]/g, '-').replace(/[×✕＊・]/g, '*').replace(/[÷／]/g, '/').replace(/[＾]/g, '^')
    .replace(/[ｘＸ]/g, 'x').replace(/ /g, '').replace(/²/g, '^2').replace(/³/g, '^3');
}

function lex(src) {
  const t = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(src.slice(i));
      t.push({ k: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue;
    }
    if (c === '√') { t.push({ k: 'id', v: 'sqrt', root: true }); i++; continue; }
    if (c === 'π') { t.push({ k: 'id', v: 'pi' }); i++; continue; }
    if (/[a-zA-Z]/.test(c)) {
      let m = /^(sqrt|asin|acos|atan|sin|cos|tan|log10|log2|log|ln|exp|abs|floor|pi)/.exec(src.slice(i));
      if (m) { t.push({ k: 'id', v: m[1] }); i += m[1].length; continue; }
      t.push({ k: 'id', v: c }); i++; continue;      // 1文字の変数・定数（x, y, n, e …）
    }
    if ('+-*/^(),'.includes(c)) { t.push({ k: 'op', v: c }); i++; continue; }
    throw err(`使えない文字があります: 「${c}」`);
  }
  return t;
}

export function parse(input) {
  const toks = lex(normalize(input));
  if (!toks.length) throw err('答えを入力してください');
  let i = 0;
  const pk = () => toks[i], nx = () => toks[i++];
  const isOp = v => pk() && pk().k === 'op' && pk().v === v;
  function expr() {
    let l = term();
    while (isOp('+') || isOp('-')) { const op = nx().v; l = { t: 'bin', op, l, r: term() }; }
    return l;
  }
  // 掛け算（記号なしの掛け算も：2x, 2(x+1), 2√3, 3π）
  function term() {
    let l = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) { const op = nx().v; l = { t: 'bin', op, l, r: unary() }; continue; }
      const p = pk();
      if (p && (p.k === 'num' || p.k === 'id' || (p.k === 'op' && p.v === '('))) { l = { t: 'bin', op: '*', l, r: power() }; continue; }
      return l;
    }
  }
  function unary() { if (isOp('-')) { nx(); return { t: 'neg', e: unary() }; } if (isOp('+')) { nx(); return unary(); } return power(); }
  function power() {
    const b = primary();
    if (isOp('^')) { nx(); return { t: 'bin', op: '^', l: b, r: unary() }; }
    return b;
  }
  function primary() {
    const t = nx();
    if (!t) throw err('式が途中で終わっています');
    if (t.k === 'num') return { t: 'num', v: t.v };
    if (t.k === 'op' && t.v === '(') { const e = expr(); if (!isOp(')')) throw err('カッコ ) が閉じていません'); nx(); return e; }
    if (t.k === 'id') {
      if (FUNCS[t.v] && t.v !== 'pi') {
        if (t.root && !isOp('(')) return { t: 'call', f: 'sqrt', a: [power()] };   // √3, √x
        if (!isOp('(')) throw err(`${t.v} の後には ( ) が必要です`);
        nx(); const args = [expr()];
        while (isOp(',')) { nx(); args.push(expr()); }
        if (!isOp(')')) throw err('カッコ ) が閉じていません');
        nx();
        return { t: 'call', f: t.v, a: args };
      }
      return { t: 'var', v: t.v };
    }
    throw err(`ここに「${t.v}」は書けません`);
  }
  const e = expr();
  if (i < toks.length) throw err(`式の後ろに余分な「${toks[i].v}」があります`);
  return e;
}

export function evaluate(node, scope = {}) {
  switch (node.t) {
    case 'num': return node.v;
    case 'neg': return -evaluate(node.e, scope);
    case 'var': {
      if (node.v in scope) return scope[node.v];
      if (node.v in CONSTS) return CONSTS[node.v];
      throw err(`文字「${node.v}」が入っています（数値で答えます）`);
    }
    case 'call': {
      const a = node.a.map(x => evaluate(x, scope));
      if (node.f === 'log' && a.length === 2) return Math.log(a[1]) / Math.log(a[0]);   // log(底, 真数)
      return FUNCS[node.f](...a);
    }
    case 'bin': {
      const l = evaluate(node.l, scope), r = evaluate(node.r, scope);
      switch (node.op) { case '+': return l + r; case '-': return l - r; case '*': return l * r; case '/': return l / r; case '^': return l ** r; }
    }
  }
  throw err('計算できない式です');
}
export const calc = (s, scope) => evaluate(parse(s), scope);
export function vars(node, out = new Set()) {
  if (node.t === 'var' && !(node.v in CONSTS)) out.add(node.v);
  for (const k of ['l', 'r', 'e']) if (node[k]) vars(node[k], out);
  if (node.a) node.a.forEach(x => vars(x, out));
  return out;
}

// 採点: spec = { type: 'num'|'expr'|'choice', ans, tol }
export function check(spec, input) {
  if (spec.type === 'choice') return { ok: String(input) === String(spec.ans) };
  if (input == null || String(input).trim() === '') return { ok: false, msg: '答えを入力してください' };
  try {
    if (spec.type === 'num') {
      const want = calc(spec.ans), got = calc(input);
      if (!isFinite(got)) return { ok: false, msg: '計算できない値です' };
      const tol = spec.tol ?? 0.01;          // 相対誤差（既定 1%）
      const ok = Math.abs(got - want) <= Math.max(Math.abs(want) * tol, 1e-12);
      return { ok, got };
    }
    if (spec.type === 'expr') {
      const a = parse(spec.ans), b = parse(input);
      const vs = [...new Set([...vars(a), ...vars(b)])];
      for (let k = 0; k < 6; k++) {
        const scope = Object.fromEntries(vs.map((v, j) => [v, 0.37 + k * 0.73 + j * 0.29]));
        const x = evaluate(a, scope), y = evaluate(b, scope);
        if (!(Math.abs(x - y) <= 1e-7 * Math.max(1, Math.abs(x)))) return { ok: false };
      }
      return { ok: true };
    }
  } catch (e) { if (e instanceof MathErr) return { ok: false, msg: e.message }; throw e; }
  return { ok: false };
}
