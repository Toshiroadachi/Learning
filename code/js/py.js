// Python 実行（Web Worker 上の Pyodide）＋ エディタ ＋ タートル描画
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let worker = null, readyP = null, seq = 0;
const pending = new Map();
let statusCb = () => {};
export function onPyStatus(cb) { statusCb = cb; }

function startWorker() {
  worker = new Worker(new URL('./py-worker.js', import.meta.url));
  readyP = new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'loading') statusCb(m.msg);
      else if (m.type === 'ready') { statusCb(''); resolve(m.version); }
      else if (m.type === 'fatal') { statusCb('Python の読み込みに失敗しました。通信環境を確認してください。'); reject(new Error(m.msg)); }
      else if (m.type === 'result') {
        const p = pending.get(m.id);
        if (p) { pending.delete(m.id); clearTimeout(p.timer); p.resolve(m); }
      }
    };
    worker.onerror = (e) => { statusCb('Python の読み込みに失敗しました'); reject(e); };
  });
  readyP.catch(() => {});
}

export function warmup() { if (!worker) startWorker(); return readyP; }

function call(msg, timeoutMs) {
  if (!worker) startWorker();
  const id = ++seq;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      // 無限ループ等：Worker を作り直す
      pending.delete(id);
      worker.terminate(); worker = null;
      resolve({ status: 'timeout', out: '', err: `${timeoutMs / 1000}秒以内に終わらなかったため停止しました。\n無限ループ（while の条件がずっと True のまま等）になっていないか確認しましょう。`, turtle: [], images: [], tests: [] });
    }, timeoutMs);
    pending.set(id, { resolve, timer });
    readyP.then(() => worker && worker.postMessage({ id, ...msg })).catch(err => {
      clearTimeout(timer); pending.delete(id);
      resolve({ status: 'error', out: '', err: 'Python を読み込めませんでした（オフラインの可能性）。\n' + err, turtle: [], images: [], tests: [] });
    });
  });
}

// 初回ロードは時間がかかるのでタイムアウトはロード完了後から数える
export async function runPython(code, inputs = [], seed = 1) {
  if (!worker) startWorker();
  try { await readyP; } catch {}
  return call({ type: 'run', code, inputs, seed }, 12000);
}
export async function runTests(code, tests, seed = 1) {
  if (!worker) startWorker();
  try { await readyP; } catch {}
  return call({ type: 'test', code, tests, seed }, 20000);
}

// よくあるエラーの日本語ヒント
export function errorHint(err) {
  const rules = [
    [/IndentationError: expected an indented block/, 'インデント（字下げ）が必要です。if / for / def などの「:」の次の行は、スペース4つで字下げします。'],
    [/IndentationError: unexpected indent/, '不要なインデントがあります。行頭のスペースを確認しましょう。'],
    [/IndentationError|TabError/, 'インデントがそろっていません。同じブロックの行は同じ数のスペースで字下げします。'],
    [/SyntaxError: unterminated string literal|EOL while scanning/, '文字列のクォート（" や \'）が閉じられていません。'],
    [/SyntaxError: expected ':'/, 'if / for / while / def / class の行末に「:」（コロン）が必要です。'],
    [/SyntaxError: '\(' was never closed|was never closed/, 'カッコが閉じられていません。( と ) の数を確認しましょう。'],
    [/SyntaxError: invalid character/, '全角文字（全角スペース・全角カッコ・全角クォートなど）が混ざっていませんか？ コードは半角で書きます。'],
    [/SyntaxError: invalid syntax\. Perhaps you forgot a comma/, 'カンマ（,）が抜けているかもしれません。'],
    [/SyntaxError: invalid syntax\. Maybe you meant '==' or ':='/, '比較には「==」を使います（「=」は代入）。'],
    [/SyntaxError/, '文法の誤りです。表示された行とその前の行を確認しましょう（コロン、カッコ、クォート、全角文字など）。'],
    [/NameError: name '(\w+)' is not defined/, (m) => `「${m[1]}」という名前が定義されていません。スペルミス、定義前に使っている、文字列のクォート忘れ、import 忘れなどを確認しましょう。`],
    [/TypeError: can only concatenate str \(not "(\w+)"\) to str/, (m) => `文字列と ${m[1]} は + でつなげません。str() で文字列に変換するか、f文字列 f"...{変数}..." を使いましょう。`],
    [/TypeError: unsupported operand type\(s\) for [+\-*/]+: 'int' and 'str'|'str' and 'int'/, '数値と文字列は計算できません。input() の結果は文字列なので int() や float() で変換しましょう。'],
    [/TypeError: '(\w+)' object is not callable/, (m) => `${m[1]} を関数のように () で呼び出しています。変数名が組み込み関数（list, str, sum など）と重なっていませんか？`],
    [/TypeError: (\w+)\(\) missing (\d+) required positional argument/, (m) => `関数 ${m[1]}() の引数が ${m[2]} 個足りません。`],
    [/TypeError: (\w+)\(\) takes (\d+) positional arguments? but (\d+) (were|was) given/, (m) => `関数 ${m[1]}() に渡す引数の数が違います（${m[2]}個のところ${m[3]}個）。クラスのメソッドなら self を忘れていませんか？`],
    [/TypeError: 'str' object does not support item assignment/, '文字列は一部だけ書き換えられません（イミュータブル）。新しい文字列を作るか、リストに変換しましょう。'],
    [/ValueError: invalid literal for int\(\) with base 10: '(.*)'/, (m) => `「${m[1]}」は整数に変換できません。数字以外の文字や小数点が含まれていませんか？`],
    [/ValueError: could not convert string to float/, '小数に変換できない文字列です。'],
    [/IndexError: list index out of range/, 'リストの範囲外の番号を指定しています。インデックスは 0 から「長さ-1」までです。'],
    [/IndexError: string index out of range/, '文字列の範囲外の番号を指定しています。'],
    [/KeyError: (.*)/, (m) => `辞書にキー ${m[1]} がありません。.get() を使うか、キーの存在を in で確認しましょう。`],
    [/ZeroDivisionError/, '0 で割り算しています。'],
    [/AttributeError: '(\w+)' object has no attribute '(\w+)'/, (m) => `${m[1]} 型には ${m[2]} という属性・メソッドがありません。スペルや型を確認しましょう。`],
    [/ModuleNotFoundError: No module named '(\w+)'/, (m) => `モジュール ${m[1]} が見つかりません。このアプリ（ブラウザ版 Python）では使えないモジュールの可能性があります。`],
    [/RecursionError/, '再帰呼び出しが深すぎます。終了条件を確認しましょう。'],
    [/UnboundLocalError/, '関数の中で、代入より前にその変数を使っています。グローバル変数を書き換えたいなら global 宣言が必要です。'],
  ];
  for (const [re, msg] of rules) {
    const m = err.match(re);
    if (m) return typeof msg === 'function' ? msg(m) : msg;
  }
  return '';
}

// ---------- シンタックスハイライト付きエディタ（textarea + 重ね表示） ----------
const KW = new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'.split(' '));
const BI = new Set('print input len range int float str bool list dict set tuple type sum min max abs round sorted enumerate zip open map filter isinstance super object self any all reversed chr ord format repr'.split(' '));

export function highlight(code) {
  const re = /(#.*$)|("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|[rbfRBF]{0,2}"(?:\\.|[^"\\\n])*"?|[rbfRBF]{0,2}'(?:\\.|[^'\\\n])*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)/gm;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    const [t] = m;
    if (m[1]) out += `<span class="tok-com">${esc(t)}</span>`;
    else if (m[2]) out += `<span class="tok-str">${esc(t)}</span>`;
    else if (m[3]) out += `<span class="tok-num">${t}</span>`;
    else if (m[4]) out += KW.has(t) ? `<span class="tok-kw">${t}</span>` : BI.has(t) ? `<span class="tok-bi">${t}</span>` : `<span class="tok-fn">${t}</span>`;
    else out += KW.has(t) ? `<span class="tok-kw">${t}</span>` : BI.has(t) ? `<span class="tok-bi">${t}</span>` : t;
    last = re.lastIndex;
  }
  return out + esc(code.slice(last)) + '\n';
}

const KEYBAR = [
  ['⇥', 'TAB', 'wide'], ['⇤', 'UNTAB', 'wide'], [':'], ['('], [')'], ['"'], ["'"], ['['], [']'], ['{'], ['}'], ['='], ['_'], ['#'], [','], ['.'], ['+'], ['-'], ['*'], ['/'], ['<'], ['>'], ['%'], ['!'], ['f"'], ['\\n'], ['←', 'LEFT', 'wide'], ['→', 'RIGHT', 'wide'], ['↶', 'UNDO', 'wide'],
];

// el に editor を作る。戻り値: { get value, set value, focus }
export function createEditor(el, { value = '', onChange, filename = 'main.py', minHeight } = {}) {
  el.innerHTML = `<div class="editor-wrap">
    <div class="editor-head"><span>${esc(filename)}</span><span class="tiny">Python 3</span></div>
    <div class="editor"><div class="gutter"></div><pre aria-hidden="true"></pre>
      <textarea spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off"></textarea></div>
    <div class="keybar">${KEYBAR.map(([label, act, cls]) => `<button type="button" class="${cls || ''}" data-a="${esc(act || label)}">${esc(label)}</button>`).join('')}</div>
  </div>`;
  const ta = el.querySelector('textarea'), pre = el.querySelector('pre'), gut = el.querySelector('.gutter');
  if (minHeight) { ta.style.minHeight = minHeight; }
  ta.value = value;
  const undo = [value];
  const sync = () => {
    pre.innerHTML = highlight(ta.value);
    const n = ta.value.split('\n').length;
    gut.innerHTML = Array.from({ length: n }, (_, i) => i + 1).join('<br>');
    // 内容に合わせて高さを伸ばす（スマホでスクロールしやすく）
    ta.style.height = 'auto';
    ta.style.height = Math.max(ta.scrollHeight, 200) + 'px';
    pre.scrollLeft = ta.scrollLeft;
  };
  ta.addEventListener('scroll', () => { pre.scrollLeft = ta.scrollLeft; pre.scrollTop = ta.scrollTop; gut.scrollTop = ta.scrollTop; });
  let t = null;
  ta.addEventListener('input', () => {
    sync();
    clearTimeout(t);
    t = setTimeout(() => { if (undo[undo.length - 1] !== ta.value) { undo.push(ta.value); if (undo.length > 100) undo.shift(); } }, 400);
    onChange && onChange(ta.value);
  });

  const insert = (text, caretBack = 0) => {
    const s = ta.selectionStart, e = ta.selectionEnd;
    ta.setRangeText(text, s, e, 'end');
    if (caretBack) ta.selectionStart = ta.selectionEnd = ta.selectionEnd - caretBack;
    ta.dispatchEvent(new Event('input'));
  };
  const lineStart = () => ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;

  // Enter で自動インデント（: の後はさらに4つ）
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); e.shiftKey ? doUntab() : insert('    '); }
    else if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      const ls = lineStart();
      const line = ta.value.slice(ls, ta.selectionStart);
      let ind = line.match(/^\s*/)[0];
      if (/:\s*(#.*)?$/.test(line)) ind += '    ';
      insert('\n' + ind);
    }
  });
  const doUntab = () => {
    const ls = lineStart();
    const m = ta.value.slice(ls).match(/^ {1,4}/);
    if (m) {
      const pos = ta.selectionStart;
      ta.setRangeText('', ls, ls + m[0].length, 'preserve');
      ta.selectionStart = ta.selectionEnd = Math.max(ls, pos - m[0].length);
      ta.dispatchEvent(new Event('input'));
    }
  };
  const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", 'f"': '"' };
  el.querySelectorAll('.keybar button').forEach(b => {
    b.addEventListener('mousedown', e => e.preventDefault()); // フォーカスを奪わない
    b.addEventListener('click', () => {
      const a = b.dataset.a;
      ta.focus();
      if (a === 'TAB') insert('    ');
      else if (a === 'UNTAB') doUntab();
      else if (a === 'LEFT') { ta.selectionStart = ta.selectionEnd = Math.max(0, ta.selectionStart - 1); }
      else if (a === 'RIGHT') { ta.selectionStart = ta.selectionEnd = ta.selectionEnd + 1; }
      else if (a === 'UNDO') {
        if (undo.length > 1 && undo[undo.length - 1] === ta.value) undo.pop();
        const v = undo.length ? undo[undo.length - 1] : '';
        ta.value = v; sync(); onChange && onChange(v);
      }
      else if (a === '\\n') insert('\\n');
      else if (pairs[a] && ta.selectionStart === ta.selectionEnd) insert(a + pairs[a], 1);
      else insert(a);
    });
  });
  sync();
  requestAnimationFrame(sync);
  return {
    get value() { return ta.value; },
    set value(v) { ta.value = v; sync(); },
    focus() { ta.focus(); },
  };
}

// ---------- 出力表示（入力待ち・タートル・グラフ） ----------
export function renderOutput(outEl, res, { onInput } = {}) {
  let html = '';
  if (res.out) html += esc(res.out);
  if (res.status === 'error' || res.status === 'timeout') {
    html += `<span class="err">${esc(res.err)}</span>`;
    const h = errorHint(res.err || '');
    if (h) html += `\n<span class="sys">💡 ${esc(h)}</span>`;
  }
  if (!res.out && res.status === 'ok' && !(res.turtle || []).length && !(res.images || []).length) html += '<span class="sys">（出力なし。print() で表示できます）</span>';
  outEl.innerHTML = html;
  for (const img of res.images || []) {
    const im = document.createElement('img');
    im.src = 'data:image/png;base64,' + img;
    outEl.appendChild(im);
  }
  if ((res.turtle || []).some(op => op[0] !== 't')) {
    const cv = document.createElement('canvas');
    outEl.appendChild(cv);
    drawTurtle(cv, res.turtle);
  }
  if (res.status === 'need_input' && onInput) {
    const row = document.createElement('div');
    row.className = 'stdin-row';
    row.innerHTML = `<input placeholder="入力して Enter" autocapitalize="off" autocomplete="off"><button class="btn primary sm">送信</button>`;
    outEl.appendChild(row);
    const inp = row.querySelector('input');
    const go = () => onInput(inp.value);
    row.querySelector('button').onclick = go;
    inp.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) go(); };
    setTimeout(() => inp.focus({ preventScroll: true }), 50);
  }
  outEl.scrollTop = outEl.scrollHeight;
}

// タートルの描画ログをキャンバスにアニメーション再生
export function drawTurtle(cv, log) {
  let W = 600, H = 600, bg = 'white';
  for (const op of log) { if (op[0] === 'size') { W = op[1]; H = op[2]; } if (op[0] === 'bg') bg = op[1]; }
  const scale = 2;
  cv.width = W * scale; cv.height = H * scale;
  cv.style.aspectRatio = `${W} / ${H}`;
  const ctx = cv.getContext('2d');
  const X = x => (x + W / 2) * scale, Y = y => (H / 2 - y) * scale;
  const turtles = {};
  const draws = log.filter(op => op[0] !== 't' || true);
  const total = draws.length;
  const perFrame = Math.max(1, Math.ceil(total / 120));
  let i = 0;
  const base = document.createElement('canvas');
  base.width = cv.width; base.height = cv.height;
  const b = base.getContext('2d');
  b.fillStyle = bg; b.fillRect(0, 0, base.width, base.height);
  b.lineCap = 'round'; b.lineJoin = 'round';
  const apply = (op) => {
    switch (op[0]) {
      case 'bg': b.save(); b.globalCompositeOperation = 'destination-over'; b.fillStyle = op[1]; b.fillRect(0, 0, base.width, base.height); b.restore(); bg = op[1]; break;
      case 'l': b.strokeStyle = op[5]; b.lineWidth = Math.max(1, op[6]) * scale; b.beginPath(); b.moveTo(X(op[1]), Y(op[2])); b.lineTo(X(op[3]), Y(op[4])); b.stroke(); break;
      case 'f': b.fillStyle = op[2]; b.beginPath(); op[1].forEach(([x, y], k) => k ? b.lineTo(X(x), Y(y)) : b.moveTo(X(x), Y(y))); b.closePath(); b.fill(); break;
      case 'd': b.fillStyle = op[4]; b.beginPath(); b.arc(X(op[1]), Y(op[2]), op[3] / 2 * scale, 0, Math.PI * 2); b.fill(); break;
      case 'w': {
        const [fam, size, style] = op[5];
        b.fillStyle = op[6]; b.font = `${style === 'bold' ? 'bold ' : ''}${(size || 8) * 1.3 * scale}px ${fam || 'sans-serif'}, sans-serif`;
        b.textAlign = op[4] === 'center' ? 'center' : op[4] === 'right' ? 'right' : 'left';
        b.fillText(op[3], X(op[1]), Y(op[2])); break;
      }
      case 's': drawShape(b, X(op[1]), Y(op[2]), op[3], op[4], op[5], scale); break;
      case 'clear': case 'clearall': b.fillStyle = bg; b.fillRect(0, 0, base.width, base.height); break;
      case 't': turtles[op[1]] = op; break;
    }
  };
  const frame = () => {
    for (let k = 0; k < perFrame && i < total; k++, i++) apply(draws[i]);
    ctx.drawImage(base, 0, 0);
    for (const t of Object.values(turtles)) if (t[5]) drawShape(ctx, X(t[2]), Y(t[3]), t[4], t[7], t[8], scale, t[6]);
    if (i < total) requestAnimationFrame(frame);
  };
  frame();
}

function drawShape(c, x, y, heading, fill, shape, scale, stroke) {
  c.save();
  c.translate(x, y);
  c.rotate(-heading * Math.PI / 180);
  c.fillStyle = fill || 'black';
  c.strokeStyle = stroke || fill || 'black';
  c.lineWidth = scale;
  c.beginPath();
  const s = scale;
  if (shape === 'circle') c.arc(0, 0, 10 * s, 0, Math.PI * 2);
  else if (shape === 'square') c.rect(-10 * s, -10 * s, 20 * s, 20 * s);
  else if (shape === 'turtle') { c.ellipse(0, 0, 9 * s, 7 * s, 0, 0, Math.PI * 2); c.moveTo(14 * s, 0); c.arc(11 * s, 0, 3 * s, 0, Math.PI * 2); }
  else if (shape === 'triangle') { c.moveTo(10 * s, 0); c.lineTo(-8 * s, 9 * s); c.lineTo(-8 * s, -9 * s); c.closePath(); }
  else { c.moveTo(9 * s, 0); c.lineTo(-6 * s, 5 * s); c.lineTo(-3 * s, 0); c.lineTo(-6 * s, -5 * s); c.closePath(); }
  c.fill(); c.stroke();
  c.restore();
}

// 複数ファイルのプロジェクトを実行（ライブ体験用）。mode: 'run' | 'test'
export async function runProject(files, mode, path = '', stdin = []) {
  if (!worker) startWorker();
  try { await readyP; } catch {}
  return call({ type: 'project', files, mode, path, stdin }, 20000);
}
