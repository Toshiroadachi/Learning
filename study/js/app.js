import { getState, save, logActivity, exportData, importData, resetAll, streak, todayKey } from './store.js';
import { SUBJECTS, UNITS } from '../data/units.js';
import { CONTENT } from '../data/content.js';
import { check, calc, parse, MathErr } from './mathx.js';
import * as AI from './ai.js';
import { esc, md, toast, renderMath } from './util.js';

const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
const SUB_IDS = Object.keys(SUBJECTS);
const unitById = id => UNITS.find(u => u.id === id);

// ---------- 教材・問題 ----------
function contentOf(id) { return CONTENT[id] || getState().aiUnits[id] || null; }
function problemsOf(id) {
  const c = contentOf(id);
  const base = (c?.problems || []).map(p => ({ ...p, id: p.id || `${id}#${p.n}` }));
  return [...base, ...(getState().aiProblems[id] || [])];
}
// AI が作った問題の検証（答えが計算できるか・検算式と一致するか）
function validProblems(list, prefix) {
  const out = [];
  list.forEach((p, i) => {
    try {
      if (p.type === 'choice') {
        if (!Array.isArray(p.choices) || p.choices.length < 2) return;
        const a = parseInt(p.ans, 10); if (!(a >= 1 && a <= p.choices.length)) return;
        out.push({ ...p, ans: String(a), unit: '', id: `${prefix}${i + 1}`, ai: true });
      } else {
        const v = calc(p.ans); if (!isFinite(v)) return;
        if (p.calc && p.calc !== '-' && !check({ type: 'num', ans: p.ans, tol: 0.005 }, p.calc).ok) return;
        out.push({ ...p, type: 'num', unit: p.unit === '-' ? '' : p.unit, tol: 0.02, choices: undefined, id: `${prefix}${i + 1}`, ai: true });
      }
    } catch { /* 計算できない問題は使わない */ }
  });
  return out;
}

// ---------- レベル・XP・バッジ ----------
const TITLES = [[1, '見習い研究生'], [3, '理科部員'], [5, '実験リーダー'], [8, '博士の卵'], [12, '天才研究者'], [16, 'ノーベル賞候補'], [20, '宇宙の真理を知る者']];
const levelOf = xp => Math.floor(Math.sqrt(xp / 40)) + 1;
const xpFor = lv => 40 * (lv - 1) ** 2;
const titleOf = lv => TITLES.filter(t => lv >= t[0]).pop()[1];
const BADGES = [
  ['first', '🎉', 'はじめての正解', st => correctCount(st) >= 1],
  ['c10', '🔟', '10問正解', st => correctCount(st) >= 10],
  ['c50', '🏅', '50問正解', st => correctCount(st) >= 50],
  ['c100', '🏆', '100問正解', st => correctCount(st) >= 100],
  ['boss', '👾', 'ボス問題を倒した', st => Object.entries(st.answers).some(([id, a]) => a.ok && findProblem(id)?.lv === 3)],
  ['combo5', '🔥', '5問連続正解', () => combo >= 5],
  ['s3', '📅', '3日連続学習', () => streak() >= 3],
  ['s7', '🗓', '7日連続学習', () => streak() >= 7],
  ['phy', '🍎', '物理の単元をクリア', st => SUB_IDS.includes('phy') && clearedUnits('phy') >= 1],
  ['chem', '⚗️', '化学の単元をクリア', () => clearedUnits('chem') >= 1],
  ['math', '📐', '数学の単元をクリア', () => clearedUnits('math') >= 1],
  ['photo', '📷', '写真で質問した', st => st.log.some(l => l.kind === 'photo')],
  ['mission', '✅', 'デイリーミッション達成', st => Object.values(st.daily).some(d => d.bonus)],
  ['timeatk', '⏱', 'タイムアタックに挑戦', st => Object.keys(st.challenge).length > 0],
];
const correctCount = st => Object.values(st.answers).filter(a => a.ok).length;
function findProblem(id) { const uid = id.split('#')[0]; return problemsOf(uid).find(p => p.id === id); }
function unitStats(id) {
  const ps = problemsOf(id); const st = getState();
  const ok = ps.filter(p => st.answers[p.id]?.ok).length;
  const lvDone = lv => ps.filter(p => p.lv === lv).length > 0 && ps.filter(p => p.lv === lv).every(p => st.answers[p.id]?.ok);
  return { total: ps.length, ok, stars: [1, 2, 3].filter(lvDone).length };
}
function clearedUnits(sub) { return UNITS.filter(u => u.sub === sub && problemsOf(u.id).length && unitStats(u.id).ok === problemsOf(u.id).length).length; }
function checkBadges() {
  const st = getState();
  for (const [id, icon, name, cond] of BADGES) if (!st.badges[id] && cond(st)) { st.badges[id] = Date.now(); save(); setTimeout(() => celebrate(`${icon} バッジ獲得！「${name}」`), 900); }
}
let combo = 0;
function addXP(n, why) {
  const st = getState(); const before = levelOf(st.xp);
  st.xp += n; save();
  const after = levelOf(st.xp);
  drawTop();
  if (after > before) setTimeout(() => celebrate(`🎊 レベルアップ！ Lv.${after}「${titleOf(after)}」`), 400);
}
function drawTop() {
  const st = getState(); const lv = levelOf(st.xp);
  $('#topinfo').innerHTML = `<span class="lvchip">Lv.${lv}</span> ${st.xp} XP　🔥${streak()}`;
}

// ---------- 演出 ----------
function confetti(n = 40) {
  const fx = $('#fx');
  const colors = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i');
    d.className = 'conf';
    d.style.left = Math.random() * 100 + 'vw';
    d.style.background = colors[i % colors.length];
    d.style.animationDelay = Math.random() * 0.3 + 's';
    d.style.transform = `rotate(${Math.random() * 360}deg)`;
    fx.appendChild(d);
    setTimeout(() => d.remove(), 1800);
  }
}
function celebrate(msg) { confetti(70); const b = document.createElement('div'); b.className = 'banner'; b.textContent = msg; $('#fx').appendChild(b); setTimeout(() => b.remove(), 2600); }
const PRAISE = ['すばらしい！', 'その調子！', '完ぺき！', 'さすが！', 'よく考えたね！', '天才かも！', 'ナイス！'];
const CHEER = ['おしい！もう一度考えてみよう', 'ドンマイ！ヒントを見てみよう', '単位や符号を確認してみよう', 'あと一歩！式を見直してみよう'];
const pick = a => a[Math.floor(Math.random() * a.length)];

// ---------- ルーター ----------
function route() {
  const hash = location.hash || '#/home';
  const [, name, arg] = hash.match(/^#\/(\w+)\/?(.*)$/) || [, 'home', ''];
  const sub = name === 'sub' ? arg : name === 'unit' ? unitById(arg)?.sub : name === 'formulas' ? arg : null;
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.route === (sub || name)));
  window.scrollTo(0, 0);
  drawTop();
  const views = { home, sub: subject, unit, review, challenge, ai: aiPage, records, formulas, settings };
  (views[name] || home)(decodeURIComponent(arg || ''));
  renderMath(view);
}
window.addEventListener('hashchange', route);

// ---------- AI の利用状況 ----------
function aiUsageCard() {
  const st = getState(); const usage = st.aiUsage || [];
  if (!AI.hasKey() && !usage.length) return '';
  const ym = d => `${d.getFullYear()}-${d.getMonth() + 1}`; const month = ym(new Date());
  const all = AI.usageSummary(usage), mon = AI.usageSummary(usage.filter(u => ym(new Date(u.ts)) === month));
  const yen = +st.settings.yen || 150;
  const k = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : String(v);
  const money = v => `$${v.toFixed(v < 1 ? 3 : 2)}（約${Math.round(v * yen).toLocaleString()}円）`;
  const costTxt = x => x.n === 0 ? '—' : x.unknown && x.usd === 0 ? '単価未設定' : money(x.usd) + (x.unknown ? '＋単価不明分' : '');
  const prov = AI.provider(); const isOA = prov === 'openai' || (!prov && usage[usage.length - 1]?.provider !== 'anthropic');
  return `<div class="card"><div class="row-between"><h2 style="margin:0">AIの利用状況</h2><span class="pill">${prov ? AI.providerName() + '：' + esc(AI.currentModel()) : 'AI未設定'}</span></div>
    <table class="cmp" style="margin-top:6px"><tr><th></th><th>回数</th><th>トークン<br><small>入力/出力</small></th><th>推定金額</th></tr>
    <tr><td>今月</td><td>${mon.n}</td><td>${k(mon.in)} / ${k(mon.out)}</td><td>${costTxt(mon)}</td></tr>
    <tr><td>累計</td><td>${all.n}</td><td>${k(all.in)} / ${k(all.out)}</td><td>${costTxt(all)}</td></tr></table>
    <p class="small muted" style="margin-bottom:0">このアプリで使った分の記録です（1ドル=${yen}円で概算）。${isOA && (st.settings.openaiPriceIn === '' || st.settings.openaiPriceIn == null) ? 'OpenAI の金額を出すには「設定」でモデルの単価を入力してください。' : ''}
    正確な請求額は <a href="${isOA ? 'https://platform.openai.com/usage' : 'https://console.anthropic.com/usage'}" target="_blank" rel="noopener">${isOA ? 'OpenAI' : 'Anthropic'} の利用状況ページ ↗</a></p></div>`;
}

// ---------- ホーム ----------
function home() {
  const st = getState(); const lv = levelOf(st.xp);
  const today = st.daily[todayKey()] || { correct: 0 };
  const goal = +st.settings.dailyGoal || 5;
  const wrong = wrongList().length;
  const pct = Math.round(100 * (st.xp - xpFor(lv)) / (xpFor(lv + 1) - xpFor(lv)));
  const greet = st.settings.name ? `${esc(st.settings.name)}さん、` : '';
  view.innerHTML = `
    <div class="card hero">
      <div class="row" style="flex-wrap:nowrap"><div class="avatar">🧑‍🔬</div>
        <div class="grow"><div class="small muted">${greet}今日もラボへようこそ！</div><div class="lvline"><b>Lv.${lv}</b> ${esc(titleOf(lv))}</div>
          <div class="xpbar"><div style="width:${pct}%"></div></div><div class="tiny muted">${st.xp} XP ／ 次のレベルまで ${xpFor(lv + 1) - st.xp} XP</div></div></div>
      <div class="mission ${today.correct >= goal ? 'done' : ''}">🎯 今日のミッション：${goal}問正解 <b>${Math.min(today.correct, goal)}/${goal}</b>${today.correct >= goal ? '　✅ 達成！' : '　（達成で +50 XP）'}</div>
      <div class="row small" style="margin-top:6px">🔥 連続 <b>${streak()}</b> 日　｜　✅ 正解 <b>${correctCount(st)}</b> 問　｜　🏅 バッジ <b>${Object.keys(st.badges).length}</b></div>
    </div>
    <div class="grid3">${SUB_IDS.map(s => { const S = SUBJECTS[s]; const us = UNITS.filter(u => u.sub === s); const done = us.filter(u => problemsOf(u.id).length && unitStats(u.id).stars >= 2).length;
      return `<a class="subcard" href="#/sub/${s}" style="--c:${S.color}"><div class="ic">${S.icon}</div><b>${S.name}</b><div class="tiny">${esc(S.books)}</div><div class="tiny">クリア ${done}/${us.length}</div></a>`; }).join('')}</div>
    ${continueCard()}
    <div class="grid2">
      <a class="tile" href="#/ai/photo"><div class="t">📷 写真で質問</div><div class="small muted">問題集の分からない問題を撮影すると、AI 先生が中学生にも分かるように解説</div></a>
      <a class="tile" href="#/review"><div class="t">🔁 まちがえた問題 ${wrong ? `<span class="badge">${wrong}</span>` : ''}</div><div class="small muted">もう一度解いて、苦手をなくそう</div></a>
      <a class="tile" href="#/challenge"><div class="t">⏱ タイムアタック</div><div class="small muted">3分で何問解ける？ ハイスコアに挑戦</div></a>
      <a class="tile" href="#/records"><div class="t">🏆 記録とバッジ</div><div class="small muted">レベル・称号・集めたバッジ</div></a>
    </div>
    ${aiUsageCard()}`;
}
function continueCard() {
  const st = getState();
  const last = [...st.log].reverse().find(l => l.kind === 'unit' || l.kind === 'answer');
  const uid = last ? last.id.split('#')[0] : null; const u = uid && unitById(uid);
  if (!u) return `<a class="card cont" href="#/unit/phy-k02">▶ まずは <b>物理「加速度と等加速度直線運動」</b> から始めてみよう</a>`;
  const s = unitStats(u.id);
  return `<a class="card cont" href="#/unit/${u.id}" style="border-left-color:${SUBJECTS[u.sub].color}">▶ つづきから：${SUBJECTS[u.sub].icon} <b>${esc(u.title)}</b><div class="tiny muted">${s.total ? `正解 ${s.ok}/${s.total}` : '教材を読もう'}</div></a>`;
}

// ---------- 教科 ----------
function subject(sub) {
  if (!SUBJECTS[sub]) sub = 'phy';
  const S = SUBJECTS[sub]; const st = getState();
  const groups = [];
  for (const u of UNITS.filter(x => x.sub === sub)) { const key = `${u.book}｜${u.ch}`; let g = groups.find(x => x.key === key); if (!g) groups.push(g = { key, book: u.book, ch: u.ch, units: [] }); g.units.push(u); }
  view.innerHTML = `<div class="subhead" style="--c:${S.color}"><span class="ic">${S.icon}</span><div><h1 style="margin:0">${S.name}</h1><div class="small">${esc(S.books)}</div></div><a class="btn sm" href="#/formulas/${sub}">📘 公式集</a></div>
    <p class="small muted">⭐ は「基本・標準・ボス」の各レベルを全問正解するごとに1つ。<span class="tag ai">AI</span> の単元は、AI 先生がその場で教材と問題を作ります。</p>
    ${groups.map(g => `<h3 class="chh">${esc(g.book)}・${esc(g.ch)}</h3>${g.units.map(u => { const has = !!contentOf(u.id); const s = unitStats(u.id);
      return `<a class="urow" href="#/unit/${u.id}" style="--c:${S.color}"><span class="grow"><b>${esc(u.title)}</b>${!CONTENT[u.id] ? ` <span class="tag ${has ? 'aidone' : 'ai'}">${has ? 'AI作成済' : 'AI'}</span>` : ''}<div class="tiny muted">${esc(u.topics)}</div></span>
        <span class="stars">${has ? '⭐'.repeat(s.stars) + '<span class="dim">' + '☆'.repeat(3 - s.stars) + '</span>' : ''}<div class="tiny muted">${has && s.total ? `${s.ok}/${s.total}` : ''}</div></span></a>`; }).join('')}`).join('')}`;
}

// ---------- 単元 ----------
function unit(id) {
  const u = unitById(id); if (!u) return home();
  const S = SUBJECTS[u.sub]; const st = getState();
  const c = contentOf(id);
  logActivity('unit', id);
  const head = `<div class="row-between" style="margin-bottom:6px"><a class="small" href="#/sub/${u.sub}">← ${S.name}</a><span class="pill" style="border-color:${S.color};color:${S.color}">${S.icon} ${esc(u.book)}</span></div>
    <h1>${esc(u.title)}</h1><p class="small muted" style="margin-top:0">${esc(u.ch)}｜${esc(u.topics)}</p>`;
  if (!c) {
    view.innerHTML = `${head}<div class="card"><div class="speech"><span class="who">🧑‍🔬 ${esc(S.mascot)}</span>この単元の教材はまだないよ。AI 先生にお願いすると、中学生にも分かる解説と、自動採点の練習問題5問をその場で作ってくれるよ！</div>
      ${AI.hasKey() ? `<button class="btn primary" id="gen">🤖 AI 先生に教材を作ってもらう</button><p class="tiny muted">${esc(AI.currentModel())} を使用（30秒〜1分）。作った教材はこの端末に保存されます。</p>`
        : `<p class="small">設定で AI の API キーを登録すると、この単元の教材を作れます。</p><a class="btn" href="#/settings">設定へ</a>`}
      <p class="small muted">問題集のこの単元の問題で分からないものは、<a href="#/ai/photo">📷 写真で質問</a> で直接聞けます。</p><div id="genout"></div></div>`;
    const g = $('#gen');
    if (g) g.onclick = async () => {
      g.disabled = true; $('#genout').innerHTML = '<div class="spinner"></div><p class="small center muted">教材を作っています…（答えも自動で検算します）</p>';
      try {
        const r = await AI.generateUnit(u, S.name);
        const probs = validProblems(r.problems || [], `${id}#ai`);
        if (probs.length < 3) throw new Error('答えを検算できる問題が少なかったため、作り直してください。');
        st.aiUnits[id] = { image: r.image, detail: r.detail, formulas: r.formulas, pitfalls: r.pitfalls, example: r.example, problems: probs, ai: true, ts: Date.now() };
        save(); logActivity('aiunit', id); unit(id); renderMath(view);
      } catch (e) { g.disabled = false; $('#genout').innerHTML = `<p class="ngc small">${esc(e.message)}</p>`; }
    };
    return;
  }
  const probs = problemsOf(id);
  view.innerHTML = `${head}
    <div class="speech"><span class="who">🧑‍🔬 ${esc(S.mascot)}</span>${esc(pick(['まずはイメージから。むずかしい式も、意味が分かれば怖くないよ！', '解説を読んだら、基本問題から順にチャレンジしよう！', 'ボス問題を倒すと大量 XP だ！', '分からないところは AI 先生に聞いてみよう！']))}</div>
    ${c.ai ? '<p class="tiny muted">この教材は AI 先生が作成したものです。おかしな所があれば「作り直す」か、AI 先生に質問してください。</p>' : ''}
    <div class="card lesson img-card"><h2 class="sec">🗺 イメージ</h2>${md(c.image)}</div>
    <div class="card lesson"><h2 class="sec">📖 くわしい解説</h2>${md(c.detail)}</div>
    <div class="card lesson formula-card"><h2 class="sec">📘 公式カード</h2>${md(c.formulas)}</div>
    <div class="card lesson pit-card"><h2 class="sec">⚠ つまずきポイント</h2>${md(c.pitfalls)}</div>
    ${c.example ? `<details class="card guide" open><summary><b>✏️ 例題</b></summary><div class="lesson" style="margin-top:6px">${md(c.example)}</div></details>` : ''}
    <div id="askbox"></div>
    <h2 class="sec" style="margin-top:16px">🎮 練習問題 <span class="small muted">（${unitStats(id).ok}/${probs.length} 正解）</span></h2>
    <div id="probs"></div>
    <div class="card"><b>➕ もっと練習する</b><p class="small muted" style="margin:4px 0">AI 先生に、この単元の新しい問題を3問作ってもらう（答えは自動で検算）</p>
      <div class="btn-row" style="margin-top:4px">${[1, 2, 3].map(l => `<button class="btn sm" data-more="${l}">${'★'.repeat(l)} ${['', '基本', '標準', '発展'][l]}</button>`).join('')}</div><div id="moreout"></div></div>
    ${c.ai ? `<div class="btn-row"><button class="btn sm" id="regen">🔄 教材を作り直す（この単元の記録は残ります）</button></div>` : ''}`;
  const box = $('#probs');
  probs.forEach((p, i) => { const d = document.createElement('div'); box.appendChild(d); problemCard(d, p, i + 1, u); });
  renderAsk($('#askbox'), u, c);
  view.querySelectorAll('[data-more]').forEach(b => b.onclick = async () => {
    if (!AI.hasKey()) { toast('設定で AI の API キーを登録してください'); return; }
    const lv = +b.dataset.more; const out = $('#moreout');
    out.innerHTML = '<div class="spinner"></div>';
    try {
      const raw = await AI.generateProblems(u, S.name, lv, 3);
      const ps = validProblems(raw.map(x => ({ ...x, lv })), `${id}#x${Date.now().toString(36)}-`);
      if (!ps.length) throw new Error('検算できる問題が作れませんでした。もう一度お試しください。');
      (st.aiProblems[id] ||= []).push(...ps); save();
      out.innerHTML = `<p class="small okc">${ps.length} 問追加しました！ 下に表示されています。</p>`;
      ps.forEach((p, k) => { const d = document.createElement('div'); box.appendChild(d); problemCard(d, p, probs.length + k + 1, u); renderMath(d); });
    } catch (e) { out.innerHTML = `<p class="ngc small">${esc(e.message)}</p>`; }
  });
  const rg = $('#regen'); if (rg) rg.onclick = () => { if (confirm('AI に教材と問題を作り直してもらいますか？')) { delete st.aiUnits[id]; save(); unit(id); } };
}

// ---------- 問題カード ----------
const KEYS = [['√', '√'], ['π', 'π'], ['^', '^'], ['/', '/'], ['(', '('], [')', ')'], ['−', '-'], ['×10^', '×10^'], ['x', 'x'], ['sin', 'sin('], ['cos', 'cos('], ['log', 'log10(']];
function problemCard(box, p, num, u) {
  const st = getState(); const S = SUBJECTS[u.sub];
  const rec = () => st.answers[p.id] || {};
  let usedHint = false, tries = 0, history = [];
  const lvName = ['', '基本', '標準', 'ボス'][p.lv] || '基本';
  box.className = `pcard lv${p.lv}${rec().ok ? ' solved' : ''}`;
  box.innerHTML = `<div class="row-between"><span class="lvbadge l${p.lv}">${p.lv === 3 ? '👾 ' : ''}${'★'.repeat(p.lv)} ${lvName}</span><span class="small">${p.ai ? '<span class="tag ai">AI</span> ' : ''}${rec().ok ? '<span class="pill done">✓ 正解済み</span>' : `問${num}`}</span></div>
    <div class="lesson q">${md(p.q)}</div>
    ${p.type === 'choice' ? `<div class="opts">${p.choices.map((ch, i) => `<button class="opt" data-c="${i + 1}">${i + 1}. ${md(ch).replace(/^<p>|<\/p>$/g, '')}</button>`).join('')}</div>`
      : `<div class="ansrow"><input class="ans" ${p.type === 'num' ? 'inputmode="decimal"' : ''} placeholder="${p.type === 'expr' ? '式で答える（例: 2x+3）' : '数値で答える（例: 1/3, √2, 2.5e3）'}" autocomplete="off" autocapitalize="off"><span class="unit">${esc(p.unit || '')}</span><button class="btn primary chk">答え合わせ</button></div>
         <div class="keys">${KEYS.filter(([l]) => p.type === 'expr' || !['x'].includes(l)).map(([l, v]) => `<button type="button" data-k="${esc(v)}">${esc(l)}</button>`).join('')}</div><div class="preview tiny muted"></div>`}
    <div class="btn-row"><button class="btn sm hintb">💡 ヒント</button><button class="btn sm solb">📖 解説</button>${AI.hasKey() ? '<button class="btn sm aib">🤖 AI 先生に聞く</button>' : ''}</div>
    <div class="fb"></div><div class="aiout"></div>`;
  const fb = $('.fb', box);
  const showSolution = () => { fb.insertAdjacentHTML('beforeend', `<div class="sol lesson"><b>📖 解説</b>${md(p.solution)}</div>`); renderMath(fb); };
  const finish = (ok, given) => {
    tries++;
    const r = st.answers[p.id] || { tries: 0 };
    r.tries = (r.tries || 0) + 1; r.ts = Date.now(); r.lastOk = ok;
    if (ok && !r.ok) { r.ok = true; r.firstOk = tries === 1; }
    st.answers[p.id] = r; save(); logActivity('answer', p.id);
    if (ok) {
      combo++;
      const gain = tries === 1 ? p.lv * 10 + (usedHint ? 0 : 5) : p.lv * 5;
      const comboBonus = combo >= 3 ? combo * 2 : 0;
      const first = r.tries === tries;   // この問題で初めての正解
      const day = (st.daily[todayKey()] ||= { correct: 0 });
      if (first) day.correct++;
      save();
      if (first) addXP(gain + comboBonus); else addXP(2);
      box.classList.add('solved', 'pop'); setTimeout(() => box.classList.remove('pop'), 600);
      confetti(p.lv === 3 ? 90 : 30);
      fb.innerHTML = `<div class="result ok">⭕ 正解！ ${pick(PRAISE)} ${first ? `<b>+${gain + comboBonus} XP</b>${comboBonus ? `（🔥${combo}コンボ +${comboBonus}）` : ''}` : '（復習 +2 XP）'}</div>`;
      if (p.lv === 3 && first) setTimeout(() => celebrate('👾 ボス撃破！'), 300);
      const goal = +st.settings.dailyGoal || 5;
      if (first && day.correct === goal && !day.bonus) { day.bonus = true; save(); addXP(50); setTimeout(() => celebrate('✅ 今日のミッション達成！ +50 XP'), 1200); }
      showSolution();
      checkBadges();
    } else {
      combo = 0;
      box.classList.add('shake'); setTimeout(() => box.classList.remove('shake'), 500);
      fb.innerHTML = `<div class="result ng">❌ ${esc(given?.msg || pick(CHEER))}${tries >= 2 ? '　💡 ヒントや解説を見てもOK！' : ''}</div>`;
    }
  };
  if (p.type === 'choice') {
    box.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      const ok = b.dataset.c === String(p.ans);
      b.classList.add(ok ? 'correct' : 'wrong');
      if (ok) box.querySelectorAll('.opt').forEach(o => { o.disabled = true; });
      finish(ok);
    });
  } else {
    const inp = $('.ans', box), prev = $('.preview', box);
    const doCheck = () => {
      const v = inp.value.trim(); if (!v) { toast('答えを入力してね'); return; }
      const r = check({ type: p.type, ans: p.ans, tol: p.tol ?? (p.type === 'num' ? 0.02 : undefined) }, v);
      if (r.msg && !r.ok && /入力|使えない|カッコ|余分|文字/.test(r.msg)) { fb.innerHTML = `<div class="result ng">⚠ ${esc(r.msg)}</div>`; return; }
      finish(r.ok, r);
    };
    $('.chk', box).onclick = doCheck;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doCheck(); });
    inp.addEventListener('input', () => { try { const v = inp.value.trim(); if (!v) { prev.textContent = ''; return; } if (p.type === 'num') { const x = calc(v); prev.textContent = isFinite(x) ? `＝ ${+x.toPrecision(6)}` : ''; } else { parse(v); prev.textContent = '式として読み取れました'; } } catch (e) { prev.textContent = e instanceof MathErr ? e.message : ''; } });
    box.querySelectorAll('[data-k]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { const s = inp.selectionStart ?? inp.value.length; inp.setRangeText(b.dataset.k, s, inp.selectionEnd ?? s, 'end'); inp.focus(); inp.dispatchEvent(new Event('input')); }; });
  }
  $('.hintb', box).onclick = () => { usedHint = true; fb.insertAdjacentHTML('beforeend', `<div class="ai-box">💡 ${md(p.hint).replace(/^<p>|<\/p>$/g, '')}</div>`); renderMath(fb); };
  $('.solb', box).onclick = () => { if (!rec().ok && !confirm('解説を見ますか？（自分で考えてからの方が身につくよ。見たあとに解いても XP はもらえます）')) return; showSolution(); };
  const aib = $('.aib', box);
  if (aib) aib.onclick = () => {
    const out = $('.aiout', box);
    out.innerHTML = `<div class="aibox"><div class="chips"><button class="chip" data-a="hint">ヒントを3段階で</button><button class="chip" data-a="explain">最初からやさしく解説</button>${tries && !rec().ok ? '<button class="chip" data-a="wrong">自分の答えのどこが違う？</button>' : ''}</div>
      <div class="chat"></div><div class="cmdinput"><input placeholder="質問（例：なぜ 1/2 が付くの？）" data-q><button class="btn sm" data-a="ask">送信</button></div></div>`;
    const chat = $('.chat', out);
    out.onclick = async e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      const qi = $('[data-q]', out); const question = a === 'ask' ? qi.value.trim() : ''; if (a === 'ask' && !question) return;
      const label = { hint: 'ヒントをください', explain: '最初からやさしく解説して', wrong: '自分の答えのどこが違う？', ask: question }[a];
      chat.insertAdjacentHTML('beforeend', `<div class="msg user">${esc(label)}</div><div class="msg ai"><div class="spinner"></div></div>`);
      const slot = chat.lastElementChild; if (a === 'ask') qi.value = '';
      try {
        const r = await AI.tutor(a, { subject: S.name, unitTitle: u.title, problem: p, studentAnswer: p.type === 'choice' ? '' : $('.ans', box)?.value, question, history });
        history = r.messages.slice(-8); slot.innerHTML = md(r.text); renderMath(slot); logActivity('ai', p.id);
      } catch (er) { slot.innerHTML = `<span class="ngc">${esc(er.message)}</span>`; }
    };
  };
}

function renderAsk(box, u, c) {
  if (!AI.hasKey()) { box.innerHTML = '<p class="tiny muted">🤖 設定で AI の API キーを登録すると、解説の分からないところを AI 先生に質問できます。</p>'; return; }
  const S = SUBJECTS[u.sub];
  box.innerHTML = `<details class="card guide"><summary><b>🤖 解説の分からないところを AI 先生に質問</b></summary>
    <div style="margin-top:8px"><div class="chips"><button class="chip" data-p="この単元を、もっとやさしく、身近なたとえを使って説明して。">もっとやさしく</button><button class="chip" data-p="この単元の公式が、なぜそうなるのかを中学生にも分かるように説明して。">公式の意味</button><button class="chip" data-p="この単元で、テストでよく間違えるポイントと対策を教えて。">テストの注意点</button><button class="chip" data-p="この単元の内容を、数値の具体例を1つ使って最初から説明して。">例で説明</button></div>
    <div class="chat"></div><div class="cmdinput"><input placeholder="例：加速度の単位がなぜ m/s² なの？" data-q><button class="btn sm" data-send>送信</button></div></div></details>`;
  const chat = $('.chat', box); let history = [];
  const text = [c.image, c.detail, c.formulas].join('\n\n');
  const ask = async q => {
    chat.insertAdjacentHTML('beforeend', `<div class="msg user">${esc(q)}</div><div class="msg ai"><div class="spinner"></div></div>`);
    const slot = chat.lastElementChild;
    try { const r = await AI.askUnit({ subject: S.name, unitTitle: u.title, text, question: q, history }); history = r.messages.slice(-8); slot.innerHTML = md(r.text); renderMath(slot); logActivity('ai', u.id); }
    catch (e) { slot.innerHTML = `<span class="ngc">${esc(e.message)}</span>`; }
  };
  box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => ask(b.dataset.p));
  $('[data-send]', box).onclick = () => { const i = $('[data-q]', box); if (i.value.trim()) { ask(i.value.trim()); i.value = ''; } };
}

// ---------- まちがえた問題 ----------
function wrongList() {
  const st = getState(); const out = [];
  for (const [id, a] of Object.entries(st.answers)) if (a.lastOk === false) { const p = findProblem(id); if (p) out.push({ p, u: unitById(id.split('#')[0]) }); }
  return out;
}
function review() {
  const list = wrongList();
  view.innerHTML = `<h1>🔁 まちがえた問題</h1>${list.length ? `<p class="small muted">最後に間違えた問題です。正解すると、このリストから消えます（次に開いたとき）。</p><div id="rv"></div>` : '<div class="card">間違えた問題はありません 🎉 この調子！</div>'}`;
  const box = $('#rv');
  list.forEach(({ p, u }, i) => { const h = document.createElement('div'); h.className = 'small muted'; h.style.margin = '10px 0 2px'; h.innerHTML = `${SUBJECTS[u.sub].icon} ${esc(u.title)}`; box?.appendChild(h); const d = document.createElement('div'); box.appendChild(d); problemCard(d, p, i + 1, u); });
}

// ---------- タイムアタック ----------
let timer = null;
function challenge(sub) {
  clearInterval(timer);
  const st = getState();
  if (!SUBJECTS[sub]) {
    view.innerHTML = `<h1>⏱ タイムアタック</h1><p class="small muted">3分間で5問。早く正解するほど高得点！ 解説を読んだ単元の問題から出題されます。</p>
      ${SUB_IDS.map(s => `<a class="card row-between" href="#/challenge/${s}" style="border-left:5px solid ${SUBJECTS[s].color}"><span>${SUBJECTS[s].icon} <b>${SUBJECTS[s].name}</b></span><span class="small">ベスト ${st.challenge[s] ?? '—'} 点 ▶</span></a>`).join('')}`;
    return;
  }
  const units = UNITS.filter(u => u.sub === sub && contentOf(u.id));
  const pool = units.flatMap(u => problemsOf(u.id).filter(p => p.lv <= 2).map(p => ({ p, u })));
  if (pool.length < 5) { view.innerHTML = `<div class="card">まだ問題が少ないよ。${SUBJECTS[sub].name}の単元を開いて練習してからチャレンジしよう！</div>`; return; }
  const qs = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
  let left = 180, score = 0, idx = 0, okN = 0;
  view.innerHTML = `<div class="row-between"><h1 style="margin:0">⏱ ${SUBJECTS[sub].name} タイムアタック</h1><span class="timer" id="tm">3:00</span></div>
    <div class="row-between small"><span id="prog">1 / 5 問目</span><span>得点 <b id="sc">0</b></span></div><div id="cq"></div>`;
  const end = () => {
    clearInterval(timer);
    const best = st.challenge[sub] ?? 0; const isBest = score > best;
    if (isBest || st.challenge[sub] == null) st.challenge[sub] = Math.max(score, best);
    save(); logActivity('challenge', sub); addXP(Math.round(score / 4)); checkBadges();
    if (isBest) confetti(80);
    view.innerHTML = `<div class="card center"><h1>${isBest ? '🎉 ハイスコア！' : '⏱ 終了！'}</h1><div class="big">${score} 点</div><p>${okN} / 5 問正解　（ベスト ${st.challenge[sub]} 点）</p><p class="small">+${Math.round(score / 4)} XP</p>
      <div class="btn-row" style="justify-content:center"><a class="btn primary" href="#/challenge/${sub}" onclick="location.reload()">もう一度</a><a class="btn" href="#/review">まちがえた問題を復習</a></div></div>`;
  };
  const show = () => {
    if (idx >= qs.length) return end();
    $('#prog').textContent = `${idx + 1} / 5 問目`;
    const box = $('#cq'); box.innerHTML = '';
    const d = document.createElement('div'); box.appendChild(d);
    const { p, u } = qs[idx];
    problemCard(d, p, idx + 1, u); renderMath(d);
    const nextBtn = document.createElement('div'); nextBtn.className = 'btn-row'; nextBtn.innerHTML = '<button class="btn">スキップ ▶</button>'; box.appendChild(nextBtn);
    nextBtn.firstChild.onclick = () => { idx++; show(); };
    const obs = new MutationObserver(() => {
      if ($('.result.ok', d)) { obs.disconnect(); okN++; score += p.lv * 20 + Math.round(left / 6); $('#sc').textContent = score; setTimeout(() => { idx++; show(); }, 1200); }
    });
    obs.observe(d, { subtree: true, childList: true });
  };
  timer = setInterval(() => { left--; const el = $('#tm'); if (!el) { clearInterval(timer); return; } el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; if (left <= 30) el.classList.add('hurry'); if (left <= 0) end(); }, 1000);
  show();
}

// ---------- AI 先生（写真で質問・なんでも質問） ----------
function aiPage(tab) {
  const st = getState();
  const t = tab === 'ask' ? 'ask' : 'photo';
  view.innerHTML = `<h1>🤖 AI 先生</h1><div class="chips"><a class="chip ${t === 'photo' ? 'on' : ''}" href="#/ai/photo">📷 写真で質問</a><a class="chip ${t === 'ask' ? 'on' : ''}" href="#/ai/ask">💬 なんでも質問</a></div>
    ${AI.hasKey() ? '' : '<div class="card small">AI 先生を使うには <a href="#/settings">設定</a> で Claude か OpenAI の API キーを登録してください（保護者の方が登録してください）。利用料金の目安はホームに表示されます。</div>'}
    <div id="aw"></div>`;
  const w = $('#aw');
  if (t === 'photo') {
    w.innerHTML = `<div class="card"><p class="small" style="margin-top:0">問題集やノートの<b>分からない問題を撮影</b>して送ると、AI 先生が中学生にも分かる言葉で、1ステップずつ解説します。</p>
      <label class="btn primary block">📷 写真を撮る／選ぶ<input type="file" accept="image/*" capture="environment" id="ph" hidden></label>
      <img id="phprev" class="phprev hide" alt="">
      <div class="form" style="margin-top:8px"><label class="small">どの問題？ どこが分からない？（任意）<input id="note" placeholder="例：問3の(2)。なぜ 2 倍するのか分からない"></label></div>
      <div class="btn-row"><button class="btn primary" id="send" disabled>解説してもらう</button></div></div>
      <div class="chat" id="pchat"></div>
      <div class="cmdinput hide" id="pfollow"><input placeholder="続けて質問（例：③の式をもっと詳しく）"><button class="btn sm">送信</button></div>
      <p class="tiny muted">写真は解説のためにだけ AI に送られ、この端末には保存されません。顔や個人情報が写らないようにしてください。</p>`;
    let image = null, history = [];
    $('#ph').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { image = await shrink(f); $('#phprev').src = `data:${image.media};base64,${image.data}`; $('#phprev').classList.remove('hide'); $('#send').disabled = !AI.hasKey(); }
      catch { toast('画像を読み込めませんでした'); }
    };
    const chat = $('#pchat');
    $('#send').onclick = async () => {
      if (!image) return;
      $('#send').disabled = true; history = [];
      chat.innerHTML = `<div class="msg user">📷 写真の問題${$('#note').value ? '：' + esc($('#note').value) : ''}</div><div class="msg ai"><div class="spinner"></div><div class="tiny muted center">写真を読み取って解説を考えています…</div></div>`;
      const slot = chat.lastElementChild;
      try { const r = await AI.photo({ image, note: $('#note').value.trim() }); history = r.messages; slot.innerHTML = md(r.text); renderMath(slot); $('#pfollow').classList.remove('hide'); logActivity('photo', 'photo'); checkBadges(); }
      catch (er) { slot.innerHTML = `<span class="ngc">${esc(er.message)}</span>`; }
      $('#send').disabled = false;
    };
    const fu = $('#pfollow');
    fu.querySelector('button').onclick = async () => {
      const inp = fu.querySelector('input'); const q = inp.value.trim(); if (!q || !history.length) return; inp.value = '';
      chat.insertAdjacentHTML('beforeend', `<div class="msg user">${esc(q)}</div><div class="msg ai"><div class="spinner"></div></div>`);
      const slot = chat.lastElementChild;
      try { const r = await AI.followUp(history, q); history = r.messages; slot.innerHTML = md(r.text); renderMath(slot); }
      catch (er) { slot.innerHTML = `<span class="ngc">${esc(er.message)}</span>`; }
    };
    return;
  }
  const hist = (st.chats.free ||= []);
  w.innerHTML = `<div class="form"><label class="small">教科<select id="sj">${SUB_IDS.map(s => `<option value="${s}">${SUBJECTS[s].icon} ${SUBJECTS[s].name}</option>`).join('')}</select></label>
    <textarea id="fq" rows="3" placeholder="例：モルって結局なに？／微分と積分の関係を教えて／運動方程式の立て方のコツは？"></textarea></div>
    <div class="btn-row"><button class="btn primary" id="fs">質問する</button><button class="btn sm" id="fc">履歴を消す</button></div><div class="chat" id="fchat"></div>`;
  const chat = $('#fchat');
  const draw = () => { chat.innerHTML = hist.map(h => `<div class="msg ${h.role === 'user' ? 'user' : 'ai'}">${h.role === 'user' ? esc(h.content) : md(h.content)}</div>`).join(''); renderMath(chat); };
  draw();
  $('#fc').onclick = () => { hist.length = 0; save(); draw(); };
  $('#fs').onclick = async () => {
    const q = $('#fq').value.trim(); if (!q) return;
    $('#fq').value = ''; hist.push({ role: 'user', content: q }); draw();
    chat.insertAdjacentHTML('beforeend', '<div class="msg ai"><div class="spinner"></div></div>');
    try { const r = await AI.askUnit({ subject: SUBJECTS[$('#sj').value].name, unitTitle: '（自由な質問）', text: '', question: q, history: hist.slice(0, -1).slice(-8) }); hist.push({ role: 'assistant', content: r.text }); if (hist.length > 40) hist.splice(0, hist.length - 40); save(); logActivity('ai', 'free'); }
    catch (e) { hist.pop(); toast(e.message, 4000); }
    draw();
  };
}
// 写真を小さくして base64 に（送信量と料金を抑える）
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1600; const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve({ media: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.85).split(',')[1] });
    };
    img.onerror = reject; img.src = url;
  });
}

// ---------- 記録とバッジ ----------
function records() {
  const st = getState(); const lv = levelOf(st.xp);
  const days = []; const counts = {};
  for (const l of st.log) if (l.kind === 'answer') { const d = todayKey(new Date(l.ts)); counts[d] = (counts[d] || 0) + 1; }
  for (let i = 27; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const c = counts[todayKey(d)] || 0; days.push(c >= 10 ? 3 : c >= 5 ? 2 : c ? 1 : 0); }
  view.innerHTML = `<h1>🏆 記録とバッジ</h1>
    <div class="card"><div class="lvline"><b>Lv.${lv}</b> ${esc(titleOf(lv))}　<span class="small muted">${st.xp} XP</span></div>
      <div class="small muted" style="margin-top:4px">称号：${TITLES.map(([l, t]) => `<span class="${lv >= l ? '' : 'dim'}">Lv.${l} ${t}</span>`).join(' → ')}</div></div>
    <div class="card"><h2>🏅 バッジ（${Object.keys(st.badges).length}/${BADGES.length}）</h2><div class="badges">${BADGES.map(([id, ic, name]) => `<div class="bdg ${st.badges[id] ? 'got' : ''}"><div class="bi">${st.badges[id] ? ic : '🔒'}</div><div class="tiny">${esc(name)}</div></div>`).join('')}</div></div>
    <div class="card"><h2>📅 直近4週間</h2><div class="cal28">${days.map(l => `<div class="l${l}"></div>`).join('')}</div><div class="tiny muted">1日に解いた問題の数で色が濃くなります</div></div>
    <div class="card"><h2>📊 教科ごと</h2><table class="cmp"><tr><th>教科</th><th>正解した問題</th><th>⭐</th><th>タイムアタック</th></tr>${SUB_IDS.map(s => { const us = UNITS.filter(u => u.sub === s); const ok = us.reduce((a, u) => a + unitStats(u.id).ok, 0); const stars = us.reduce((a, u) => a + unitStats(u.id).stars, 0);
      return `<tr><td>${SUBJECTS[s].icon} ${SUBJECTS[s].name}</td><td>${ok}</td><td>${stars}</td><td>${st.challenge[s] ?? '—'}</td></tr>`; }).join('')}</table></div>`;
}

// ---------- 公式集 ----------
function formulas(sub) {
  if (!SUBJECTS[sub]) sub = 'phy';
  const us = UNITS.filter(u => u.sub === sub && contentOf(u.id));
  view.innerHTML = `<div class="row-between"><h1 style="margin:0">📘 ${SUBJECTS[sub].name}の公式集</h1><a class="small" href="#/sub/${sub}">← 単元一覧</a></div>
    <p class="small muted">教材のある単元の公式カードをまとめています。</p>
    ${us.map(u => `<div class="card lesson formula-card"><h3 style="margin-top:0"><a href="#/unit/${u.id}">${esc(u.title)}</a></h3>${md(contentOf(u.id).formulas)}</div>`).join('') || '<div class="card">まだありません</div>'}`;
}

// ---------- 設定 ----------
function settings() {
  const st = getState(); const s = st.settings;
  view.innerHTML = `
    <div class="card"><h2>👤 プロフィール</h2><div class="form">
      <label>ニックネーム（ホームのあいさつに表示）<input id="nm" value="${esc(s.name)}" placeholder="例：たろう"></label>
      <label>1日のミッション（正解する問題数）<input type="number" id="dg" min="1" max="50" value="${esc(s.dailyGoal || 5)}"></label>
      <label>テーマ<select id="theme"><option value="">端末に合わせる</option><option value="light" ${s.theme === 'light' ? 'selected' : ''}>ライト</option><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>ダーク</option></select></label></div></div>
    <div class="card"><h2>🤖 AI 先生（任意・保護者の方が設定してください）</h2>
      <p class="small">API キーを登録すると、①問題のヒント・解説・質問 ②写真の問題の解説 ③教材のない単元の教材づくり ④追加の練習問題づくり が使えます。</p>
      <div class="form">
        <label>使用するAI<select id="prov"><option value="none" ${AI.provider() == null && s.aiProvider !== 'anthropic' && s.aiProvider !== 'openai' ? 'selected' : ''}>使わない</option><option value="anthropic" ${AI.provider() === 'anthropic' || s.aiProvider === 'anthropic' ? 'selected' : ''}>Claude（Anthropic）</option><option value="openai" ${AI.provider() === 'openai' || s.aiProvider === 'openai' ? 'selected' : ''}>OpenAI（ChatGPT）</option></select></label>
        <div id="provAnthropic" class="form">
          <label>Anthropic API キー<input type="password" id="ckey" value="${esc(s.apiKey)}" placeholder="sk-ant-..." autocomplete="off"></label>
          <label>モデル<select id="claudeModel">${AI.CLAUDE_MODELS.map(m => `<option value="${m.id}" ${(s.claudeModel || 'claude-opus-5-5') === m.id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></label>
          <p class="small muted">料金はモデルごとに自動で計算されます（Opus $4 / $20、Sonnet $2 / $10、Haiku $0.10 / $0.50 ／100万トークン：入力 / 出力）。写真の読み取りや難しい問題の解説は Opus か Sonnet がおすすめです。</p>
        </div>
        <div id="provOpenAI" class="form">
          <label>OpenAI API キー<input type="password" id="key" value="${esc(s.openaiKey)}" placeholder="sk-..." autocomplete="off"></label>
          <label>モデル<select id="model"></select></label>
          <label id="modelCustomWrap" class="hide">モデル名を直接入力<input id="modelCustom" value="${esc(s.openaiModel)}" placeholder="${AI.OPENAI_DEFAULT}" autocomplete="off" autocapitalize="off"></label>
          <div class="btn-row" style="margin-top:0"><button class="btn sm" id="listm">このキーで使えるモデル一覧を取得</button><span id="modelsStatus" class="small muted"></span></div>
          <div class="two"><label>単価：入力（$/100万トークン）<input type="number" id="pin" min="0" step="0.01" value="${esc(s.openaiPriceIn)}" placeholder="例 2"></label>
          <label>単価：出力（$/100万トークン）<input type="number" id="pout" min="0" step="0.01" value="${esc(s.openaiPriceOut)}" placeholder="例 10"></label></div>
          <p class="small muted">単価は任意。入れるとホームに推定金額が出ます（<a href="https://platform.openai.com/docs/pricing" target="_blank" rel="noopener">OpenAI の料金ページ ↗</a>）。写真を読むには画像に対応したモデルを選んでください。</p>
        </div>
        <label>円換算（1ドル = 何円で表示するか）<input type="number" id="yen" min="50" max="400" value="${esc(s.yen || 150)}"></label>
      </div>
      <p class="small muted">キーはこの端末のブラウザ内にのみ保存され、選んだ会社の API への直接リクエストにだけ使われます。利用料金は各社 API の従量課金です（ChatGPT や Claude の月額プランとは別）。他の学習アプリとは別に保存されます。</p>
      <div class="btn-row"><button class="btn primary" id="saveAI">保存</button></div></div>
    <div class="card"><h2>💾 データ</h2><p class="small muted">学習記録はこの端末のブラウザに保存されています。ホーム画面のアイコンとブラウザでは別の保存場所になるので、いつも同じ方法で開いてください。ときどき書き出しておくと安心です。</p>
      <div class="btn-row"><button class="btn" id="exp">書き出し</button><label class="btn">読み込み<input type="file" id="imp" accept="application/json" hidden></label><button class="btn" id="reset" style="color:var(--ng)">すべてリセット</button></div></div>
    <div class="card small muted">教材と問題は、教科書・問題集の単元の順番に合わせたオリジナルです（問題集の問題そのものは載せていません）。問題集の問題は「📷 写真で質問」で AI 先生に聞けます。<br>ホーム画面に追加するとアプリのように使えます。</div>`;
  const drawModels = (list, selected) => { const ids = list.map(m => m.id); const sel = selected || ids[0] || AI.OPENAI_DEFAULT; const known = ids.includes(sel);
    $('#model').innerHTML = list.map((m, i) => `<option value="${esc(m.id)}" ${m.id === sel ? 'selected' : ''}>${esc(m.id)}${m.date ? `（${esc(m.date)}）` : ''}${i === 0 && m.date ? ' ★最新' : ''}</option>`).join('') + `<option value="__custom" ${known ? '' : 'selected'}>その他（直接入力）</option>`;
    if (!known) $('#modelCustom').value = sel; $('#modelCustomWrap').classList.toggle('hide', known); };
  const savedModels = (s.openaiModels || []).map(m => typeof m === 'string' ? { id: m, date: '' } : m);
  drawModels(savedModels.length ? savedModels : AI.OPENAI_SUGGESTED.map(id => ({ id, date: '' })), s.openaiModel || AI.OPENAI_DEFAULT);
  $('#model').onchange = () => $('#modelCustomWrap').classList.toggle('hide', $('#model').value !== '__custom');
  $('#listm').onclick = async () => { const key = $('#key').value.trim(); if (!key) { $('#modelsStatus').textContent = '先にキーを入力してください'; return; } $('#modelsStatus').textContent = '取得中…';
    try { const list = await AI.listModels(key); if (!list.length) throw new Error('使えるモデルが見つかりませんでした'); st.settings.openaiModels = list; save(); const cur = $('#model').value === '__custom' ? $('#modelCustom').value.trim() : $('#model').value; drawModels(list, list.some(m => m.id === cur) ? cur : list[0].id); $('#modelsStatus').textContent = `${list.length}件取得しました。モデルを選んで「保存」を押してください。`; }
    catch (e) { $('#modelsStatus').textContent = e.message; } };
  $('#key').onchange = () => { if ($('#key').value.trim()) $('#listm').click(); };
  const showProv = () => { $('#provAnthropic').classList.toggle('hide', $('#prov').value !== 'anthropic'); $('#provOpenAI').classList.toggle('hide', $('#prov').value !== 'openai'); };
  $('#prov').onchange = showProv; showProv();
  $('#saveAI').onclick = () => { const m = $('#model').value === '__custom' ? $('#modelCustom').value.trim() : $('#model').value;
    Object.assign(st.settings, { aiProvider: $('#prov').value, apiKey: $('#ckey').value.trim(), claudeModel: $('#claudeModel').value, openaiKey: $('#key').value.trim(), openaiModel: m || AI.OPENAI_DEFAULT, openaiPriceIn: $('#pin').value, openaiPriceOut: $('#pout').value, yen: +$('#yen').value || 150 });
    save(); toast('保存しました'); };
  $('#nm').onchange = e => { st.settings.name = e.target.value.trim(); save(); };
  $('#dg').onchange = e => { st.settings.dailyGoal = Math.max(1, Math.min(50, +e.target.value || 5)); save(); };
  $('#theme').onchange = e => { st.settings.theme = e.target.value; save(); applyTheme(); };
  $('#exp').onclick = () => { const blob = new Blob([exportData()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `rikalab-backup-${todayKey()}.json`; a.click(); };
  $('#imp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { importData(await f.text()); toast('読み込みました'); settings(); } catch { toast('読み込めませんでした'); } };
  $('#reset').onclick = () => { if (confirm('学習記録・設定をすべて消去しますか？')) { resetAll(); settings(); } };
}
function applyTheme() { const t = getState().settings.theme; if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }

applyTheme();
// KaTeX の読み込みを待ってから最初の描画（読み込めなくても表示はする）
const start = () => route();
if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
