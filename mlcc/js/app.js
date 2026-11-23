import { getState, save, logActivity, exportData, importData, resetAll, streak, todayCount, cardDue, rateCard } from './store.js';
import { MAT_LESSONS } from '../data/mat-lessons.js';
import { PROC_LESSONS } from '../data/proc-lessons.js';
import { MEAS_LESSONS } from '../data/meas-lessons.js';
import { REL_LESSONS } from '../data/rel-lessons.js';
import { MKT_LESSONS } from '../data/mkt-lessons.js';
import { TERMS } from '../data/terms.js';
import { TOOLS, renderTool } from './tools.js';
import * as AI from './ai.js';
import { esc, md, toast } from './util.js';

const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');

export const TRACKS = {
  mat: { name: '材料技術', icon: '🧪', lessons: MAT_LESSONS, desc: 'BaTiO3・強誘電性・温度特性・耐還元性・電極・薄層化' },
  proc: { name: 'プロセス技術', icon: '🏭', lessons: PROC_LESSONS, desc: '粉末・シート成形・印刷積層・焼成・外部電極・工程管理' },
  meas: { name: '電気特性と測定', icon: '📏', lessons: MEAS_LESSONS, desc: 'インピーダンス・測定条件・LCR・DC バイアス・IR・音鳴き' },
  rel: { name: '信頼性・故障解析', icon: '🛡️', lessons: REL_LESSONS, desc: 'ワイブル・加速試験・絶縁劣化・クラック・解析・AEC-Q200' },
  mkt: { name: '市場・アプリケーション', icon: '🌐', lessons: MKT_LESSONS, desc: '市場構造・用途別の使われ方・技術トレンド・需給' },
};
const TRACK_IDS = Object.keys(TRACKS);
const allLessons = () => TRACK_IDS.flatMap(t => TRACKS[t].lessons.map(l => ({ ...l, track: t })));
const findLesson = id => allLessons().find(l => l.id === id);
const termId = t => 'T' + TERMS.indexOf(t);

function lessonStatus(l) {
  const st = getState();
  const qOk = l.quiz.filter((_, i) => st.quiz[`${l.id}-${i}`]?.ok).length;
  const done = !!st.lessons[l.id]?.done || (qOk === l.quiz.length && l.quiz.length > 0);
  return { qOk, done };
}
function trackProgress(t) {
  const ls = TRACKS[t].lessons;
  const s = ls.map(lessonStatus);
  const done = s.filter(x => x.done).length;
  const qTotal = ls.reduce((a, l) => a + l.quiz.length, 0), qOk = s.reduce((a, x) => a + x.qOk, 0);
  const next = ls.find((l, i) => !s[i].done) || ls[ls.length - 1];
  return { done, total: ls.length, qOk, qTotal, next, pct: Math.round(100 * (done + qOk / Math.max(1, qTotal) * ls.length) / (2 * ls.length)) };
}

// ---------- ルーター ----------
function route() {
  const hash = location.hash || '#/home';
  const [, name, arg] = hash.match(/^#\/(\w+)\/?(.*)$/) || [, 'home', ''];
  const tabOf = { home: 'home', courses: 'courses', track: 'courses', lesson: 'courses', review: 'courses', aiq: 'courses', cards: 'cards', terms: 'cards', tools: 'tools', ai: 'ai', settings: 'settings' };
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.route === tabOf[name]));
  window.scrollTo(0, 0);
  const views = { home, courses, track, lesson, review, aiq, cards, terms, tools, ai, settings };
  (views[name] || home)(decodeURIComponent(arg || ''));
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
    正確な請求額は <a href="${isOA ? 'https://platform.openai.com/usage' : 'https://console.anthropic.com/usage'}" target="_blank" rel="noopener">${isOA ? 'OpenAI' : 'Anthropic'} の利用状況ページ ↗</a> で確認できます。</p>
  </div>`;
}

// ---------- 用語カードの集計 ----------
function cardQueue(filter = '') {
  const st = getState(); const now = Date.now();
  const list = TERMS.filter(t => !filter || t.tr === filter);
  const due = list.filter(t => st.cards[termId(t)] && cardDue(termId(t), now));
  const today = new Date().toDateString();
  const newToday = Object.values(st.cards).filter(c => c.first && new Date(c.first).toDateString() === today).length;
  const room = Math.max(0, (+st.settings.dailyCards || 15) - newToday);
  const fresh = list.filter(t => !st.cards[termId(t)]).slice(0, room);
  return { due, fresh, learned: list.filter(t => (st.cards[termId(t)]?.box || 0) >= 3).length, total: list.length };
}

// ---------- ホーム ----------
function home() {
  const st = getState();
  const days = [];
  const counts = {};
  for (const l of st.log) { const d = new Date(l.ts).toDateString(); counts[d] = (counts[d] || 0) + 1; }
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const c = counts[d.toDateString()] || 0; days.push(c >= 10 ? 3 : c >= 4 ? 2 : c ? 1 : 0); }
  const wrong = wrongQuizzes().length;
  const cq = cardQueue();
  const cardsTodo = cq.due.length + cq.fresh.length;
  view.innerHTML = `
    <div class="card hero">
      <div class="row-between"><h1>MLCC Engineering Dojo</h1><span class="pill">🔥 連続 ${streak()} 日</span></div>
      <p class="small muted" style="margin:0 0 6px">積層セラミックコンデンサの材料・プロセス・測定・信頼性・市場を体系的に学び、業務に生かすアプリ。分からないことは AI 先生に何でも質問できます。</p>
      <div class="small">今日の学習：<b>${todayCount()}</b> 件</div>
      <div class="cal14">${days.map(l => `<div class="l${l}"></div>`).join('')}</div>
      <div class="tiny muted" style="text-align:right">直近14日</div>
    </div>
    ${cardsTodo ? `<a class="card" href="#/cards" style="border-left:4px solid var(--primary)"><b>📇 今日の用語カード</b>：復習 ${cq.due.length} 枚・新規 ${cq.fresh.length} 枚<div class="tiny muted">覚えた用語 ${cq.learned}/${cq.total}</div></a>` : `<a class="card small" href="#/terms">📇 今日の用語カードは完了。覚えた用語 ${cq.learned}/${cq.total}（用語辞典を見る）</a>`}
    ${TRACK_IDS.map(t => { const p = trackProgress(t); const T = TRACKS[t]; return `
      <a class="card track-${t}" href="#/lesson/${p.next.id}" style="border-left:5px solid var(--tc)">
        <div class="row" style="flex-wrap:nowrap"><div class="ring" style="--p:${p.pct}"><span>${p.pct}%</span></div>
          <div class="grow"><div><span class="tbadge">${T.icon} ${T.name}</span> <span class="small muted">${p.done}/${p.total} 回</span></div>
          <div style="margin-top:2px"><b>次：</b>${esc(p.next.title)}</div><div class="small muted">${esc(p.next.goal)}</div></div></div>
      </a>`; }).join('')}
    ${wrong ? `<a class="card" href="#/review" style="border-left:4px solid var(--ng)"><b>🔁 クイズの復習</b>：間違えた問題が ${wrong} 問あります</a>` : ''}
    ${aiUsageCard()}
    <div class="grid2">
      <a class="tile" href="#/ai/chat"><div class="t">🤖 AI 先生に相談</div><div class="small muted">技術の疑問・業務の課題を何でも質問</div></a>
      <a class="tile" href="#/ai/quiz"><div class="t">✨ AI で問題を作る</div><div class="small muted">テーマ・難易度を指定して無制限に4択問題</div></a>
      <a class="tile" href="#/ai/feyn"><div class="t">🗣️ 説明してみる</div><div class="small muted">自分の言葉で説明 → AI が採点・添削</div></a>
      <a class="tile" href="#/ai/read"><div class="t">📄 資料を読む</div><div class="small muted">論文・データシート・英文ニュースを要約・解説</div></a>
      <a class="tile" href="#/tools"><div class="t">🧮 計算ツール</div><div class="small muted">容量設計・インピーダンス・実効容量・加速係数…</div></a>
      <a class="tile" href="#/ai/plan"><div class="t">🧭 学習アドバイス</div><div class="small muted">学習記録から次にやることを AI が提案</div></a>
    </div>`;
}

// ---------- コース ----------
function courses() {
  const st = getState();
  view.innerHTML = `<h1>コース</h1>
    ${TRACK_IDS.map(t => { const p = trackProgress(t); const T = TRACKS[t]; return `<a class="tile trk track-${t}" href="#/track/${t}" style="margin-bottom:10px">
      <div class="row-between"><span class="tbadge">${T.icon} ${T.name}</span><span class="small muted">${p.pct}%</span></div>
      <div class="small" style="margin-top:4px">${esc(T.desc)}</div><div class="progress"><div style="width:${p.pct}%;background:var(--tc)"></div></div>
      <div class="tiny muted">レッスン ${p.done}/${p.total}・クイズ ${p.qOk}/${p.qTotal}</div></a>`; }).join('')}
    <div class="card small"><b>おすすめの順番</b>：材料 → プロセス → 電気特性と測定 → 信頼性 → 市場。業務に近いコースから始めても大丈夫です。各レッスンの「AI 先生」で深掘り・数値例・業務での使い方を聞けます。</div>
    <div class="grid2"><a class="tile" href="#/review">🔁 クイズの復習</a><a class="tile" href="#/aiq">✨ AI が作った問題（${st.aiQuiz.length}）</a></div>`;
}
function track(t) {
  if (!TRACKS[t]) t = 'mat';
  const T = TRACKS[t]; const st = getState();
  const nAi = st.aiQuiz.filter(q => q.track === t).length;
  view.innerHTML = `<div class="track-${t}">
    <div class="row-between" style="margin-bottom:6px"><a href="#/courses" class="small">← コース</a><span class="tbadge">${T.icon} ${T.name}</span></div>
    <h1>${esc(T.name)}</h1>
    <div class="chips"><a class="chip" href="#/ai/quiz/${t}">✨ AI で問題を作る</a>${nAi ? `<a class="chip" href="#/aiq/${t}">AI の問題 ${nAi}</a>` : ''}<a class="chip" href="#/cards/${t}">📇 この分野の用語カード</a></div>
    ${T.lessons.map((l, i) => { const s = lessonStatus(l); const notes = (st.aiNotes[l.id] || []).length; return `<a class="lesson-row ${s.done ? 'done' : ''}" href="#/lesson/${l.id}"><span class="num">${s.done ? '✓' : i + 1}</span><span class="grow"><b>${esc(l.title)}</b><div class="meta">${esc(l.goal)}</div><div class="meta">クイズ ${s.qOk}/${l.quiz.length}${notes ? `・AI ノート ${notes}` : ''}</div></span></a>`; }).join('')}
  </div>`;
}

// ---------- レッスン ----------
function lesson(id) {
  const l = findLesson(id); if (!l) return home();
  const T = TRACKS[l.track]; const st = getState();
  const idx = T.lessons.findIndex(x => x.id === id);
  const next = T.lessons[idx + 1];
  logActivity('lesson', id);
  const notes = st.aiNotes[l.id] || [];
  view.innerHTML = `<div class="track-${l.track}">
    <div class="row-between" style="margin-bottom:6px"><a href="#/track/${l.track}" class="small">← ${T.name}</a><span class="tbadge">${T.icon} 第${idx + 1}回</span></div>
    <h1>${esc(l.title)}</h1><p class="small muted" style="margin-top:0">🎯 ${esc(l.goal)}</p>
    <div class="card lesson">${md(l.body)}</div>
    <details class="card guide" open><summary><b>💼 業務での活かし方</b></summary><div class="lesson">${md(l.work)}</div></details>
    <div class="card"><h2>✅ 確認クイズ</h2><div class="quizbox"></div></div>
    <div class="card tutor"><h2>🤖 AI 先生</h2>
      ${AI.hasKey() ? '' : '<p class="small">AI 先生を使うには <a href="#/settings">設定</a> で OpenAI（または Claude）の API キーを登録してください。</p>'}
      <div class="chips">
        <button class="chip" data-k="deeper">🔬 もっと深く</button><button class="chip" data-k="example">🔢 数値例・計算例</button>
        <button class="chip" data-k="work">💼 業務での使い方</button><button class="chip" data-k="easy">🧒 やさしく説明</button>
      </div>
      <div class="chat tutor-chat"></div>
      <div class="form"><textarea rows="2" data-tq placeholder="このレッスンについて質問（例：なぜ希土類は A・B 両サイトに入れるの？）"></textarea></div>
      <div class="btn-row"><button class="btn primary" data-ask>質問する</button><button class="btn sm" data-gen>✨ この回の追加問題を5問作る</button></div>
      <div class="genbox"></div>
      ${notes.length ? `<details class="guide" style="margin-top:10px"><summary><b>📒 保存した AI ノート（${notes.length}）</b></summary>${notes.slice().reverse().map((n, i) => `<div class="ai-box"><div class="tiny muted">${new Date(n.ts).toLocaleDateString()} ${esc(n.label)}</div>${md(n.text)}<button class="btn sm" data-del="${notes.length - 1 - i}">削除</button></div>`).join('')}</details>` : ''}
    </div>
    <div class="btn-row">${lessonStatus(l).done ? '<span class="pill done">✓ このレッスンは完了</span>' : '<button class="btn" id="markDone">このレッスンを完了にする</button>'}
      ${next ? `<a class="btn primary" href="#/lesson/${next.id}">次のレッスン →</a>` : `<a class="btn primary" href="#/track/${l.track}">コースの一覧へ</a>`}</div>
  </div>`;
  renderQuiz($('.quizbox'), l.quiz.map((q, i) => ({ ...q, key: `${l.id}-${i}` })));
  const md0 = $('#markDone'); if (md0) md0.onclick = () => { st.lessons[l.id] = { done: true, ts: Date.now() }; save(); toast('完了にしました'); lesson(id); };
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { notes.splice(+b.dataset.del, 1); st.aiNotes[l.id] = notes; save(); lesson(id); });

  // AI 先生
  const chat = $('.tutor-chat'); let history = [];
  const LABEL = { deeper: '🔬 もっと深く', example: '🔢 数値例・計算例', work: '💼 業務での使い方', easy: '🧒 やさしく説明', ask: '質問' };
  const ask = async (kind, question) => {
    if (!AI.hasKey()) { toast('設定で API キーを登録してください'); return; }
    chat.insertAdjacentHTML('beforeend', `<div class="msg user">${esc(question || LABEL[kind])}</div><div class="msg ai pending"><div class="spinner"></div></div>`);
    try {
      const r = await AI.tutor(kind, { lesson: l, track: l.track, question, history: history.slice(-6) });
      history = r.messages;
      const box = chat.querySelector('.pending'); box.classList.remove('pending');
      box.innerHTML = md(r.text) + `<div class="btn-row" style="margin-top:4px"><button class="btn sm" data-save>📒 ノートに保存</button></div>`;
      box.querySelector('[data-save]').onclick = e => {
        (st.aiNotes[l.id] ||= []).push({ ts: Date.now(), label: question ? 'Q: ' + question.slice(0, 40) : LABEL[kind], text: r.text });
        save(); e.target.disabled = true; e.target.textContent = '保存しました';
      };
      logActivity('ai', 'tutor');
    } catch (e) { chat.querySelector('.pending')?.remove(); toast(e.message, 4000); }
  };
  document.querySelectorAll('.tutor [data-k]').forEach(b => b.onclick = () => ask(b.dataset.k));
  $('[data-ask]').onclick = () => { const q = $('[data-tq]').value.trim(); if (!q) return; $('[data-tq]').value = ''; ask('ask', q); };
  $('[data-gen]').onclick = async e => {
    if (!AI.hasKey()) { toast('設定で API キーを登録してください'); return; }
    const box = $('.genbox'); e.target.disabled = true;
    box.innerHTML = '<div class="spinner"></div><p class="small muted center">問題を作っています…</p>';
    try {
      const qs = await AI.generateQuiz({ track: l.track, topic: `${l.title}（${l.goal}）`, level: 'ふつう〜難しい（実務・メカニズム理解）', n: 5, avoid: [...l.quiz.map(q => q.q), ...st.aiQuiz.filter(q => q.lesson === l.id).map(q => q.q)] });
      if (!qs.length) throw new Error('問題を作れませんでした。もう一度お試しください。');
      const items = qs.map(q => ({ ...q, id: 'aq' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), track: l.track, lesson: l.id, topic: l.title, ts: Date.now() }));
      st.aiQuiz.push(...items); if (st.aiQuiz.length > 500) st.aiQuiz.splice(0, st.aiQuiz.length - 500); save(); logActivity('ai', 'quizgen');
      box.innerHTML = '<h3>✨ AI の追加問題</h3><div class="qz"></div>';
      renderQuiz(box.querySelector('.qz'), items.map(q => ({ ...q, key: q.id })));
    } catch (err) { box.innerHTML = `<div class="result ng">${esc(err.message)}</div>`; }
    e.target.disabled = false;
  };
}

// ---------- クイズ ----------
function shuffleIdx(n) { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function renderQuiz(box, qs) {
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
  };
}
function wrongQuizzes() {
  const st = getState(); const out = [];
  for (const l of allLessons()) l.quiz.forEach((q, i) => { const r = st.quiz[`${l.id}-${i}`]; if (r && r.wrongLast) out.push({ ...q, key: `${l.id}-${i}` }); });
  for (const q of st.aiQuiz) { const r = st.quiz[q.id]; if (r && r.wrongLast) out.push({ ...q, key: q.id }); }
  return out;
}
function review() {
  const list = wrongQuizzes();
  view.innerHTML = `<a href="#/courses" class="small">← コース</a><h1>🔁 クイズの復習</h1>${list.length ? `<p class="small muted">最後に間違えた問題です（AI が作った問題も含む）。正解すると一覧から消えます。</p><div class="quizbox"></div><div class="btn-row"><button class="btn" id="again">もう一度</button></div>` : '<div class="card">間違えた問題はありません 🎉</div>'}`;
  if (list.length) { renderQuiz($('.quizbox'), list); $('#again').onclick = review; }
}
function aiq(t) {
  const st = getState();
  const list = st.aiQuiz.filter(q => !TRACKS[t] || q.track === t);
  const unanswered = list.filter(q => !st.quiz[q.id]);
  view.innerHTML = `<a href="#/courses" class="small">← コース</a><h1>✨ AI が作った問題</h1>
    <div class="chips"><a class="chip ${!TRACKS[t] ? 'on' : ''}" href="#/aiq">すべて</a>${TRACK_IDS.map(x => `<a class="chip ${t === x ? 'on' : ''}" href="#/aiq/${x}">${TRACKS[x].icon} ${TRACKS[x].name}</a>`).join('')}</div>
    ${list.length ? `<p class="small muted">${list.length} 問（未回答 ${unanswered.length}）。未回答を優先して最大10問ずつ出題します。</p><div class="quizbox"></div><div class="btn-row"><button class="btn" id="more">次の10問</button><a class="btn" href="#/ai/quiz/${TRACKS[t] ? t : ''}">問題を作る</a><button class="btn sm" id="clr" style="color:var(--ng)">この一覧を削除</button></div>`
      : `<div class="card">まだありません。<a href="#/ai/quiz/${TRACKS[t] ? t : ''}">AI で問題を作る</a>か、各レッスンの「追加問題を作る」を使ってください。</div>`}`;
  if (!list.length) return;
  const pick = () => {
    const pool = [...unanswered, ...list.filter(q => st.quiz[q.id]?.wrongLast), ...list].filter((q, i, a) => a.indexOf(q) === i);
    const sel = unanswered.length ? pool.slice(0, 10) : shuffleIdx(list.length).slice(0, 10).map(i => list[i]);
    renderQuiz($('.quizbox'), sel.map(q => ({ ...q, key: q.id })));
  };
  pick();
  $('#more').onclick = () => aiq(t);
  $('#clr').onclick = () => { if (!confirm('表示中の AI 問題を削除しますか？')) return; st.aiQuiz = st.aiQuiz.filter(q => !list.includes(q)); save(); aiq(t); };
}

// ---------- 用語カード ----------
function cards(filter) {
  if (!TRACKS[filter]) filter = '';
  const st = getState();
  const q = cardQueue(filter);
  const queue = [...q.due, ...q.fresh];
  view.innerHTML = `<div class="row-between"><h1>📇 用語カード</h1><a class="small" href="#/terms">📖 用語辞典</a></div>
    <div class="chips"><a class="chip ${!filter ? 'on' : ''}" href="#/cards">すべて</a>${TRACK_IDS.map(x => `<a class="chip ${filter === x ? 'on' : ''}" href="#/cards/${x}">${TRACKS[x].icon} ${TRACKS[x].name}</a>`).join('')}</div>
    <p class="small muted">用語を見て意味を思い出し、カードをタップして確認。覚えていれば「わかった」、あいまいなら「もう一度」。間隔反復（1→3→7→16→35→90日）で出題します。覚えた用語 ${q.learned}/${q.total}</p>
    <div class="cardwrap"></div>`;
  const wrap = $('.cardwrap');
  let i = 0;
  const show = () => {
    if (i >= queue.length) { wrap.innerHTML = `<div class="card center">🎉 今日のカードは終わりです。<div class="btn-row" style="justify-content:center"><a class="btn" href="#/terms">用語辞典を見る</a><a class="btn primary" href="#/home">ホームへ</a></div></div>`; return; }
    const t = queue[i]; const id = termId(t); const c = st.cards[id];
    wrap.innerHTML = `<div class="tiny muted">${i + 1} / ${queue.length}　${c ? '復習' : '新規'}　<span class="tbadge track-${t.tr}">${TRACKS[t.tr].icon} ${TRACKS[t.tr].name}</span></div>
      <div class="flash" tabindex="0"><div class="front"><div class="term">${esc(t.t)}</div><div class="small muted">${esc(t.en)}</div><div class="tiny muted" style="margin-top:12px">タップして意味を表示</div></div>
      <div class="back hide"><div class="term sm">${esc(t.t)}</div><p>${esc(t.d)}</p></div></div>
      <div class="btn-row hide" id="rate"><button class="btn" data-r="0">🔁 もう一度</button><button class="btn primary" data-r="1">✓ わかった</button><button class="btn sm" data-ai>🤖 AI で詳しく</button></div>
      <div class="aiout"></div>`;
    const flip = () => { wrap.querySelector('.front').classList.add('hide'); wrap.querySelector('.back').classList.remove('hide'); $('#rate').classList.remove('hide'); };
    wrap.querySelector('.flash').onclick = flip;
    wrap.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      const first = st.cards[id]?.first || Date.now();
      rateCard(id, b.dataset.r === '1'); st.cards[id].first = first; save(); logActivity('card', id);
      if (b.dataset.r === '0') queue.push(t);
      i++; show();
    });
    wrap.querySelector('[data-ai]').onclick = () => explainTermInto(t, wrap.querySelector('.aiout'));
  };
  show();
}
async function explainTermInto(t, out) {
  if (!AI.hasKey()) { toast('設定で API キーを登録してください'); return; }
  out.innerHTML = '<div class="spinner"></div>';
  try { const a = await AI.explainTerm(t.t, t.d); out.innerHTML = `<div class="card lesson">${md(a)}</div>`; logActivity('ai', 'term'); }
  catch (e) { out.innerHTML = `<div class="result ng">${esc(e.message)}</div>`; }
}
function terms() {
  view.innerHTML = `<div class="row-between"><h1>📖 用語辞典</h1><a class="small" href="#/cards">📇 カードで覚える</a></div>
    <div class="form"><input id="q" placeholder="検索（日本語・英語）" autocomplete="off"></div>
    <div class="chips" id="fl"><button class="chip on" data-f="">すべて</button>${TRACK_IDS.map(x => `<button class="chip" data-f="${x}">${TRACKS[x].icon} ${TRACKS[x].name}</button>`).join('')}</div>
    <div class="card" id="list"></div>
    <div class="card"><h2>🤖 辞典にない用語を AI に聞く</h2><div class="cmdinput"><input id="free" placeholder="例：BaTiO3 の 90°ドメイン、TSDC、LTCC"><button class="btn primary" id="go">解説</button></div><div class="aiout"></div></div>`;
  let f = '';
  const draw = () => {
    const q = $('#q').value.trim().toLowerCase();
    const list = TERMS.filter(t => (!f || t.tr === f) && (!q || (t.t + t.en + t.d).toLowerCase().includes(q)));
    const st = getState();
    $('#list').innerHTML = list.length ? list.map(t => `<div class="ref-item"><div class="row-between"><span class="k">${esc(t.t)}</span>${(st.cards[termId(t)]?.box || 0) >= 3 ? '<span class="pill done">覚えた</span>' : ''}</div><div class="tiny muted">${esc(t.en)}</div><div class="d">${esc(t.d)}</div><button class="btn sm" data-ai="${TERMS.indexOf(t)}" style="margin-top:4px">🤖 詳しく</button><div class="aiout"></div></div>`).join('') : '<p class="small muted">見つかりません。下の「AI に聞く」を使ってください。</p>';
  };
  $('#q').oninput = draw;
  $('#fl').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; f = b.dataset.f; $('#fl').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b)); draw(); };
  $('#list').onclick = e => { const b = e.target.closest('[data-ai]'); if (!b) return; explainTermInto(TERMS[+b.dataset.ai], b.nextElementSibling); };
  $('#go').onclick = () => { const v = $('#free').value.trim(); if (v) explainTermInto({ t: v, d: '' }, $('#go').closest('.card').querySelector('.aiout')); };
  draw();
}

// ---------- 計算ツール ----------
function tools(id) {
  const t = TOOLS.find(x => x.id === id);
  if (!t) {
    view.innerHTML = `<h1>🧮 計算ツール</h1><p class="small muted">レッスンで出てきた式を、数値を変えながら体感できます。顧客への説明資料づくりにも。</p>
      <div class="grid2">${TOOLS.map(x => `<a class="tile" href="#/tools/${x.id}"><div class="t">${x.icon} ${esc(x.name)}</div><div class="small muted">${esc(x.desc)}</div></a>`).join('')}</div>`;
    return;
  }
  logActivity('tool', id);
  view.innerHTML = `<a href="#/tools" class="small">← 計算ツール</a><h1>${t.icon} ${esc(t.name)}</h1><div class="card tool"></div>`;
  renderTool(id, $('.tool'));
}

// ---------- AI ----------
function ai(arg) {
  const [mode, sub] = (arg || '').split('/');
  const tabs = [['chat', '💬 技術相談'], ['quiz', '✨ 問題を作る'], ['feyn', '🗣️ 説明してみる'], ['read', '📄 資料を読む'], ['plan', '🧭 学習アドバイス']];
  const m = tabs.some(x => x[0] === mode) ? mode : 'chat';
  view.innerHTML = `<h1>🤖 AI 先生</h1><div class="chips" style="margin-bottom:8px">${tabs.map(([k, l]) => `<a class="chip ${k === m ? 'on' : ''}" href="#/ai/${k}">${l}</a>`).join('')}</div>
    ${AI.hasKey() ? '' : '<div class="card small">AI 機能を使うには <a href="#/settings">設定</a> で OpenAI（または Claude）の API キーを登録してください。料金は API の従量課金で、ホーム画面に使った金額の目安が表示されます。</div>'}
    <div class="aiw"></div>`;
  const w = $('.aiw'); const st = getState();
  const need = () => { if (!AI.hasKey()) { toast('設定で API キーを登録してください'); return false; } return true; };

  if (m === 'chat') {
    const hist = st.chats.consult ||= [];
    w.innerHTML = `<p class="small muted">材料・プロセス・測定・信頼性・回路での使い方・市場まで、何でも相談できます。<b>社外秘の情報（未発表の材料組成、顧客名、社内データなど）は入力しないでください。</b>一般化して質問しましょう。</p>
      <div class="chips" id="ex">${['X7R と X7S の材料設計の違いは？', 'DC バイアス特性を改善する材料のアプローチを教えて', '高温負荷試験で IR 劣化が早いロットの原因の調べ方', 'LCR メーターで大容量品の容量が低く出る理由', 'AI サーバーで MLCC の需要が増える理由と求められる特性', '顧客にエージングを説明するときのコツ'].map(x => `<button class="chip">${x}</button>`).join('')}</div>
      <div class="chat"></div>
      <div class="form"><textarea rows="3" data-q placeholder="質問・相談を入力"></textarea></div>
      <div class="btn-row"><button class="btn primary" data-send>送信</button><button class="btn sm" data-clear>履歴を消す</button></div>`;
    const chat = w.querySelector('.chat');
    const draw = () => { chat.innerHTML = hist.map(h => `<div class="msg ${h.role === 'user' ? 'user' : 'ai'}">${h.role === 'user' ? esc(h.content) : md(h.content)}</div>`).join(''); };
    draw();
    w.querySelector('#ex').onclick = e => { const b = e.target.closest('.chip'); if (b) w.querySelector('[data-q]').value = b.textContent; };
    w.querySelector('[data-clear]').onclick = () => { hist.length = 0; save(); draw(); };
    w.querySelector('[data-send]').onclick = async e => {
      if (!need()) return;
      const q = w.querySelector('[data-q]').value.trim(); if (!q) return;
      hist.push({ role: 'user', content: q }); w.querySelector('[data-q]').value = ''; draw();
      chat.insertAdjacentHTML('beforeend', '<div class="msg ai"><div class="spinner"></div></div>');
      e.target.disabled = true;
      try { const a = await AI.consult(hist.slice(-12)); hist.push({ role: 'assistant', content: a }); if (hist.length > 60) hist.splice(0, hist.length - 60); save(); logActivity('ai', 'consult'); }
      catch (err) { hist.pop(); toast(err.message, 4000); }
      e.target.disabled = false; draw();
      chat.lastElementChild?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    return;
  }

  if (m === 'quiz') {
    const t0 = TRACKS[sub] ? sub : 'mat';
    w.innerHTML = `<p class="small muted">テーマと難易度を選ぶと、AI がオリジナルの4択問題を作ります（解説つき）。作った問題は保存され、間違えた問題は復習に出ます。</p>
      <div class="form"><label>分野<select data-t>${TRACK_IDS.map(x => `<option value="${x}" ${x === t0 ? 'selected' : ''}>${TRACKS[x].icon} ${TRACKS[x].name}</option>`).join('')}</select></label>
      <label>テーマ<select data-topic></select></label><label>または自由に指定<input data-free placeholder="例：コアシェル構造と温度特性、ワイブル解析の計算"></label>
      <div class="two"><label>難易度<select data-lv><option>入門（新人研修レベル）</option><option selected>中級（実務担当者レベル）</option><option>上級（専門家・メカニズム・計算）</option></select></label>
      <label>問題数<select data-n><option>3</option><option selected>5</option><option>8</option></select></label></div></div>
      <div class="btn-row"><button class="btn primary" data-gen>作成する</button><a class="btn" href="#/aiq">保存済みの問題（${st.aiQuiz.length}）</a></div><div class="out2"></div>`;
    const fill = () => { const tt = w.querySelector('[data-t]').value; w.querySelector('[data-topic]').innerHTML = `<option value="">おまかせ（${TRACKS[tt].name}全般）</option>` + TRACKS[tt].lessons.map(l => `<option>${esc(l.title)}</option>`).join(''); };
    w.querySelector('[data-t]').onchange = fill; fill();
    w.querySelector('[data-gen]').onclick = async e => {
      if (!need()) return;
      const tt = w.querySelector('[data-t]').value;
      const topic = w.querySelector('[data-free]').value.trim() || w.querySelector('[data-topic]').value || `${TRACKS[tt].name}全般（${TRACKS[tt].desc}）`;
      const out = w.querySelector('.out2'); e.target.disabled = true;
      out.innerHTML = '<div class="spinner"></div><p class="small muted center">問題を作っています…</p>';
      try {
        const qs = await AI.generateQuiz({ track: tt, topic, level: w.querySelector('[data-lv]').value, n: +w.querySelector('[data-n]').value, avoid: st.aiQuiz.filter(q => q.track === tt).map(q => q.q) });
        if (!qs.length) throw new Error('問題を作れませんでした。もう一度お試しください。');
        const items = qs.map(q => ({ ...q, id: 'aq' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), track: tt, topic, ts: Date.now() }));
        st.aiQuiz.push(...items); if (st.aiQuiz.length > 500) st.aiQuiz.splice(0, st.aiQuiz.length - 500); save(); logActivity('ai', 'quizgen');
        out.innerHTML = `<div class="track-${tt}"><h3>${esc(topic)}</h3><div class="qz"></div></div>`;
        renderQuiz(out.querySelector('.qz'), items.map(q => ({ ...q, key: q.id })));
      } catch (err) { out.innerHTML = `<div class="result ng">${esc(err.message)}</div>`; }
      e.target.disabled = false;
    };
    return;
  }

  if (m === 'feyn') {
    const ideas = ['MLCC の容量の式と、大容量化の3つの方向', 'BaTiO3 のキュリー点と温度特性の関係', 'コアシェル構造で温度特性が平坦になる理由', 'Ni 電極 MLCC で耐還元性が必要な理由と、その材料設計', 'DC バイアスで容量が下がる理由と設計上の注意', 'エージングとデエージングのメカニズム', 'LCR メーターの ALC が大容量品の測定で重要な理由', '酸素空孔による絶縁劣化のメカニズム', '曲げクラックの発生メカニズムと対策', 'デカップリングコンデンサの役割とターゲットインピーダンス'];
    w.innerHTML = `<p class="small muted">「人に説明できる」が本当の理解です。テーマについて自分の言葉で説明を書くと、AI が採点し、抜けや誤りを指摘して模範解答を示します（ファインマン・テクニック）。</p>
      <div class="form"><label>テーマ<select data-topic>${ideas.map(x => `<option>${x}</option>`).join('')}<option value="">（自由入力）</option></select></label>
      <input data-free placeholder="自由にテーマを入力（上で「自由入力」を選んだとき）" class="hide">
      <textarea rows="8" data-ans placeholder="新人や顧客に説明するつもりで書いてみましょう（箇条書きでも OK）"></textarea></div>
      <div class="btn-row"><button class="btn primary" data-go>採点してもらう</button></div><div class="out2"></div>
      ${st.feyn.length ? `<h3>これまでの記録</h3><table class="cmp">${st.feyn.slice(-10).reverse().map(f => `<tr><td>${new Date(f.ts).toLocaleDateString()}</td><td>${esc(f.topic)}</td><td><b>${f.score}</b></td></tr>`).join('')}</table>` : ''}`;
    const sel = w.querySelector('[data-topic]'); sel.onchange = () => w.querySelector('[data-free]').classList.toggle('hide', sel.value !== '');
    w.querySelector('[data-go]').onclick = async e => {
      if (!need()) return;
      const topic = sel.value || w.querySelector('[data-free]').value.trim();
      const ans = w.querySelector('[data-ans]').value.trim();
      if (!topic || ans.length < 20) { toast('テーマと、20文字以上の説明を入力してください'); return; }
      const out = w.querySelector('.out2'); e.target.disabled = true; out.innerHTML = '<div class="spinner"></div>';
      try {
        const r = await AI.checkExplanation(topic, ans);
        st.feyn.push({ ts: Date.now(), topic, score: r.score }); if (st.feyn.length > 200) st.feyn.shift(); save(); logActivity('ai', 'feyn');
        const li = a => a?.length ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="small muted">なし</p>';
        out.innerHTML = `<div class="card"><div class="row-between"><h2 style="margin:0">採点結果</h2><div class="score ${r.score >= 80 ? 'okc' : r.score >= 60 ? 'warn' : 'ngc'}">${r.score}<small>/100</small></div></div>
          <h3>👍 よく書けている点</h3>${li(r.good)}<h3>🧩 抜けているポイント</h3>${li(r.missing)}<h3>⚠️ 誤り・不正確な点</h3>${li(r.wrong)}
          <h3>📘 模範的な説明</h3><div class="lesson">${md(r.model)}</div><div class="tip small">➡️ ${esc(r.next)}</div></div>`;
      } catch (err) { out.innerHTML = `<div class="result ng">${esc(err.message)}</div>`; }
      e.target.disabled = false;
    };
    return;
  }

  if (m === 'read') {
    w.innerHTML = `<p class="small muted">論文の要旨、データシート、アプリケーションノート、英語のニュース記事などを貼り付けると、要約・技術的ポイント・業務への示唆・用語・理解度チェックを作ります。<b>社外秘の資料は貼り付けないでください。</b></p>
      <div class="form"><label>読む目的（任意）<input data-p placeholder="例：競合の新製品の技術的な特徴を知りたい"></label><textarea rows="10" data-t placeholder="ここに本文を貼り付け（英語でも OK）"></textarea></div>
      <div class="btn-row"><button class="btn primary" data-go>読み解く</button></div><div class="out2"></div>`;
    w.querySelector('[data-go]').onclick = async e => {
      if (!need()) return;
      const text = w.querySelector('[data-t]').value.trim(); if (text.length < 30) { toast('本文を貼り付けてください'); return; }
      const out = w.querySelector('.out2'); e.target.disabled = true; out.innerHTML = '<div class="spinner"></div>';
      try { const a = await AI.summarize(text, w.querySelector('[data-p]').value.trim()); out.innerHTML = `<div class="card lesson">${md(a)}</div>`; logActivity('ai', 'read'); }
      catch (err) { out.innerHTML = `<div class="result ng">${esc(err.message)}</div>`; }
      e.target.disabled = false;
    };
    return;
  }

  // 学習アドバイス
  const summary = () => {
    const lines = TRACK_IDS.map(t => { const p = trackProgress(t); const wrongN = TRACKS[t].lessons.reduce((a, l) => a + l.quiz.filter((_, i) => st.quiz[`${l.id}-${i}`]?.wrongLast).length, 0); return `- ${TRACKS[t].name}: レッスン ${p.done}/${p.total}、クイズ正解 ${p.qOk}/${p.qTotal}、最後に間違えた問題 ${wrongN}`; });
    const weak = allLessons().map(l => ({ l, w: l.quiz.reduce((a, _, i) => a + (st.quiz[`${l.id}-${i}`]?.wrong || 0), 0) })).filter(x => x.w).sort((a, b) => b.w - a.w).slice(0, 5).map(x => `${x.l.title}（誤答 ${x.w}）`);
    const cq = cardQueue();
    return `## 学習状況\n${lines.join('\n')}\n- 用語カード: 覚えた ${cq.learned}/${cq.total}\n- 連続学習 ${streak()} 日\n- 誤答の多いレッスン: ${weak.join('、') || 'なし'}\n- 説明チェックの最近の点数: ${st.feyn.slice(-5).map(f => `${f.topic} ${f.score}点`).join('、') || 'なし'}`;
  };
  w.innerHTML = `<p class="small muted">学習記録をもとに、次に何を学ぶとよいか、業務で試せる小さな実践を AI が提案します。</p>
    <div class="card"><pre class="code" style="white-space:pre-wrap">${esc(summary())}</pre></div>
    <div class="form"><label>あなたの業務・関心（任意）<input data-role placeholder="例：プロセス開発で焼成工程を担当。信頼性の知識を強化したい"></label></div>
    <div class="btn-row"><button class="btn primary" data-go>アドバイスをもらう</button></div><div class="out2"></div>`;
  w.querySelector('[data-go]').onclick = async e => {
    if (!need()) return;
    const out = w.querySelector('.out2'); e.target.disabled = true; out.innerHTML = '<div class="spinner"></div>';
    try { const role = w.querySelector('[data-role]').value.trim(); const a = await AI.advise(summary() + (role ? `\n\n## 受講者の業務・関心\n${role}` : '')); out.innerHTML = `<div class="card lesson">${md(a)}</div>`; logActivity('ai', 'plan'); }
    catch (err) { out.innerHTML = `<div class="result ng">${esc(err.message)}</div>`; }
    e.target.disabled = false;
  };
}

// ---------- 設定 ----------
function settings() {
  const st = getState(); const s = st.settings;
  const cur = AI.provider() || s.aiProvider || 'openai';
  view.innerHTML = `
    <div class="card"><h2>🤖 AI 先生（任意）</h2>
      <p class="small">API キーを登録すると、レッスンごとの AI 先生（深掘り・数値例・業務での使い方・質問）、技術相談、問題の自動作成、説明チェック、資料の読解、用語解説が使えます。</p>
      <div class="form">
        <label>使用するAI
          <select id="prov">
            <option value="openai" ${cur === 'openai' ? 'selected' : ''}>OpenAI（ChatGPT の API）</option>
            <option value="anthropic" ${cur === 'anthropic' ? 'selected' : ''}>Claude（Anthropic）</option>
            <option value="none" ${cur === 'none' ? 'selected' : ''}>使わない</option>
          </select></label>
        <div id="provOpenAI" class="form">
          <label>OpenAI API キー<input type="password" id="key" value="${esc(s.openaiKey)}" placeholder="sk-..." autocomplete="off"></label>
          <label>モデル<select id="model"></select></label>
          <label id="modelCustomWrap" class="hide">モデル名を直接入力<input id="modelCustom" value="${esc(s.openaiModel)}" placeholder="${AI.OPENAI_DEFAULT}" autocomplete="off" autocapitalize="off"></label>
          <div class="btn-row" style="margin-top:0"><button class="btn sm" id="listm">このキーで使えるモデル一覧を取得</button><span id="modelsStatus" class="small muted"></span></div>
          <div class="two">
            <label>単価：入力（$/100万トークン）<input type="number" id="pin" min="0" step="0.01" value="${esc(s.openaiPriceIn)}" placeholder="例 2"></label>
            <label>単価：出力（$/100万トークン）<input type="number" id="pout" min="0" step="0.01" value="${esc(s.openaiPriceOut)}" placeholder="例 10"></label>
          </div>
          <p class="small muted">API キーは <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">OpenAI の API キーのページ ↗</a> で作成します（ChatGPT の月額プランとは別の従量課金）。単価は任意で、入れるとホームに推定金額が出ます（<a href="https://platform.openai.com/docs/pricing" target="_blank" rel="noopener">料金ページ ↗</a>）。キーを入れたら「一覧を取得」で最新モデルを選んでください。</p>
        </div>
        <div id="provAnthropic" class="form">
          <label>Anthropic API キー<input type="password" id="ckey" value="${esc(s.apiKey)}" placeholder="sk-ant-..." autocomplete="off"></label>
          <label>モデル<select id="claudeModel">${AI.CLAUDE_MODELS.map(m => `<option value="${m.id}" ${(s.claudeModel || 'claude-opus-5-5') === m.id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></label>
        </div>
        <label>円換算（1ドル = 何円で表示するか）<input type="number" id="yen" min="50" max="400" value="${esc(s.yen || 150)}"></label>
      </div>
      <p class="small muted">キーはこの端末のブラウザ内にのみ保存され、選んだ会社の API への直接リクエストにだけ使われます。共有端末では入力しないでください。<b>会社の機密情報（未公開の技術・顧客情報など）は AI に入力しないでください。</b>会社で利用する場合は、社内の生成 AI 利用ルールに従ってください。他の学習アプリとは別に保存されるので、こちらでも登録が必要です。</p>
      <div class="btn-row"><button class="btn primary" id="saveAI">保存</button></div>
    </div>
    <div class="card"><h2>学習</h2><div class="form">
      <label>1日の新しい用語カードの上限<input type="number" id="daily" min="1" max="100" value="${esc(s.dailyCards || 15)}"></label>
      <label>テーマ<select id="theme"><option value="">端末に合わせる</option><option value="light" ${s.theme === 'light' ? 'selected' : ''}>ライト</option><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>ダーク</option></select></label></div></div>
    <div class="card"><h2>データ</h2>
      <p class="small muted">学習記録はこの端末のブラウザに保存されています。機種変更の前に書き出しておきましょう。</p>
      <div class="btn-row"><button class="btn" id="exp">書き出し</button><label class="btn">読み込み<input type="file" id="imp" accept="application/json" hidden></label><button class="btn" id="reset" style="color:var(--ng)">すべてリセット</button></div>
    </div>
    <div class="card small muted">ホーム画面に追加するとアプリのように使えます（iPhone: 共有 → ホーム画面に追加 / Android: メニュー → アプリをインストール）。<br>
    教材はオリジナルで、数値は代表的な範囲・目安です。材料・条件・メーカーによって異なります。規格・製品の正式な値は、規格書・各社の製品仕様書で確認してください。市場の数値は公開情報に基づく概数です。</div>`;
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
    const status = $('#modelsStatus'); const setS = t => { if (status.isConnected) status.textContent = t; };
    setS('取得中…');
    try {
      const list = await AI.listModels(key);
      if (!list.length) throw new Error('使えるモデルが見つかりませんでした');
      st.settings.openaiModels = list; save();
      if (!status.isConnected) return;
      const c = $('#model').value === '__custom' ? $('#modelCustom').value.trim() : $('#model').value;
      drawModels(list, list.some(m => m.id === c) ? c : list[0].id);
      setS(`${list.length}件取得しました（新しい順）。選んで「保存」を押してください。`);
    } catch (e) { setS(e.message); }
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
  $('#daily').onchange = e => { st.settings.dailyCards = Math.max(1, +e.target.value || 15); save(); };
  $('#theme').onchange = e => { st.settings.theme = e.target.value; save(); applyTheme(); };
  $('#exp').onclick = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mlccdojo-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
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
