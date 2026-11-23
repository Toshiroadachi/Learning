import { getState, save, logActivity, exportData, importData, resetAll, streak, todayCount } from './store.js';
import { PQ_LESSONS } from '../data/pq-lessons.js';
import { BI_LESSONS } from '../data/bi-lessons.js';
import { APPS_LESSONS } from '../data/apps-lessons.js';
import { REF, SHORTCUTS } from '../data/reference.js';
import { PC_TASKS } from '../data/pc-tasks.js';
import { EXPLAIN } from '../data/explain.js';
import { PQ_SOURCES, PQ_FILES } from '../data/pq-sources.js';
import { APPS } from '../data/apps-screens.js';
import { renderPQ, gradePQ, runQuery, gridHTML, startSteps } from './pqui.js';
import { renderDAX, renderDaxPlay, FIELDS } from './daxui.js';
import { renderFx, renderFxPlay } from './fxui.js';
import { grade as gradeDax } from './daxgrade.js';
import { grade as gradeFx } from './fxgrade.js';
import { baseModel } from './daxgrade.js';
import { displayVal } from './dax.js';
import * as M from './mlang.js';
import * as AI from './ai.js';
import { esc, md, toast } from './util.js';

const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');

export const TRACKS = {
  pq: { name: 'Excel パワークエリ', short: 'パワークエリ', icon: '🧹', lang: 'm', lessons: PQ_LESSONS, desc: 'データの取り込み・整形を自動化（M 言語）', play: 'M 言語エディター' },
  bi: { name: 'Power BI（DAX）', short: 'Power BI', icon: '📊', lang: 'dax', lessons: BI_LESSONS, desc: 'データモデルとメジャーで分析（DAX）', play: 'DAX 練習場' },
  apps: { name: 'Power Apps', short: 'Power Apps', icon: '📱', lang: 'fx', lessons: APPS_LESSONS, desc: 'ローコードで業務アプリ（Power Fx）', play: 'Power Apps 練習場' },
};
const TRACK_IDS = Object.keys(TRACKS);
const allExercises = () => {
  const out = [];
  for (const t of TRACK_IDS) for (const l of TRACKS[t].lessons) for (const ex of l.ex) out.push({ ...ex, track: t, lesson: l.id });
  for (const ex of getState().aiEx) out.push(ex);
  return out;
};
const findEx = id => allExercises().find(e => e.id === id);
const findLesson = id => { for (const t of TRACK_IDS) { const l = TRACKS[t].lessons.find(x => x.id === id); if (l) return { ...l, track: t }; } return null; };
const trackOf = id => TRACK_IDS.find(t => id.startsWith(t === 'apps' ? 'ap' : t)) || 'pq';

// ---------- 進捗 ----------
function lessonStatus(l) {
  const st = getState();
  const qOk = l.quiz.filter((_, i) => st.quiz[`${l.id}-${i}`]?.ok).length;
  const exOk = l.ex.filter(e => st.ex[e.id]?.passed).length;
  const done = !!st.lessons[l.id]?.done || (qOk === l.quiz.length && exOk === l.ex.length && (l.quiz.length + l.ex.length) > 0);
  return { qOk, exOk, done, total: l.quiz.length + l.ex.length, got: qOk + exOk };
}
function trackProgress(t) {
  const ls = TRACKS[t].lessons;
  const s = ls.map(lessonStatus);
  const exTotal = ls.reduce((a, l) => a + l.ex.length, 0);
  const exDone = s.reduce((a, x) => a + x.exOk, 0);
  const lessonsDone = s.filter(x => x.done).length;
  const next = ls.find((l, i) => !s[i].done) || ls[ls.length - 1];
  return { lessonsDone, lessons: ls.length, exDone, exTotal, next, pct: Math.round(100 * (s.reduce((a, x) => a + x.got, 0)) / Math.max(1, s.reduce((a, x) => a + x.total, 0))) };
}

// ---------- ルーター ----------
let current = null;
function route() {
  current = null;
  const hash = location.hash || '#/home';
  const [, name, arg] = hash.match(/^#\/(\w+)\/?(.*)$/) || [, 'home', ''];
  const tabOf = { home: 'home', courses: 'courses', track: 'courses', lesson: 'courses', ex: 'courses', ref: 'courses', pc: 'courses', review: 'courses', play: 'play', ai: 'ai', settings: 'settings' };
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.route === tabOf[name]));
  window.scrollTo(0, 0);
  const views = { home, courses, track, lesson, ex: exercise, play, ref, pc, ai, review, settings };
  (views[name] || home)(decodeURIComponent(arg));
}
window.addEventListener('hashchange', route);

// ---------- AI 利用状況 ----------
function aiUsageCard() {
  const st = getState();
  const usage = st.aiUsage || [];
  if (!AI.hasKey() && !usage.length) return '';
  const ym = d => `${d.getFullYear()}-${d.getMonth() + 1}`;
  const month = ym(new Date());
  const all = AI.usageSummary(usage);
  const mon = AI.usageSummary(usage.filter(u => ym(new Date(u.ts)) === month));
  const yen = +st.settings.yen || 150;
  const k = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : String(v);
  const money = v => `$${v.toFixed(v < 1 ? 3 : 2)}（約${Math.round(v * yen).toLocaleString()}円）`;
  const costTxt = x => x.n === 0 ? '—' : x.unknown && x.usd === 0 ? '単価未設定' : money(x.usd) + (x.unknown ? '＋単価不明分' : '');
  const prov = AI.provider();
  const isOA = prov === 'openai' || (!prov && usage[usage.length - 1]?.provider !== 'anthropic');
  return `<div class="card">
    <div class="row-between"><h2 style="margin:0">AIの利用状況</h2><span class="pill">${prov ? AI.providerName() + '：' + esc(AI.currentModel()) : 'AI未設定'}</span></div>
    <table class="cmp" style="margin-top:6px">
      <tr><th></th><th>回数</th><th>トークン<br><small>入力/出力</small></th><th>推定金額</th></tr>
      <tr><td>今月</td><td>${mon.n}</td><td>${k(mon.in)} / ${k(mon.out)}</td><td>${costTxt(mon)}</td></tr>
      <tr><td>累計</td><td>${all.n}</td><td>${k(all.in)} / ${k(all.out)}</td><td>${costTxt(all)}</td></tr>
    </table>
    <p class="small muted" style="margin-bottom:0">このアプリで使った分の記録です（1ドル=${yen}円で概算）。${isOA && (st.settings.openaiPriceIn === '' || st.settings.openaiPriceIn == null) ? 'OpenAI の金額を出すには「設定」でモデルの単価を入力してください。' : ''}
    残高・正確な請求額は <a href="${isOA ? 'https://platform.openai.com/usage' : 'https://console.anthropic.com/usage'}" target="_blank" rel="noopener">${isOA ? 'OpenAI' : 'Anthropic'} の利用状況ページ ↗</a> で確認できます。</p>
  </div>`;
}

// ---------- ホーム ----------
function home() {
  const st = getState();
  const days = [];
  const counts = {};
  for (const l of st.log) { const d = new Date(l.ts).toDateString(); counts[d] = (counts[d] || 0) + 1; }
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const c = counts[d.toDateString()] || 0; days.push(c >= 8 ? 3 : c >= 4 ? 2 : c ? 1 : 0); }
  const wrong = wrongQuizzes().length;
  view.innerHTML = `
    <div class="card">
      <div class="row-between"><h1>Power Skills Dojo</h1><span class="pill">🔥 連続 ${streak()} 日</span></div>
      <p class="small muted" style="margin:0 0 6px">スマホで学んで、会社の Windows PC で使えるスキルに。Excel パワークエリ・Power BI・Power Apps を、本物と同じ式を書いて自動採点で練習します。</p>
      <div class="small">今日の学習：<b>${todayCount()}</b> 件</div>
      <div class="cal14">${days.map(l => `<div class="l${l}"></div>`).join('')}</div>
      <div class="tiny muted" style="text-align:right">直近14日</div>
    </div>
    ${TRACK_IDS.map(t => { const p = trackProgress(t); const T = TRACKS[t]; return `
      <a class="card track-${t}" href="#/lesson/${p.next.id}" style="border-left:5px solid var(--tc)">
        <div class="row" style="flex-wrap:nowrap"><div class="ring" style="--p:${p.pct}"><span>${p.pct}%</span></div>
          <div class="grow"><div><span class="tbadge">${T.icon} ${T.short}</span> <span class="small muted">レッスン ${p.lessonsDone}/${p.lessons}・演習 ${p.exDone}/${p.exTotal}</span></div>
          <div style="margin-top:2px"><b>次：</b>${esc(p.next.title)}</div><div class="small muted">${esc(p.next.goal)}</div></div></div>
      </a>`; }).join('')}
    ${wrong ? `<a class="card" href="#/review" style="border-left:4px solid var(--ng)"><b>🔁 クイズの復習</b>：間違えた問題が ${wrong} 問あります</a>` : ''}
    ${aiUsageCard()}
    <div class="grid2">
      <a class="tile" href="#/play/pq"><div class="t">🧪 練習場</div><div class="small muted">M・DAX・Power Fx を自由に書いて試す（採点なし）</div></a>
      <a class="tile" href="#/ai"><div class="t">🤖 AI に相談</div><div class="small muted">実務の悩み相談・数式の解説・演習問題の自動作成</div></a>
      <a class="tile" href="#/pc/pq"><div class="t">💻 PC で実践</div><div class="small muted">サンプル CSV をダウンロードして、会社の PC で同じ操作を再現</div></a>
      <a class="tile" href="#/ref/pq"><div class="t">📖 関数辞典・ショートカット</div><div class="small muted">M・DAX・Power Fx の関数と PC の操作</div></a>
    </div>`;
}

// ---------- コース一覧・コース ----------
function courses() {
  view.innerHTML = `<h1>コース</h1>
    ${TRACK_IDS.map(t => { const p = trackProgress(t); const T = TRACKS[t]; return `<a class="tile trk track-${t}" href="#/track/${t}" style="margin-bottom:10px">
      <div class="row-between"><span class="tbadge">${T.icon} ${T.name}</span><span class="small muted">${p.pct}%</span></div>
      <div class="small" style="margin-top:4px">${esc(T.desc)}</div><div class="progress"><div style="width:${p.pct}%;background:var(--tc)"></div></div>
      <div class="tiny muted">レッスン ${p.lessonsDone}/${p.lessons}・演習 ${p.exDone}/${p.exTotal}</div></a>`; }).join('')}
    <div class="card small"><b>おすすめの順番</b>：パワークエリ（データを整える）→ Power BI（分析する）→ Power Apps（入力・業務を回す）。Power BI の中でも Power Query が使われるので、パワークエリから始めると効率的です。</div>
    <div class="grid2"><a class="tile" href="#/review">🔁 クイズの復習</a><a class="tile" href="#/ai/gen">✨ AI で演習を作る</a></div>`;
}
function track(t) {
  if (!TRACKS[t]) t = 'pq';
  const T = TRACKS[t]; const st = getState();
  const aiList = st.aiEx.filter(e => e.track === t);
  view.innerHTML = `<div class="track-${t}">
    <div class="row-between" style="margin-bottom:6px"><a href="#/courses" class="small">← コース</a><span class="tbadge">${T.icon} ${T.name}</span></div>
    <h1>${esc(T.name)}</h1>
    <div class="chips"><a class="chip" href="#/play/${t}">🧪 ${T.play}</a><a class="chip" href="#/ref/${t}">📖 辞典</a><a class="chip" href="#/pc/${t}">💻 PC で実践</a><a class="chip" href="#/ai/gen/${t}">✨ AI で演習を作る</a></div>
    ${T.lessons.map((l, i) => { const s = lessonStatus(l); return `<a class="lesson-row ${s.done ? 'done' : ''}" href="#/lesson/${l.id}"><span class="num">${s.done ? '✓' : i + 1}</span><span class="grow"><b>${esc(l.title)}</b><div class="meta">${esc(l.goal)}</div><div class="meta">クイズ ${s.qOk}/${l.quiz.length}・演習 ${s.exOk}/${l.ex.length}</div></span></a>`; }).join('')}
    ${aiList.length ? `<h3>✨ AI が作った演習</h3>${aiList.map(e => `<a class="ex-row ${st.ex[e.id]?.passed ? 'passed' : ''}" href="#/ex/${e.id}"><span>${esc(e.title)}</span><span class="small">${st.ex[e.id]?.passed ? '✓' : '▶'}</span></a>`).join('')}` : ''}
  </div>`;
}

// ---------- レッスン ----------
function lesson(id) {
  const l = findLesson(id); if (!l) return home();
  const T = TRACKS[l.track]; const st = getState();
  const idx = T.lessons.findIndex(x => x.id === id);
  const next = T.lessons[idx + 1];
  const X = EXPLAIN[l.id];
  logActivity('lesson', id);
  view.innerHTML = `<div class="track-${l.track}">
    <div class="row-between" style="margin-bottom:6px"><a href="#/track/${l.track}" class="small">← ${T.short}</a><span class="tbadge">${T.icon} 第${idx + 1}回</span></div>
    <h1>${esc(l.title)}</h1><p class="small muted" style="margin-top:0">🎯 ${esc(l.goal)}</p>
    ${X ? `<div class="flow small">①イメージ → ②くわしい解説 → ③確認クイズ → ④演習 の順に進めましょう。</div>
    <div class="card lesson image-card"><h2 class="sec">🗺 イメージ</h2>${md(X.image)}</div>
    <div class="card lesson"><h2 class="sec">📖 くわしい解説</h2>${md(X.detail)}</div>
    <details class="card guide"><summary><b>📌 要点まとめ（復習用）</b><div class="small muted">解説の内容を短くまとめたもの</div></summary><div class="lesson" style="margin-top:8px">${md(l.body)}</div></details>
    <div class="card lesson pit-card"><h2 class="sec">⚠ つまずきやすいポイント</h2>${md(X.pitfalls)}</div>` : `<div class="card lesson">${md(l.body)}</div>`}
    <div id="askbox"></div>
    <details class="card guide"><summary><b>💻 PC（Windows）での操作</b><div class="small muted">会社の PC で同じことをする手順</div></summary><div class="lesson" style="margin-top:8px">${md(l.pc)}</div></details>
    ${l.quiz.length ? `<div class="card"><h2>✅ 確認クイズ</h2><div class="quizbox"></div></div>` : ''}
    ${l.ex.length ? `<div class="card"><h2>✍️ 演習（自動採点）</h2>${l.ex.map(e => `<a class="ex-row ${st.ex[e.id]?.passed ? 'passed' : ''}" href="#/ex/${e.id}"><span><b>${esc(e.title)}</b><div class="tiny muted">${esc(e.prompt.split('\n')[0].slice(0, 60))}…</div></span><span class="small">${st.ex[e.id]?.passed ? '✓ 合格' : '▶ 挑戦'}</span></a>`).join('')}</div>` : ''}
    <div class="btn-row">${lessonStatus(l).done ? '<span class="pill done">✓ このレッスンは完了</span>' : '<button class="btn" id="markDone">このレッスンを完了にする</button>'}
      ${next ? `<a class="btn primary" href="#/lesson/${next.id}">次のレッスン →</a>` : `<a class="btn primary" href="#/pc/${l.track}">PC で実践へ →</a>`}</div>
  </div>`;
  if (l.quiz.length) renderQuiz($('.quizbox'), l.quiz.map((q, i) => ({ ...q, key: `${l.id}-${i}` })));
  renderAsk($('#askbox'), l, X);
  const md0 = $('#markDone'); if (md0) md0.onclick = () => { st.lessons[l.id] = { done: true, ts: Date.now() }; save(); toast('完了にしました'); lesson(id); };
}
function renderAsk(box, l, X) {
  if (!AI.hasKey()) { box.innerHTML = '<p class="tiny muted" style="margin:0 0 10px">🤖 設定で AI の API キーを登録すると、このレッスンの分からないところを AI に質問できます。</p>'; return; }
  box.innerHTML = `<details class="card guide"><summary><b>🤖 分からないところを AI に質問</b><div class="small muted">このレッスンの内容をふまえて、かみくだいて説明してくれます</div></summary>
    <div style="margin-top:8px"><div class="chips"><button class="chip" data-p="このレッスンの内容を、もっとやさしく、身近なたとえを使って説明してください。">もっとやさしく</button><button class="chip" data-p="このレッスンの内容について、別の業務の例で、操作（または式）と結果を見せてください。">別の例で</button><button class="chip" data-p="このレッスンで、演習に取り組む前に必ず理解しておくべきポイントを3つに絞って教えてください。">大事なポイント3つ</button><button class="chip" data-p="このレッスンの内容を、会社の Windows PC で実際に使うときの手順と注意点を教えてください。">PC での使い方</button></div>
    <div class="chat"></div><div class="cmdinput" style="margin-top:8px"><input placeholder="例：each って結局何？" data-q><button class="btn" data-send>送信</button></div></div></details>`;
  const chat = box.querySelector('.chat'); let history = [];
  const text = [X?.image, X?.detail || l.body, X?.pitfalls].filter(Boolean).join('\n\n');
  const ask = async q => {
    chat.insertAdjacentHTML('beforeend', `<div class="msg user">${esc(q)}</div><div class="msg ai"><div class="spinner"></div></div>`);
    const slot = chat.lastElementChild;
    try { const r = await AI.askLesson({ track: l.track, title: l.title, text, question: q, history }); history = r.messages.slice(-8); slot.innerHTML = md(r.text); logActivity('ask', l.id); }
    catch (e) { slot.innerHTML = `<span class="ngc">${esc(e.message)}</span>`; }
  };
  box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => ask(b.dataset.p));
  box.querySelector('[data-send]').onclick = () => { const i = box.querySelector('[data-q]'); if (i.value.trim()) { ask(i.value.trim()); i.value = ''; } };
}
function shuffleIdx(n) { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function renderQuiz(box, qs, { onDone } = {}) {
  const st = getState();
  box.innerHTML = qs.map((q, qi) => { const order = shuffleIdx(q.choices.length); const prev = st.quiz[q.key];
    return `<div class="panel" data-q="${qi}"><div class="quiz-q">Q${qi + 1}. ${esc(q.q)}${prev?.ok ? ' <span class="pill done">✓</span>' : ''}</div><div class="opts">${order.map(ci => `<button class="opt" data-c="${ci}">${esc(q.choices[ci])}</button>`).join('')}</div><div class="fbx"></div></div>`; }).join('');
  box.onclick = e => {
    const b = e.target.closest('.opt'); if (!b || b.disabled) return;
    const p = b.closest('[data-q]'); const q = qs[+p.dataset.q]; const ci = +b.dataset.c;
    const ok = ci === q.a;
    p.querySelectorAll('.opt').forEach(o => { o.disabled = true; if (+o.dataset.c === q.a) o.classList.add('correct'); });
    if (!ok) b.classList.add('wrong');
    p.querySelector('.fbx').innerHTML = `<div class="fb ${ok ? 'ok' : 'ng'}">${ok ? '⭕ 正解！' : '❌ 不正解'}　${esc(q.exp)}</div>`;
    const prev = st.quiz[q.key] || {};
    st.quiz[q.key] = { ok: ok || !!prev.ok, wrongLast: !ok, ts: Date.now(), wrong: (prev.wrong || 0) + (ok ? 0 : 1) };
    save(); logActivity('quiz', q.key);
    if (onDone && [...box.querySelectorAll('[data-q]')].every(x => x.querySelector('.opt:disabled'))) onDone();
  };
}
function wrongQuizzes() {
  const st = getState(); const out = [];
  for (const t of TRACK_IDS) for (const l of TRACKS[t].lessons) l.quiz.forEach((q, i) => { const r = st.quiz[`${l.id}-${i}`]; if (r && r.wrongLast) out.push({ ...q, key: `${l.id}-${i}`, track: t, lesson: l.title }); });
  return out;
}
function review() {
  const list = wrongQuizzes();
  view.innerHTML = `<h1>🔁 クイズの復習</h1>${list.length ? `<p class="small muted">最後に間違えた問題です。正解すると一覧から消えます。</p><div class="quizbox"></div><div class="btn-row"><button class="btn" onclick="location.reload()">もう一度</button></div>` : '<div class="card">間違えた問題はありません 🎉</div>'}`;
  if (list.length) renderQuiz($('.quizbox'), list);
}

// ---------- 演習 ----------
function exercise(id) {
  const ex = findEx(id); if (!ex) return home();
  const t = ex.track; const T = TRACKS[t]; const st = getState();
  const l = ex.lesson ? findLesson(ex.lesson) : null;
  const siblings = l ? l.ex : st.aiEx.filter(e => e.track === t);
  const next = siblings[siblings.indexOf(siblings.find(e => e.id === id)) + 1];
  let attempts = 0;
  view.innerHTML = `<div class="track-${t}">
    <div class="row-between" style="margin-bottom:6px"><a href="${l ? `#/lesson/${l.id}` : `#/track/${t}`}" class="small">← ${l ? esc(l.title) : T.short}</a><span class="tbadge">${T.icon} ${ex.ai ? 'AI 演習' : '演習'}</span></div>
    <h1>${esc(ex.title)} ${st.ex[id]?.passed ? '<span class="pill done">✓ 合格済み</span>' : ''}</h1>
    <div class="prompt">${esc(ex.prompt)}</div>
    ${l || EXPLAIN[ex.lesson]?.steps?.[id] ? `<div class="row" style="margin-top:6px">${l ? `<a class="small" href="#/lesson/${l.id}">📖 解説を読み直す（${esc(l.title)}）</a>` : ''}</div>` : ''}
    ${EXPLAIN[ex.lesson]?.steps?.[id] ? `<details class="think"><summary>🧭 考え方（手順）を見る <span class="tiny muted">— 何をどの順にするか</span></summary><div class="lesson">${md(EXPLAIN[ex.lesson].steps[id])}</div></details>` : ''}
    ${t === 'pq' ? `<p class="tiny muted">${esc(PQ_SOURCES[ex.query]?.desc || (ex.file ? 'CSV ファイル: C:\\データ\\' + ex.file : ''))}</p>` : ''}
    ${t === 'apps' ? `<p class="tiny muted">プレビューは操作できます（入力・選択・ボタン）。数式バーの「${esc(ex.target.control)}.${esc(ex.target.prop)}」に式を書くと自動で反映されます。${ex.tests?.length ? `採点では ${ex.tests.length} 通りの入力で試します。` : ''}</p>` : ''}
    <div class="work" style="margin-top:10px"></div>
    <div class="sticky-actions"><div class="btn-row" style="margin:0">
      <button class="btn primary" data-a="grade">✔ 採点する</button>
      ${t === 'bi' ? `<button class="btn" data-a="commit">${ex.kind === 'column' ? '列を追加' : 'メジャーを確定'}</button>` : ''}
      <button class="btn sm" data-a="hint">💡 ヒント</button><button class="btn sm" data-a="answer">模範解答</button><button class="btn sm" data-a="reset">リセット</button></div></div>
    <div class="resbox"></div>
    <div class="aibox"></div>
    ${next ? `<div class="btn-row"><a class="btn" href="#/ex/${next.id}">次の演習 →</a></div>` : l ? `<div class="btn-row"><a class="btn" href="#/lesson/${l.id}">レッスンに戻る</a></div>` : ''}
  </div>`;
  const work = $('.work');
  const saveDraft = v => { st.drafts[id] = v; save(); };
  let ws;
  if (t === 'pq') ws = renderPQ(work, ex, { saved: st.drafts[id], onChange: saveDraft });
  else if (t === 'bi') ws = renderDAX(work, ex, { saved: st.drafts[id], onChange: saveDraft });
  else ws = renderFx(work, ex, { saved: st.drafts[id], onChange: saveDraft });
  const res = $('.resbox');
  let lastResultText = '';
  const doGrade = () => {
    attempts++;
    let r;
    if (t === 'pq') r = gradePQ(ex, ws.code());
    else r = ws.grade();
    lastResultText = r.ok ? '正解' : (r.test ? `テスト「${r.test}」: ` : '') + r.msg;
    if (r.ok) {
      const first = !st.ex[id]?.passed;
      st.ex[id] = { passed: true, code: ws.code(), ts: Date.now() }; save(); logActivity('ex', id);
      res.innerHTML = `<div class="result ok">🎉 正解です！${r.note || ''}${t === 'apps' && r.n > 1 ? `（${r.n} 通りの入力すべてで一致）` : ''}</div>${ex.explain ? `<div class="card lesson" style="margin-top:8px"><h3>解説</h3>${md(ex.explain)}</div>` : ''}`;
      if (first) toast('合格！');
      if (AI.hasKey()) tutorBox('review');
    } else {
      res.innerHTML = `<div class="result ng">${r.isError ? '⚠ エラー' : '✗ まだ違います'}${r.test ? `（テスト「${esc(r.test)}」）` : ''}：${esc(r.msg)}</div>${t === 'pq' && r.want ? `<details class="card" style="margin-top:8px"><summary class="small"><b>期待される結果を見る</b></summary><div style="margin-top:6px">${gridHTML(r.want, { clickable: false, maxRows: 30 })}</div></details>` : ''}${attempts >= 3 ? '<p class="small muted">行き詰まったら「ヒント」や AI 先生、「模範解答」を使いましょう。</p>' : ''}`;
    }
    res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  view.querySelector('.sticky-actions').onclick = e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'grade') doGrade();
    if (a === 'commit') { const r = ws.commit(); if (r.ok) res.innerHTML = ''; }
    if (a === 'hint') res.innerHTML = `<div class="ai-box">💡 ${esc(ex.hint)}</div>`;
    if (a === 'reset' && confirm('最初の状態に戻しますか？')) { ws.reset(); delete st.drafts[id]; save(); res.innerHTML = ''; }
    if (a === 'answer') {
      if (!confirm('模範解答を表示しますか？（自分で考えてからの方が身につきます）')) return;
      const lang = T.lang === 'm' ? 'powerquery' : T.lang;
      res.innerHTML = `<div class="card"><h3>模範解答</h3><pre class="code"><code>${esc(ex.solution)}</code></pre><p class="small muted">${t === 'pq' ? '操作の手順や列名が同じなら、ステップ名が違っても正解になります。' : '同じ結果になれば、別の書き方でも正解です。'}</p><div class="btn-row"><button class="btn sm" data-load>エディターに読み込む</button></div>${ex.explain ? md(ex.explain) : ''}</div>`;
      res.querySelector('[data-load]').onclick = () => { ws.setCode(ex.solution); toast('読み込みました。採点してみましょう'); };
    }
  };
  // AI 先生
  let history = [];
  function tutorBox(auto) {
    const box = $('.aibox');
    if (!AI.hasKey()) { box.innerHTML = `<p class="small muted">🤖 設定で AI（Claude / OpenAI）の API キーを登録すると、AI 先生にヒント・エラー解説・添削・質問ができます。</p>`; return; }
    box.innerHTML = `<div class="card"><h3 style="margin-top:0">🤖 AI 先生</h3><div class="btn-row" style="margin-top:0"><button class="btn sm" data-k="hint">段階的なヒント</button><button class="btn sm" data-k="error">結果・エラーを解説</button><button class="btn sm" data-k="review">添削（実務のコツ）</button></div>
      <div class="chat"></div><div class="cmdinput" style="margin-top:8px"><input placeholder="質問を入力（例: each って何？）" data-q><button class="btn" data-k="ask">送信</button></div></div>`;
    const chat = box.querySelector('.chat');
    const ask = async (kind, question) => {
      const q = question || { hint: 'ヒントをください', error: 'この結果を解説してください', review: '添削してください' }[kind];
      chat.insertAdjacentHTML('beforeend', `<div class="msg user">${esc(q)}</div><div class="msg ai"><div class="spinner"></div></div>`);
      const slot = chat.lastElementChild;
      try {
        const r = await AI.tutor(kind, { track: t, exercise: { ...ex, context: t === 'pq' ? `ソース「${ex.query || ex.file}」の列: ${(PQ_SOURCES[ex.query]?.cols || []).join(', ')}` : t === 'bi' ? `モデル: 売上(注文ID,日付,顧客ID,商品ID,担当者,数量,単価,金額) / 商品(商品ID,商品名,カテゴリ,標準単価,原価) / 顧客(顧客ID,顧客名,地域,区分) / カレンダー(日付,年,月,年月,四半期,曜日,会計年度)。リレーションシップは各ディメンション→売上の1対多。作るのは ${ex.kind === 'column' ? '計算列' : 'メジャー'} ${ex.name}${ex.given ? '。既存メジャー: ' + Object.entries(ex.given).map(([k, v]) => `[${k}] = ${v}`).join('; ') : ''}` : `アプリ: ${APPS[ex.app].title}。対象: ${ex.target.control}.${ex.target.prop}。データソース: ${Object.entries(APPS[ex.app].data).map(([k, rows]) => `${k}(${Object.keys(rows[0]).join(',')})`).join(' / ')}` }, code: ws.code(), result: lastResultText, question: kind === 'ask' ? question : '', history });
        history = r.messages.slice(-8);
        slot.innerHTML = md(r.text);
      } catch (e) { slot.innerHTML = `<span class="ngc">${esc(e.message)}</span>`; }
    };
    box.onclick = e => { const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return; if (k === 'ask') { const inp = box.querySelector('[data-q]'); if (!inp.value.trim()) return; ask('ask', inp.value.trim()); inp.value = ''; } else ask(k); };
    if (auto === 'review') { /* 合格時はボタンを押せば添削 */ }
  }
  tutorBox();
}

// ---------- 練習場 ----------
function play(t) {
  if (!TRACKS[t]) t = 'pq';
  const st = getState();
  st.play[t] ||= {};
  view.innerHTML = `<div class="track-${t}"><div class="chips" style="margin-bottom:8px">${TRACK_IDS.map(x => `<a class="chip ${x === t ? 'on' : ''}" href="#/play/${x}">${TRACKS[x].icon} ${TRACKS[x].play}</a>`).join('')}</div><div class="pw"></div></div>`;
  const pw = $('.pw');
  const sv = () => save();
  if (t === 'bi') { pw.insertAdjacentHTML('beforebegin', '<p class="small muted">メジャーを自由に作って、行・列・スライサーを切り替えて試せます（採点なし）。</p>'); renderDaxPlay(pw, st.play.bi, sv); return; }
  if (t === 'apps') { pw.insertAdjacentHTML('beforebegin', '<p class="small muted">ツリーでコントロールを選び、プロパティの数式を自由に書き換えて試せます（採点なし）。</p>'); renderFxPlay(pw, st.play.apps, sv); return; }
  const P = st.play.pq;
  P.source ||= '売上明細';
  const names = Object.keys(PQ_SOURCES);
  pw.innerHTML = `<p class="small muted">好きなソースを読み込んで、自由に整形を試せます（採点なし）。マージ・追加には他のソースを使えます。</p>
    <label class="small">ソース <select data-src>${[...names, ...Object.keys(PQ_FILES)].map(n => `<option ${n === P.source ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <div class="pqp" style="margin-top:8px"></div>`;
  const isFile = n => n in PQ_FILES;
  const mk = () => {
    const ex = { id: 'play', query: isFile(P.source) ? null : P.source, file: isFile(P.source) ? P.source : null, helpers: names.filter(n => n !== P.source) };
    renderPQ($('.pqp'), ex, { saved: P.drafts?.[P.source], onChange: v => { (P.drafts ||= {})[P.source] = v; save(); } });
  };
  $('[data-src]').onchange = e => { P.source = e.target.value; save(); mk(); };
  mk();
}

// ---------- 辞典 ----------
function ref(t) {
  if (!TRACKS[t]) t = 'pq';
  view.innerHTML = `<div class="track-${t}"><div class="chips" style="margin-bottom:8px">${TRACK_IDS.map(x => `<a class="chip ${x === t ? 'on' : ''}" href="#/ref/${x}">${TRACKS[x].icon} ${TRACKS[x].short}</a>`).join('')}</div>
    <input id="q" placeholder="検索（例: 合計、日付、Filter）" style="width:100%;margin-bottom:10px">
    <div id="refbody"></div>
    <div class="card"><h2>⌨️ PC の操作・ショートカット</h2><table class="cmp">${SHORTCUTS[t].map(([k, d]) => `<tr><td class="mono" style="white-space:nowrap"><b>${esc(k)}</b></td><td>${esc(d)}</td></tr>`).join('')}</table></div>
    <p class="tiny muted">公式ドキュメント: <a href="https://learn.microsoft.com/ja-jp/powerquery-m/" target="_blank" rel="noopener">M 言語</a> / <a href="https://learn.microsoft.com/ja-jp/dax/" target="_blank" rel="noopener">DAX</a> / <a href="https://learn.microsoft.com/ja-jp/power-platform/power-fx/formula-reference-overview" target="_blank" rel="noopener">Power Fx</a></p></div>`;
  const render = () => {
    const q = $('#q').value.trim().toLowerCase();
    $('#refbody').innerHTML = REF[t].map(c => {
      const items = c.items.filter(it => !q || (it.k + it.d + (it.ex || '')).toLowerCase().includes(q));
      if (!items.length) return '';
      return `<div class="card"><h2>${esc(c.cat)}</h2>${items.map(it => `<div class="ref-item"><div class="k">${esc(it.k)}</div><div class="d">${esc(it.d)}</div>${it.ex ? `<div class="ex">${esc(it.ex)}</div>` : ''}</div>`).join('')}</div>`;
    }).join('') || '<p class="muted">見つかりませんでした</p>';
  };
  $('#q').oninput = render; render();
}

// ---------- PC で実践 ----------
function csvFor(src) {
  const [kind, name] = src.split(':');
  const cell = v => { if (v == null) return ''; if (v && v.ms != null) { const d = new Date(v.ms); return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`; } const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  let cols, rows;
  if (kind === 'pq') { cols = PQ_SOURCES[name].cols; rows = PQ_SOURCES[name].rows; }
  else if (kind === 'pqmonth') { const s = PQ_SOURCES.売上明細; cols = s.cols; rows = s.rows.filter(r => r[1].startsWith(name)); }
  else if (kind === 'bi') { const tb = baseModel().tables[name]; cols = tb.cols; rows = tb.rows.map(r => cols.map(c => r[c])); }
  else { const data = APPS.expense.data[name] || APPS.catalog.data[name]; cols = Object.keys(data[0]); rows = data.map(r => cols.map(c => r[c])); }
  return '\uFEFF' + [cols, ...rows].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
function download(name, text) {
  const blob = new Blob([text], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function pc(t) {
  if (!TRACKS[t]) t = 'pq';
  const st = getState();
  view.innerHTML = `<div class="track-${t}"><div class="chips" style="margin-bottom:8px">${TRACK_IDS.map(x => `<a class="chip ${x === t ? 'on' : ''}" href="#/pc/${x}">${TRACKS[x].icon} ${TRACKS[x].short}</a>`).join('')}</div>
    <h1>💻 PC で実践</h1><p class="small muted">スマホで学んだ内容を、会社の Windows PC で再現する課題です。サンプル CSV はこのアプリの演習と同じデータなので、結果を見比べられます。スマホでダウンロードしたファイルは、メールや OneDrive で PC に送ってください（PC でこのページを開いてダウンロードしても OK）。</p>
    ${PC_TASKS[t].map(task => { const s = st.pc[task.id] || {}; const after = findLesson(task.after); return `<div class="card" data-task="${task.id}">
      <div class="row-between"><h2 style="margin:0">${s.done ? '✅ ' : ''}${esc(task.title)}</h2><span class="pill">⏱ ${esc(task.time)}</span></div>
      ${after ? `<div class="tiny muted">目安：「${esc(after.title)}」の後</div>` : ''}
      ${task.files.length ? `<div class="btn-row">${task.files.map(f => `<button class="btn sm dl" data-dl="${esc(f.src)}" data-name="${esc(f.name)}">⬇ ${esc(f.name)}</button>`).join('')}</div>` : ''}
      <ol class="pc-steps lesson">${task.steps.map((x, i) => `<li class="${s.steps?.[i] ? 'done' : ''}"><label class="row" style="align-items:flex-start;flex-wrap:nowrap"><input type="checkbox" data-step="${i}" ${s.steps?.[i] ? 'checked' : ''} style="margin-top:6px"> <span>${md(x).replace(/^<p>|<\/p>$/g, '')}</span></label></li>`).join('')}</ol>
      <div class="small"><b>できたらチェック：</b>${task.check.map(c => `<div>☐ ${esc(c)}</div>`).join('')}</div>
      <div class="btn-row"><button class="btn ${s.done ? '' : 'primary'} sm" data-done>${s.done ? '未完了に戻す' : '完了にする'}</button></div></div>`; }).join('')}</div>`;
  view.onclick = e => {
    const dl = e.target.closest('[data-dl]'); if (dl) { download(dl.dataset.name, csvFor(dl.dataset.dl)); return; }
    const card = e.target.closest('[data-task]'); if (!card) return;
    const id = card.dataset.task; const s = (st.pc[id] ||= {});
    const stp = e.target.closest('[data-step]'); if (stp) { (s.steps ||= {})[stp.dataset.step] = stp.checked; stp.closest('li').classList.toggle('done', stp.checked); save(); return; }
    if (e.target.closest('[data-done]')) { s.done = !s.done; s.ts = Date.now(); save(); if (s.done) logActivity('pc', id); pc(t); }
  };
}

// ---------- AI ----------
function ai(arg) {
  const [mode, sub] = (arg || '').split('/');
  const tabs = [['chat', '💬 実務相談'], ['explain', '🔍 数式の解説'], ['gen', '✨ 演習を作る']];
  const m = tabs.some(x => x[0] === mode) ? mode : 'chat';
  view.innerHTML = `<h1>🤖 AI</h1><div class="chips" style="margin-bottom:8px">${tabs.map(([k, l]) => `<a class="chip ${k === m ? 'on' : ''}" href="#/ai/${k}">${l}</a>`).join('')}</div>
    ${AI.hasKey() ? '' : '<div class="card small">AI 機能を使うには <a href="#/settings">設定</a> で Claude または OpenAI の API キーを登録してください。利用料金は各社 API の従量課金で、ホーム画面に使った金額の目安が表示されます。</div>'}
    <div class="aiw"></div>`;
  const w = $('.aiw'); const st = getState();
  if (m === 'chat') {
    const hist = st.chats.consult ||= [];
    w.innerHTML = `<p class="small muted">「毎月の CSV を自動で集計したい」「営業ごとの達成率を Power BI で出したい」「紙の点検表をアプリにしたい」など、実務の悩みを相談できます。PC での具体的な手順と式で答えます。<b>社外秘・個人情報は入力しないでください。</b></p>
      <div class="chat track-pq"></div>
      <div class="form"><textarea rows="3" data-q placeholder="例：部署ごとに届く Excel を毎月1つにまとめて、前年比をグラフにしたい"></textarea></div>
      <div class="btn-row"><button class="btn primary" data-send>相談する</button><button class="btn sm" data-clear>履歴を消す</button></div>`;
    const chat = w.querySelector('.chat');
    const draw = () => { chat.innerHTML = hist.map(h => `<div class="msg ${h.role === 'user' ? 'user' : 'ai'}">${h.role === 'user' ? esc(h.content) : md(h.content)}</div>`).join(''); };
    draw();
    w.querySelector('[data-clear]').onclick = () => { hist.length = 0; save(); draw(); };
    w.querySelector('[data-send]').onclick = async () => {
      const q = w.querySelector('[data-q]').value.trim(); if (!q) return;
      hist.push({ role: 'user', content: q }); w.querySelector('[data-q]').value = ''; draw();
      chat.insertAdjacentHTML('beforeend', '<div class="msg ai"><div class="spinner"></div></div>');
      try { const a = await AI.consult(hist.slice(-10)); hist.push({ role: 'assistant', content: a }); if (hist.length > 40) hist.splice(0, hist.length - 40); save(); logActivity('ai', 'consult'); }
      catch (e) { hist.pop(); toast(e.message, 4000); }
      draw();
    };
    return;
  }
  if (m === 'explain') {
    w.innerHTML = `<p class="small muted">会社のファイルにある M・DAX・Power Fx の式を貼り付けると、何をしているかを解説します（パワークエリの詳細エディター、Power BI のメジャー、Power Apps の数式バーからコピー）。</p>
      <div class="form"><label>言語<select data-lang><option value="">自動判定</option><option>M 言語（パワークエリ）</option><option>DAX</option><option>Power Fx</option></select></label><textarea rows="8" data-code class="mono" placeholder="式を貼り付け"></textarea></div>
      <div class="btn-row"><button class="btn primary" data-go>解説する</button></div><div class="out2"></div>`;
    w.querySelector('[data-go]').onclick = async () => {
      const code = w.querySelector('[data-code]').value.trim(); if (!code) return;
      const out = w.querySelector('.out2'); out.innerHTML = '<div class="spinner"></div>';
      try { const a = await AI.explainFormula(code, w.querySelector('[data-lang]').value); out.innerHTML = `<div class="card lesson">${md(a)}</div>`; logActivity('ai', 'explain'); }
      catch (e) { out.innerHTML = `<div class="result ng">${esc(e.message)}</div>`; }
    };
    return;
  }
  // 演習の自動作成
  const t0 = TRACKS[sub] ? sub : 'pq';
  const topics = { pq: ['列の型とエラー', 'フィルターと並べ替え', 'テキストの整形', '列の分割', 'カスタム列・条件列', 'ピボット解除', 'グループ化', 'マージ', '日付の処理', 'おまかせ（複数の操作を組み合わせ）'], bi: ['基本の集計', 'SUMX と RELATED', 'CALCULATE', 'ALL・構成比', 'FILTER', 'タイムインテリジェンス', 'IF・SWITCH', 'RANKX・TOPN', '計算列', 'おまかせ'], apps: ['Filter・Search', 'Sort', 'LookUp・集計', 'If・Switch・表示切り替え', '変数・コレクション', 'Patch', '日付', 'おまかせ'] };
  w.innerHTML = `<p class="small muted">苦手なテーマの演習を AI に作らせて、アプリの実行エンジンで自動採点します（模範解答が正しく動くことを確認してから追加します）。</p>
    <div class="form"><label>分野<select data-t>${TRACK_IDS.map(x => `<option value="${x}" ${x === t0 ? 'selected' : ''}>${TRACKS[x].name}</option>`).join('')}</select></label>
    <label>テーマ<select data-topic></select></label><label>または自由に指定<input data-free placeholder="例：前年比がマイナスの月だけ色を変えたい"></label>
    <label>難易度<select data-lv><option>やさしい</option><option selected>ふつう</option><option>難しい（実務レベル）</option></select></label></div>
    <div class="btn-row"><button class="btn primary" data-gen>作成する</button></div><div class="out2"></div>
    ${st.aiEx.length ? `<h3>作成済みの演習</h3>${st.aiEx.slice().reverse().map(e => `<a class="ex-row track-${e.track} ${st.ex[e.id]?.passed ? 'passed' : ''}" href="#/ex/${e.id}"><span><span class="tbadge">${TRACKS[e.track].icon}</span> ${esc(e.title)}</span><span class="small">${st.ex[e.id]?.passed ? '✓' : '▶'}</span></a>`).join('')}` : ''}`;
  const fillTopics = () => { const tt = w.querySelector('[data-t]').value; w.querySelector('[data-topic]').innerHTML = topics[tt].map(x => `<option>${x}</option>`).join(''); };
  w.querySelector('[data-t]').onchange = fillTopics; fillTopics();
  w.querySelector('[data-gen]').onclick = async () => {
    const tt = w.querySelector('[data-t]').value;
    const topic = w.querySelector('[data-free]').value.trim() || w.querySelector('[data-topic]').value;
    const level = w.querySelector('[data-lv]').value;
    const out = w.querySelector('.out2');
    const btn = w.querySelector('[data-gen]'); btn.disabled = true;
    out.innerHTML = '<div class="spinner"></div><p class="small muted center">作成して、模範解答を検証しています…</p>';
    try {
      let ex = null, lastErr = '';
      for (let attempt = 0; attempt < 2 && !ex; attempt++) {
        const raw = await AI.generateExercise(tt, { topic: lastErr ? `${topic}（前回の案は「${lastErr}」で失敗したので別の問題に）` : topic, level, catalog: catalogFor(tt) });
        try { ex = validateAiEx(tt, raw); } catch (e) { lastErr = e.message; }
      }
      if (!ex) throw new Error('検証に合格する問題を作れませんでした（' + lastErr + '）。もう一度お試しください。');
      st.aiEx.push(ex); if (st.aiEx.length > 60) st.aiEx.shift(); save(); logActivity('ai', 'gen');
      location.hash = '#/ex/' + ex.id;
    } catch (e) { out.innerHTML = `<div class="result ng">${esc(e.message)}</div>`; }
    btn.disabled = false;
  };
}
function catalogFor(t) {
  if (t === 'pq') return Object.entries(PQ_SOURCES).map(([k, s]) => `- ${k}: ${s.desc}\n  列: ${s.cols.join(', ')}\n  例: ${JSON.stringify(s.rows.slice(0, 3))}`).join('\n');
  if (t === 'bi') { const m = baseModel(); return Object.entries(m.tables).map(([k, tb]) => `- ${k}(${tb.cols.join(', ')}) ${tb.rows.length}行`).join('\n') + '\nリレーションシップ: ' + m.rels.map(r => `${r.to}[${r.toCol}] 1→* ${r.from}[${r.fromCol}]`).join(' / ') + '\nカレンダーは 2025/1/1〜2026/6/30。商品[カテゴリ] は ドリンク/菓子/文具/雑貨、顧客[地域] は 東京/大阪/名古屋/札幌/福岡、顧客[区分] は 法人/個人。\n行・列に使える列: ' + FIELDS.join(', '); }
  return Object.entries(APPS).map(([k, a]) => `- screen="${k}"（${a.title}）\n  データソース: ${Object.entries(a.data).map(([n, rows]) => `${n}(${Object.keys(rows[0]).join(', ')}) 例: ${JSON.stringify(rows[0])}`).join(' / ')}${a.collections ? '\n  コレクション: ' + Object.keys(a.collections).join(', ') : ''}\n  画面とコントロール: ${a.screens.map(s => `${s.name}[${s.controls.map(c => `${c.name}:${c.type}${c.template ? '(テンプレート: ' + c.template.map(x => x.name).join(',') + ')' : ''}${c.props.Items ? ` Items=${c.props.Items}` : ''}`).join('; ')}]`).join(' / ')}`).join('\n');
}
function validateAiEx(t, raw) {
  const id = 'ai-' + Date.now().toString(36);
  if (t === 'pq') {
    if (!PQ_SOURCES[raw.source]) throw new Error('存在しないソース ' + raw.source);
    const ex = { id, track: 'pq', ai: true, title: raw.title, prompt: raw.prompt, query: raw.source, solution: raw.solution, hint: raw.hint, explain: raw.explain };
    let r; try { r = runQuery(raw.solution, ex); } catch (e) { throw new Error('模範解答がエラー: ' + e.message); }
    if (!(r instanceof M.MTable)) throw new Error('結果がテーブルではない');
    const start = runQuery(M.joinSteps(startSteps(ex)), ex);
    if (!M.tableDiff(start, r, { loose: true })) throw new Error('何もしなくても正解になってしまう');
    return ex;
  }
  if (t === 'bi') {
    const ex = { id, track: 'bi', ai: true, title: raw.title, prompt: raw.prompt, kind: raw.kind, name: raw.name, table: raw.table, solution: raw.solution, hint: raw.hint, explain: raw.explain, given: { 売上金額: 'SUM(売上[金額])' }, visual: { rows: raw.rows || '商品|カテゴリ', cols: raw.cols || undefined } };
    if (ex.kind === 'measure' && ex.name === '売上金額') ex.given = {};
    const ok = gradeDax(ex, raw.solution);
    if (!ok.ok) throw new Error('模範解答で採点できない: ' + ok.msg);
    if (gradeDax(ex, '0').ok) throw new Error('自明な答えで正解になる');
    return ex;
  }
  const app = APPS[raw.screen] ? raw.screen : 'expense';
  let tests = [];
  try { tests = (raw.tests || []).map(x => ({ name: x.name, inputs: JSON.parse(x.inputs || '{}') })); } catch { throw new Error('tests の形式が不正'); }
  const ctl = Object.values(APPS[app].screens).flatMap(s => [...s.controls, ...s.controls.flatMap(c => c.template || [])]).find(c => c.name === raw.control);
  if (!ctl) throw new Error('存在しないコントロール ' + raw.control);
  const scr = APPS[app].screens.find(s => [...s.controls, ...s.controls.flatMap(c => c.template || [])].some(c => c.name === raw.control)).name;
  const ex = { id, track: 'apps', ai: true, title: raw.title, prompt: raw.prompt, app, screen: scr, target: { control: raw.control, prop: raw.prop }, starter: '', solution: raw.solution, tests, hint: raw.hint, explain: raw.explain };
  const ok = gradeFx(ex, raw.solution);
  if (!ok.ok) throw new Error('模範解答で採点できない: ' + ok.msg);
  if (gradeFx(ex, '').ok) throw new Error('空の式で正解になる');
  return ex;
}

// ---------- 設定 ----------
function settings() {
  const st = getState(); const s = st.settings;
  view.innerHTML = `
    <div class="card"><h2>🤖 AI 機能（任意）</h2>
      <p class="small">API キーを登録すると、①演習の AI 先生（ヒント・エラー解説・添削・質問）②実務相談 ③数式の解説 ④演習問題の自動作成 が使えます。</p>
      <div class="form">
        <label>使用するAI
          <select id="prov">
            <option value="none" ${AI.provider() == null && s.aiProvider !== 'anthropic' && s.aiProvider !== 'openai' ? 'selected' : ''}>使わない</option>
            <option value="anthropic" ${AI.provider() === 'anthropic' || s.aiProvider === 'anthropic' ? 'selected' : ''}>Claude（Anthropic）</option>
            <option value="openai" ${AI.provider() === 'openai' || s.aiProvider === 'openai' ? 'selected' : ''}>OpenAI（ChatGPT）</option>
          </select></label>
        <div id="provAnthropic" class="form">
          <label>Anthropic API キー<input type="password" id="ckey" value="${esc(s.apiKey)}" placeholder="sk-ant-..." autocomplete="off"></label>
          <label>モデル<select id="claudeModel">${AI.CLAUDE_MODELS.map(m => `<option value="${m.id}" ${(s.claudeModel || 'claude-opus-5-5') === m.id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></label>
          <p class="small muted">料金はモデルごとに自動で計算されます（Opus $4 / $20、Sonnet $2 / $10、Haiku $0.10 / $0.50 ／100万トークン：入力 / 出力）。ヒントや解説なら Haiku・Sonnet でも十分、演習の自動作成は Opus・Sonnet がおすすめです。</p>
        </div>
        <div id="provOpenAI" class="form">
          <label>OpenAI API キー<input type="password" id="key" value="${esc(s.openaiKey)}" placeholder="sk-..." autocomplete="off"></label>
          <label>モデル<select id="model"></select></label>
          <label id="modelCustomWrap" class="hide">モデル名を直接入力<input id="modelCustom" value="${esc(s.openaiModel)}" placeholder="${AI.OPENAI_DEFAULT}" autocomplete="off" autocapitalize="off"></label>
          <div class="btn-row" style="margin-top:0"><button class="btn sm" id="listm">このキーで使えるモデル一覧を取得</button><span id="modelsStatus" class="small muted"></span></div>
          <div class="two">
            <label>単価：入力（$/100万トークン）<input type="number" id="pin" min="0" step="0.01" value="${esc(s.openaiPriceIn)}" placeholder="例 2"></label>
            <label>単価：出力（$/100万トークン）<input type="number" id="pout" min="0" step="0.01" value="${esc(s.openaiPriceOut)}" placeholder="例 10"></label>
          </div>
          <p class="small muted">単価は任意。入れるとホームに推定金額が出ます（選んだモデルの単価は <a href="https://platform.openai.com/docs/pricing" target="_blank" rel="noopener">OpenAI の料金ページ ↗</a> で確認）。</p>
          <p class="small muted">OpenAI のモデルは頻繁に更新されます。キーを入れたら「一覧を取得」を押してください（使えない名前は自動で最新モデルに置き換わります）。目安：名前に mini / nano / luna が付くものは安価、無印や上位名は高品質・高価格。</p>
        </div>
        <label>円換算（1ドル = 何円で表示するか）<input type="number" id="yen" min="50" max="400" value="${esc(s.yen || 150)}"></label>
      </div>
      <p class="small muted">キーはこの端末のブラウザ内にのみ保存され、選んだ会社の API への直接リクエストにだけ使われます。共有端末では入力しないでください。利用料金は各社 API の従量課金です（ChatGPT や Claude の月額プランとは別）。Python 学習アプリ・TOEIC アプリとは別に保存されるので、こちらでも登録が必要です。</p>
      <div class="btn-row"><button class="btn primary" id="saveAI">保存</button></div>
    </div>
    <div class="card"><h2>表示</h2><div class="form">
      <label>テーマ<select id="theme"><option value="">端末に合わせる</option><option value="light" ${s.theme === 'light' ? 'selected' : ''}>ライト</option><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>ダーク</option></select></label></div></div>
    <div class="card"><h2>データ</h2>
      <p class="small muted">学習記録はこの端末のブラウザに保存されています。機種変更の前に書き出しておきましょう。</p>
      <div class="btn-row"><button class="btn" id="exp">書き出し</button><label class="btn">読み込み<input type="file" id="imp" accept="application/json" hidden></label><button class="btn danger" id="reset" style="color:var(--ng)">すべてリセット</button></div>
    </div>
    <div class="card small muted">ホーム画面に追加するとアプリのように使えます（iPhone: 共有 → ホーム画面に追加 / Android: メニュー → アプリをインストール）。<br>
    演習の実行エンジンは学習用に M 言語・DAX・Power Fx の主要な機能を再現したもので、実際の製品のすべての関数・動作を再現しているわけではありません。画面は日本語版の表記を元にした再現です。</div>`;
  const drawModels = (list, selected) => {
    const ids = list.map(m => m.id);
    const sel = selected || ids[0] || AI.OPENAI_DEFAULT;
    const known = ids.includes(sel);
    $('#model').innerHTML = list.map((m, i) => `<option value="${esc(m.id)}" ${m.id === sel ? 'selected' : ''}>${esc(m.id)}${m.date ? `（${esc(m.date)}）` : ''}${i === 0 && m.date ? ' ★最新' : ''}</option>`).join('')
      + `<option value="__custom" ${known ? '' : 'selected'}>その他（直接入力）</option>`;
    if (!known) $('#modelCustom').value = sel;
    $('#modelCustomWrap').classList.toggle('hide', known);
  };
  const savedModels = (s.openaiModels || []).map(m => typeof m === 'string' ? { id: m, date: '' } : m);
  drawModels(savedModels.length ? savedModels : AI.OPENAI_SUGGESTED.map(id => ({ id, date: '' })), s.openaiModel || AI.OPENAI_DEFAULT);
  $('#model').onchange = () => $('#modelCustomWrap').classList.toggle('hide', $('#model').value !== '__custom');
  $('#listm').onclick = async () => {
    const key = $('#key').value.trim();
    if (!key) { $('#modelsStatus').textContent = '先にキーを入力してください'; return; }
    $('#modelsStatus').textContent = '取得中…';
    try {
      const list = await AI.listModels(key);
      if (!list.length) throw new Error('使えるモデルが見つかりませんでした');
      st.settings.openaiModels = list; save();
      const cur = $('#model').value === '__custom' ? $('#modelCustom').value.trim() : $('#model').value;
      drawModels(list, list.some(m => m.id === cur) ? cur : list[0].id);
      $('#modelsStatus').textContent = `${list.length}件取得しました（新しい順）。上の「モデル」から選んで「保存」を押してください。`;
    } catch (e) { $('#modelsStatus').textContent = e.message; }
  };
  $('#key').onchange = () => { if ($('#key').value.trim()) $('#listm').click(); };
  const showProv = () => { $('#provAnthropic').classList.toggle('hide', $('#prov').value !== 'anthropic'); $('#provOpenAI').classList.toggle('hide', $('#prov').value !== 'openai'); };
  $('#prov').onchange = showProv; showProv();
  $('#saveAI').onclick = () => {
    const m = $('#model').value === '__custom' ? $('#modelCustom').value.trim() : $('#model').value;
    Object.assign(st.settings, {
      aiProvider: $('#prov').value, apiKey: $('#ckey').value.trim(), claudeModel: $('#claudeModel').value,
      openaiKey: $('#key').value.trim(), openaiModel: m || AI.OPENAI_DEFAULT, openaiPriceIn: $('#pin').value, openaiPriceOut: $('#pout').value,
      yen: +$('#yen').value || 150,
    });
    save(); toast('保存しました');
  };
  $('#theme').onchange = e => { st.settings.theme = e.target.value; save(); applyTheme(); };
  $('#exp').onclick = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `powerdojo-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  $('#imp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { importData(await f.text()); toast('読み込みました'); settings(); } catch { toast('読み込めませんでした'); } };
  $('#reset').onclick = () => { if (confirm('学習記録・設定をすべて消去しますか？')) { resetAll(); settings(); } };
}
function applyTheme() {
  const t = getState().settings.theme;
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}

applyTheme();
route();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
