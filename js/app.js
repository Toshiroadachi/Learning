import { getState, save, bump, today, recordAnswer, recordVocab, exportJSON, importJSON, resetAll, DEFAULT_SCHEDULE } from './storage.js';
import { PART_INFO, predict, recommend, weakTags, targetRates, pct, partStats, rawToScaled } from './score.js';
import { speak, speakSequence, stop as stopSpeech, ttsAvailable } from './speech.js';
import P1 from '../data/p1.js';
import P2 from '../data/p2.js';
import P3 from '../data/p3.js';
import P4 from '../data/p4.js';
import P5 from '../data/p5.js';
import P6 from '../data/p6.js';
import P7 from '../data/p7.js';
import VOCAB from '../data/vocab.js';
import { aiProvider, CLAUDE_MODELS, OPENAI_SUGGESTED } from './ai.js';

const BUILTIN = { 1: P1, 2: P2, 3: P3, 4: P4, 5: P5, 6: P6, 7: P7 };
const SET_PARTS = new Set([3, 4, 6, 7]);
const LETTERS = 'ABCD';
const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = () => $('#view');
const S = () => getState();

// ---------- 問題バンク ----------
function bank(part) {
  const ai = S().aiBank.filter(q => q.part === part);
  return [...BUILTIN[part].map(q => ({ ...q, part })), ...ai];
}
const allUnits = () => Object.keys(BUILTIN).flatMap(p => bank(+p));
const qids = unit => SET_PARTS.has(unit.part) ? unit.questions.map((_, i) => `${unit.id}#${i}`) : [unit.id];

function answeredSet() {
  return new Set(S().answers.map(a => a.qid));
}

// 実力に合った難易度
function levelFor(part) {
  const r = partStats()[part].rate;
  return r >= 0.88 ? 5 : r >= 0.78 ? 4 : r >= 0.65 ? 3 : 2;
}

// 出題する問題（ユニット）を選ぶ
function pickUnits(part, nQuestions, { mode = 'smart', diff = 'auto' } = {}) {
  const units = bank(part);
  const answered = answeredSet();
  const weak = new Map(weakTags(S(), part).map(t => [t.tag, 1 - t.rate]));
  const lvl = levelFor(part);
  const now = Date.now();
  const scored = units.map(u => {
    const ids = qids(u);
    const unseen = ids.every(id => !answered.has(id));
    const due = ids.some(id => S().srs[id] && S().srs[id].due <= now);
    const tag = u.tag || '';
    let s = Math.random() * 0.8;
    if (mode === 'smart') {
      if (unseen) s += 3;
      if (due) s += 2.5;
      s -= Math.abs((u.diff || 3) - lvl) * 0.6;
      s += (weak.get(tag) || 0) * 2;
    } else if (mode === 'new') {
      s += unseen ? 5 : 0;
    }
    if (diff !== 'auto' && diff !== 'all') {
      const [lo, hi] = diff.split('-').map(Number);
      if ((u.diff || 3) < lo || (u.diff || 3) > hi) s -= 10;
    }
    return { u, s };
  }).sort((a, b) => b.s - a.s);
  const out = [];
  let count = 0;
  for (const { u } of scored) {
    if (count >= nQuestions) break;
    out.push(u);
    count += qids(u).length;
  }
  return out;
}

function dueReviewUnits(limit = 20) {
  const now = Date.now();
  const due = Object.entries(S().srs).filter(([, v]) => v.due <= now).map(([id]) => id.split('#')[0]);
  const ids = [...new Set(due)];
  const map = new Map(allUnits().map(u => [u.id, u]));
  const out = [];
  let count = 0;
  for (const id of ids) {
    const u = map.get(id);
    if (!u) continue;
    out.push(u);
    count += qids(u).length;
    if (count >= limit) break;
  }
  return out;
}

// 選択肢シャッフル（[1]や数値・時刻・金額の選択肢は順番を保持）
function perm(options) {
  const idx = options.map((_, i) => i);
  if (options.every(o => /^[\[$\d]/.test(o.trim()))) return idx;
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

// ---------- ルーティング ----------
const routes = {
  home: renderHome, practice: renderPractice, quiz: renderQuiz, vocab: renderVocab,
  news: renderNews, history: renderHistory, settings: renderSettings,
};
let quiz = null;

function go(hash) { location.hash = hash; }
function router() {
  stopSpeech();
  const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
  const r = routes[name] || renderHome;
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.route === (routes[name] ? name : 'home') || (name === 'quiz' && a.dataset.route === 'practice')));
  r(arg);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', router);

// ---------- スケジュール ----------
function taskProgress(task, day = today()) {
  const log = S().log[day] || { counts: {}, manual: {} };
  const c = log.counts || {};
  let n = 0;
  if (task.kind === 'vocab') n = c.vocab || 0;
  else if (task.kind === 'part') n = c['part' + task.part] || 0;
  else if (task.kind === 'listening') n = c.listening || 0;
  else if (task.kind === 'review') n = c.review || 0;
  else if (task.kind === 'news') n = c.news || 0;
  const manual = !!(log.manual || {})[task.id];
  const done = manual || (task.kind !== 'manual' && n >= task.target);
  return { n, done, manual };
}

function dayComplete(day) {
  return S().schedule.length > 0 && S().schedule.every(t => taskProgress(t, day).done);
}

function streak() {
  let d = new Date(), s = 0;
  if (!dayComplete(today(d))) d.setDate(d.getDate() - 1);
  while (dayComplete(today(d))) { s++; d.setDate(d.getDate() - 1); }
  return s;
}

function taskLink(t) {
  if (t.kind === 'vocab') return '#/vocab';
  if (t.kind === 'part') return `#/quiz/part-${t.part}`;
  if (t.kind === 'listening') return '#/quiz/listening';
  if (t.kind === 'review') return '#/quiz/review';
  if (t.kind === 'news') return '#/news';
  return '';
}

// ---------- ホーム ----------
function renderHome() {
  const st = S();
  const { recs, pred, tgt } = recommend();
  const target = st.settings.targetScore;
  const gap = target - pred.total;
  const days = st.settings.examDate ? Math.ceil((new Date(st.settings.examDate) - new Date(today())) / 86400000) : null;
  const tasks = st.schedule.map(t => ({ t, p: taskProgress(t) }));
  const doneN = tasks.filter(x => x.p.done).length;
  const dueCount = Object.values(st.srs).filter(v => v.due <= Date.now()).length;

  view().innerHTML = `
  <section class="card hero">
    <div class="hero-top">
      <div>
        <div class="label">予想スコア</div>
        <div class="big">${pred.total}<small> / 990</small></div>
        <div class="muted">範囲 ${pred.low}〜${pred.high}　信頼度: ${pred.confidence}</div>
      </div>
      <div class="ring" style="--p:${Math.min(100, pred.total / target * 100)}">
        <span>目標<br><b>${target}</b></span>
      </div>
    </div>
    <div class="lr">
      <div><span class="tagL">L</span> ${pred.listening} <small class="muted">/ 目標 ${tgt.L}</small></div>
      <div><span class="tagR">R</span> ${pred.reading} <small class="muted">/ 目標 ${tgt.R}</small></div>
    </div>
    <div class="muted small">${gap > 0 ? `目標まであと <b>${gap}点</b>` : '🎉 目標スコアに到達しています！維持と上積みを目指しましょう'}
      ${days !== null ? `　｜　試験日まで <b>${days}日</b>` : ''}　｜　解答数 ${pred.answered}問</div>
  </section>

  <section class="card">
    <div class="row-between"><h2>今日のスケジュール</h2><span class="pill">${doneN}/${tasks.length} 完了　🔥${streak()}日連続</span></div>
    <ul class="tasks">
      ${tasks.map(({ t, p }) => `
        <li class="${p.done ? 'done' : ''}">
          <label><input type="checkbox" data-task="${esc(t.id)}" ${p.done ? 'checked' : ''}>
          <span>${esc(t.label)}</span></label>
          <span class="muted small">${t.kind === 'manual' ? `${t.target}${esc(t.unit)}` : `${Math.min(p.n, t.target)}/${t.target}${esc(t.unit)}`}</span>
          ${taskLink(t) ? `<a class="btn sm" href="${taskLink(t)}">開始</a>` : ''}
        </li>`).join('')}
    </ul>
    <div class="muted small">項目は「設定」から自由に編集できます。</div>
  </section>

  <section class="card">
    <h2>あなたへのおすすめ</h2>
    <p class="muted small">目標${target}点に対する各パートの「伸びしろ点数」から、今やるべき順に並べています。</p>
    ${recs.slice(0, 3).map((r, i) => `
      <div class="rec">
        <div class="rec-rank">${i + 1}</div>
        <div class="rec-body">
          <b>${PART_INFO[r.part].ja}</b>
          <div class="small">${esc(r.reason)}</div>
          ${weakTagLine(r.part)}
        </div>
        <a class="btn" href="#/quiz/part-${r.part}">練習</a>
      </div>`).join('')}
    <div class="btn-row">
      <a class="btn primary" href="#/quiz/smart">おすすめ問題をまとめて解く（10問）</a>
      ${dueCount ? `<a class="btn" href="#/quiz/review">復習 ${dueCount}問</a>` : ''}
      <a class="btn" href="#/quiz/mock">ミニ模試</a>
    </div>
  </section>

  <section class="card">
    <h2>パート別 推定正答率</h2>
    ${partBars(pred.stats, tgt)}
  </section>`;

  view().querySelectorAll('input[data-task]').forEach(cb => cb.addEventListener('change', () => {
    const log = (S().log[today()] ||= { counts: {}, manual: {} });
    log.manual ||= {};
    log.manual[cb.dataset.task] = cb.checked;
    save(); renderHome();
  }));
}

function weakTagLine(part) {
  const w = weakTags(S(), part).filter(t => t.rate < 0.8).slice(0, 3);
  if (!w.length) return '';
  return `<div class="small weak">弱点: ${w.map(t => `${esc(t.tag)} ${pct(t.rate)}`).join('、')}</div>`;
}

function partBars(stats, tgt) {
  return `<div class="bars">${Object.entries(PART_INFO).map(([p, info]) => {
    const s = stats[p];
    const goal = info.sec === 'L' ? tgt.lr : tgt.rr;
    return `<div class="bar-row">
      <span class="bar-label">P${p} <small class="muted">${info.name}</small></span>
      <div class="bar"><div class="fill ${s.rate >= goal ? 'ok' : ''}" style="width:${s.rate * 100}%"></div><div class="goal" style="left:${goal * 100}%" title="目標"></div></div>
      <span class="bar-val">${pct(s.rate)}<small class="muted"> (${s.count})</small></span>
    </div>`;
  }).join('')}</div><div class="muted small">縦線 = 目標スコアに必要な正答率。（）内は解答数。解答が少ないパートは現在スコアの自己申告から推定しています。</div>`;
}

// ---------- 練習メニュー ----------
function renderPractice() {
  const st = partStats();
  const tgt = targetRates(S().settings.targetScore);
  view().innerHTML = `
  <section class="card">
    <h2>パートを選んで練習</h2>
    <div class="opts">
      <label>問題数 <select id="n"><option>5</option><option selected>10</option><option>15</option><option>20</option><option>30</option></select></label>
      <label>難易度 <select id="diff"><option value="auto">実力に合わせる（推奨）</option><option value="all">すべて</option><option value="1-2">やさしい</option><option value="3-3">標準</option><option value="4-5">難しい（900点レベル）</option></select></label>
      <label>出題 <select id="mode"><option value="smart">おすすめ順（未解答・弱点・復習優先）</option><option value="new">未解答を優先</option><option value="random">ランダム</option></select></label>
    </div>
    <div class="part-grid">
      ${Object.entries(PART_INFO).map(([p, info]) => {
        const s = st[p];
        const goal = info.sec === 'L' ? tgt.lr : tgt.rr;
        const total = bank(+p).reduce((a, u) => a + qids(u).length, 0);
        return `<button class="part-card ${info.sec}" data-part="${p}">
          <div class="pc-head"><b>Part ${p}</b><span class="tag${info.sec}">${info.sec === 'L' ? 'Listening' : 'Reading'}</span></div>
          <div>${info.name}</div>
          <div class="small muted">推定 ${pct(s.rate)} / 目標 ${pct(goal)}</div>
          <div class="small muted">収録 ${total}問・解答 ${s.count}</div>
        </button>`;
      }).join('')}
    </div>
  </section>
  <section class="card">
    <h2>まとめて練習</h2>
    <div class="btn-row">
      <a class="btn primary" href="#/quiz/smart">おすすめ自動（10問）</a>
      <a class="btn" href="#/quiz/listening">リスニング Part 2〜4</a>
      <a class="btn" href="#/quiz/review">間違えた問題の復習</a>
      <a class="btn" href="#/quiz/mock">ミニ模試（約45問）</a>
    </div>
  </section>
  ${aiCard()}`;

  const opts = () => ({ n: +$('#n').value, diff: $('#diff').value, mode: $('#mode').value });
  view().querySelectorAll('[data-part]').forEach(b => b.addEventListener('click', () => {
    const o = opts();
    startQuiz({ title: PART_INFO[b.dataset.part].ja, units: pickUnits(+b.dataset.part, o.n, o) });
  }));
  bindAI();
}

function aiCard() {
  const has = !!aiProvider(S().settings);
  return `<section class="card">
    <h2>AIで新しい問題を作る <span class="pill">任意</span></h2>
    <p class="small muted">AI（Claude または OpenAI）を使い、あなたの弱点・レベルに合わせたオリジナル問題を無制限に生成できます。${has ? '' : '利用するには「設定」で API キーを入力してください。'}</p>
    ${has ? `<div class="opts">
      <label>パート <select id="aiPart">${Object.keys(PART_INFO).map(p => `<option value="${p}">Part ${p}</option>`).join('')}</select></label>
      <label>数 <select id="aiCount"><option>3</option><option selected>5</option><option>10</option></select></label>
      <label>重点 <input id="aiFocus" placeholder="例: 関係詞, 意図問題（空欄=自動で弱点）"></label>
    </div>
    <button class="btn primary" id="aiGen">生成して解く</button> <span id="aiStatus" class="small muted"></span>` : `<a class="btn" href="#/settings">設定を開く</a>`}
  </section>`;
}

function bindAI() {
  const btn = $('#aiGen');
  if (!btn) return;
  const rec = recommend().recs[0];
  $('#aiPart').value = rec.part;
  btn.addEventListener('click', async () => {
    const part = +$('#aiPart').value;
    const focus = $('#aiFocus').value.trim() || weakTags(S(), part).slice(0, 2).map(t => t.tag).join('、');
    btn.disabled = true;
    $('#aiStatus').textContent = '生成中…（数十秒かかることがあります）';
    try {
      const { generateQuestions } = await import('./ai.js');
      const items = await generateQuestions(part, { count: +$('#aiCount').value, level: levelFor(part), focus });
      S().aiBank.push(...items);
      save();
      startQuiz({ title: `AI生成 Part ${part}`, units: items });
    } catch (e) {
      $('#aiStatus').textContent = 'エラー: ' + e.message;
      btn.disabled = false;
    }
  });
}

// ---------- クイズ ----------
function buildQuiz(arg) {
  if (!arg) return null;
  if (arg.startsWith('part-')) {
    const p = +arg.slice(5);
    const task = S().schedule.find(t => t.kind === 'part' && t.part === p);
    return { title: PART_INFO[p].ja, units: pickUnits(p, task ? Math.min(task.target, 20) : 10) };
  }
  if (arg === 'smart') {
    const recs = recommend().recs.slice(0, 3);
    const units = recs.flatMap((r, i) => pickUnits(r.part, [5, 3, 2][i]));
    return { title: 'おすすめ問題', units };
  }
  if (arg === 'listening') {
    return { title: 'リスニング Part 2〜4', units: [...pickUnits(2, 6), ...pickUnits(3, 6), ...pickUnits(4, 3)] };
  }
  if (arg === 'review') return { title: '復習（間違えた問題）', units: dueReviewUnits(20), review: true };
  if (arg === 'mock') {
    const units = [...pickUnits(1, 2, { mode: 'random' }), ...pickUnits(2, 6, { mode: 'random' }), ...pickUnits(3, 6, { mode: 'random' }),
      ...pickUnits(4, 3, { mode: 'random' }), ...pickUnits(5, 10, { mode: 'random' }), ...pickUnits(6, 4, { mode: 'random' }), ...pickUnits(7, 9, { mode: 'random' })];
    return { title: 'ミニ模試', units, mock: true };
  }
  return null;
}

function startQuiz(cfg) {
  if (!cfg.units.length) { alert('出題できる問題がありません。'); return; }
  quiz = {
    ...cfg, i: 0, results: [], started: Date.now(),
    perms: cfg.units.map(u => SET_PARTS.has(u.part) ? u.questions.map(q => perm(q.options)) : [perm(u.options)]),
  };
  if (location.hash.startsWith('#/quiz')) renderQuiz(); else go('#/quiz');
}

function renderQuiz(arg) {
  if (arg) {
    const cfg = buildQuiz(arg);
    history.replaceState(null, '', '#/quiz');
    if (cfg) return startQuiz(cfg);
  }
  if (!quiz) return go('#/practice');
  if (quiz.i >= quiz.units.length) return renderResult();
  const u = quiz.units[quiz.i];
  const totalQ = quiz.units.reduce((a, x) => a + qids(x).length, 0);
  const doneQ = quiz.results.length;
  view().innerHTML = `
  <div class="quiz-head">
    <a href="#/practice" class="muted small">✕ 終了</a>
    <span class="small"><b>${esc(quiz.title)}</b>　Part ${u.part}${u.ai ? ' · AI' : ''}　難易度 ${'★'.repeat(u.diff || 3)}</span>
    <span class="small muted">${doneQ}/${totalQ}</span>
  </div>
  <div class="progress"><div style="width:${doneQ / totalQ * 100}%"></div></div>
  <section class="card quiz" id="qcard"></section>`;
  const card = $('#qcard');
  const renderer = { 1: qPart1, 2: qPart2, 3: qConversation, 4: qConversation, 5: qPart5, 6: qPassage, 7: qPassage }[u.part];
  renderer(card, u, quiz.perms[quiz.i]);
}

function optionButtons(options, order, { hideText = false } = {}) {
  return `<div class="options">${order.map((orig, k) => `
    <button class="opt" data-k="${k}" data-orig="${orig}"><b>(${LETTERS[k]})</b> <span class="opt-text ${hideText ? 'hidden-text' : ''}">${esc(options[orig])}</span></button>`).join('')}</div>`;
}

function grade(container, answer, onDone) {
  const t0 = Date.now();
  container.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => {
    if (container.dataset.done) return;
    container.dataset.done = '1';
    const chosen = +b.dataset.orig;
    container.querySelectorAll('.opt').forEach(x => {
      x.disabled = true;
      x.querySelector('.opt-text')?.classList.remove('hidden-text');
      if (+x.dataset.orig === answer) x.classList.add('correct');
    });
    if (chosen !== answer) b.classList.add('wrong');
    onDone(chosen === answer, Date.now() - t0);
  }));
}

function record(u, qIndex, correct, ms) {
  const q = SET_PARTS.has(u.part) ? u.questions[qIndex] : u;
  const qid = SET_PARTS.has(u.part) ? `${u.id}#${qIndex}` : u.id;
  recordAnswer({ qid, part: u.part, tag: q.tag || u.tag, correct, ms });
  if (quiz.review) { bump('review'); save(); }
  quiz.results.push({ part: u.part, correct, qid });
}

function nextButton(card) {
  const div = document.createElement('div');
  div.className = 'btn-row';
  div.innerHTML = `<button class="btn primary" id="next">次へ →</button>`;
  card.appendChild(div);
  $('#next').addEventListener('click', () => { stopSpeech(); quiz.i++; renderQuiz(); });
  $('#next').focus({ preventScroll: true });
}

function explBox(text, extra = '') {
  return `<div class="expl"><b>解説</b> ${esc(text)}${extra}</div>`;
}

function playBtn(id = 'play', label = '▶ 音声を再生') {
  return ttsAvailable() ? `<button class="btn" id="${id}">${label}</button>` : `<div class="warn small">このブラウザは音声合成に対応していません。スクリプトを表示して練習してください。</div>`;
}

// Part 1
function qPart1(card, u, [order]) {
  card.innerHTML = `
    <div class="scene"><div class="scene-emoji">${esc(u.scene.emoji)}</div><div class="scene-desc">📷 ${esc(u.scene.desc)}</div></div>
    <p class="small muted">写真を最もよく描写している英文を選んでください（選択肢は音声のみ）。</p>
    ${playBtn()}
    ${optionButtons(u.options, order, { hideText: true })}`;
  const lines = order.map((o, k) => ({ text: `${LETTERS[k]}. ${u.options[o]}`, gender: u.id.charCodeAt(u.id.length - 1) % 2 ? 'M' : 'W' }));
  const play = () => speakSequence(lines, u.id.length, 900);
  $('#play')?.addEventListener('click', play);
  setTimeout(play, 300);
  grade(card, u.answer, (ok, ms) => {
    record(u, 0, ok, ms);
    card.insertAdjacentHTML('beforeend', explBox(u.expl));
    nextButton(card);
  });
}

// Part 2
function qPart2(card, u, [order]) {
  card.innerHTML = `
    <p class="small muted">質問（発言）に対する最も適切な応答を選んでください。</p>
    <div class="transcript hidden-block" id="qtext">Q: ${esc(u.q)}</div>
    ${playBtn()}
    ${optionButtons(u.options, order, { hideText: true })}`;
  const g1 = u.id.charCodeAt(u.id.length - 1) % 2 ? 'M' : 'W';
  const g2 = g1 === 'M' ? 'W' : 'M';
  const lines = [{ text: u.q, gender: g1 }, ...order.map((o, k) => ({ text: `${LETTERS[k]}. ${u.options[o]}`, gender: g2 }))];
  const play = () => speakSequence(lines, u.id.length, 800);
  $('#play')?.addEventListener('click', play);
  setTimeout(play, 300);
  grade(card, u.answer, (ok, ms) => {
    record(u, 0, ok, ms);
    $('#qtext').classList.remove('hidden-block');
    card.insertAdjacentHTML('beforeend', explBox(u.expl, ` <button class="btn sm" id="replay">🔁 もう一度聞く</button>`));
    $('#replay')?.addEventListener('click', play);
    nextButton(card);
  });
}

// Part 3 / 4
function scriptLines(u) {
  if (u.part === 3) return u.script.map(l => ({ text: l.t, gender: l.sp, label: l.sp.replace('2', '₂') }));
  const sentences = u.script.match(/[^.!?]+[.!?]+["']?\s*/g) || [u.script];
  return sentences.map(t => ({ text: t.trim(), gender: u.voice || 'W', label: '' }));
}

function setQuestions(u, order) {
  return u.questions.map((q, qi) => `
    <div class="setq" data-qi="${qi}">
      <div class="q-text"><b>Q${qi + 1}.</b> ${esc(q.q).replace(/\n/g, '<br>')}</div>
      ${optionButtons(q.options, order[qi])}
    </div>`).join('');
}

function bindSet(card, u, onAll) {
  let done = 0;
  card.querySelectorAll('.setq').forEach(div => {
    const qi = +div.dataset.qi;
    grade(div, u.questions[qi].answer, (ok, ms) => {
      record(u, qi, ok, ms);
      div.insertAdjacentHTML('beforeend', explBox(u.questions[qi].expl));
      if (++done === u.questions.length) onAll();
    });
  });
}

function qConversation(card, u, order) {
  const lines = scriptLines(u);
  card.innerHTML = `
    <p class="small muted">${u.part === 3 ? '会話' : 'トーク'}を聞いて設問に答えてください。（本番同様、設問は先読みできます）</p>
    ${u.graphic ? `<pre class="graphic">${esc(u.graphic)}</pre>` : ''}
    ${playBtn()} <button class="btn sm" id="stopA">■ 停止</button>
    ${setQuestions(u, order)}
    <div id="after"></div>`;
  const play = () => speakSequence(lines, u.id.length, 350);
  $('#play')?.addEventListener('click', play);
  $('#stopA').addEventListener('click', stopSpeech);
  setTimeout(play, 300);
  bindSet(card, u, () => {
    $('#after').innerHTML = shadowingBlock(lines);
    bindShadowing(lines);
    nextButton(card);
  });
}

function shadowingBlock(lines) {
  return `<details class="shadow" open><summary><b>スクリプト & シャドーイング</b></summary>
    <p class="small muted">各行の ▶ で1文ずつ再生。音声の直後を追いかけて発音しましょう。</p>
    ${lines.map((l, i) => `<div class="sline"><button class="btn sm" data-line="${i}">▶</button> ${l.label ? `<b>${esc(l.label)}:</b> ` : ''}${esc(l.text)}</div>`).join('')}
    <div class="btn-row"><button class="btn sm" id="slow">🐢 0.75倍で全文再生</button><button class="btn sm" id="markShadow">✔ シャドーイング完了として記録</button></div>
  </details>`;
}

function bindShadowing(lines) {
  document.querySelectorAll('[data-line]').forEach(b => b.addEventListener('click', () => {
    stopSpeech();
    const l = lines[+b.dataset.line];
    speak(l.text, { gender: l.gender, accent: 0 });
  }));
  $('#slow')?.addEventListener('click', async () => {
    stopSpeech();
    const rate = S().settings.speechRate;
    S().settings.speechRate = 0.75;
    await speakSequence(lines, 0, 400);
    S().settings.speechRate = rate;
  });
  $('#markShadow')?.addEventListener('click', e => {
    const task = S().schedule.find(t => t.id === 'shadow') || S().schedule.find(t => t.kind === 'manual');
    if (task) {
      const log = (S().log[today()] ||= { counts: {}, manual: {} });
      (log.manual ||= {})[task.id] = true;
      save();
    }
    e.target.textContent = '✔ 記録しました';
    e.target.disabled = true;
  });
}

// Part 5
function qPart5(card, u, [order]) {
  const limit = S().settings.p5TimeLimit || 20;
  card.innerHTML = `
    <div class="row-between"><span class="small muted">空所に入る最も適切な語句を選んでください。</span><span class="timer" id="timer">0s</span></div>
    <p class="sentence">${esc(u.q).replace('-------', '<span class="blank">-------</span>')}</p>
    ${optionButtons(u.options, order)}`;
  const t0 = Date.now();
  const iv = setInterval(() => {
    const el = $('#timer');
    if (!el) return clearInterval(iv);
    const s = Math.floor((Date.now() - t0) / 1000);
    el.textContent = `${s}s / ${limit}s`;
    el.classList.toggle('over', s > limit);
  }, 250);
  grade(card, u.answer, (ok, ms) => {
    clearInterval(iv);
    record(u, 0, ok, ms);
    const slow = ms / 1000 > limit ? `<div class="small warn">⏱ ${Math.round(ms / 1000)}秒。900点には1問${limit}秒以内が目安です。</div>` : '';
    card.insertAdjacentHTML('beforeend', explBox(u.expl) + slow + `<div class="small muted">カテゴリ: ${esc(u.tag)}</div>`);
    nextButton(card);
  });
}

// Part 6 / 7
function qPassage(card, u, order) {
  const passages = u.part === 6 ? [{ title: u.title, text: u.passage }] : u.passages;
  card.innerHTML = `
    <p class="small muted">${u.part === 6 ? '文書を読み、空所 [1]〜[4] に入る最も適切なものを選んでください。' : '文書を読んで設問に答えてください。'}${passages.length > 1 ? `（${passages.length}文書）` : ''}</p>
    <div class="passages">${passages.map(p => `<article class="passage"><div class="ptitle">${esc(p.title)}</div><div class="ptext">${esc(p.text).replace(/\[(\d)\]/g, '<span class="blank">[$1]</span>').replace(/\n/g, '<br>')}</div></article>`).join('')}</div>
    <div class="row-between"><span></span><span class="timer" id="timer">0:00</span></div>
    ${setQuestions(u, order)}`;
  const t0 = Date.now();
  const iv = setInterval(() => {
    const el = $('#timer');
    if (!el) return clearInterval(iv);
    const s = Math.floor((Date.now() - t0) / 1000);
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 500);
  bindSet(card, u, () => {
    clearInterval(iv);
    const s = Math.round((Date.now() - t0) / 1000);
    const target = u.questions.length * (u.part === 6 ? 30 : 60);
    card.insertAdjacentHTML('beforeend', `<div class="small ${s > target ? 'warn' : 'muted'}">所要 ${Math.floor(s / 60)}分${s % 60}秒（目安 ${Math.round(target / 60)}分以内）</div>`);
    nextButton(card);
  });
}

function renderResult() {
  const r = quiz.results;
  const c = r.filter(x => x.correct).length;
  const byPart = {};
  for (const x of r) { const b = (byPart[x.part] ||= { n: 0, c: 0 }); b.n++; if (x.correct) b.c++; }
  let mockHtml = '';
  if (quiz.mock && !quiz.saved) {
    // 模試：セクションごとの正答率を本番の問題数に当てはめて換算
    const sec = { L: { n: 0, c: 0 }, R: { n: 0, c: 0 } };
    for (const x of r) { const s = sec[PART_INFO[x.part].sec]; s.n++; if (x.correct) s.c++; }
    const scaled = k => {
      const rate = sec[k].n ? sec[k].c / sec[k].n : 0;
      return Math.round(Math.max(5, Math.min(495, rawToScaled(k, rate * 100))) / 5) * 5;
    };
    const L = scaled('L'), R = scaled('R');
    S().mocks.push({ ts: Date.now(), listening: L, reading: R, total: L + R, n: r.length });
    save();
    quiz.saved = { L, R };
  }
  if (quiz.mock) mockHtml = `<div class="big">${quiz.saved.L + quiz.saved.R}<small> 点相当</small></div><div>L ${quiz.saved.L} / R ${quiz.saved.R}</div><p class="small muted">ミニ模試の正答率を本番の問題数に換算した参考値です。</p>`;
  const pred = predict();
  view().innerHTML = `
  <section class="card center">
    <h2>${esc(quiz.title)} 結果</h2>
    ${mockHtml}
    <div class="big">${c} / ${r.length}</div>
    <div class="muted">正答率 ${pct(r.length ? c / r.length : 0)}</div>
    <div class="parts-result">${Object.entries(byPart).map(([p, b]) => `<span class="pill">P${p}: ${b.c}/${b.n}</span>`).join(' ')}</div>
    <p>更新後の予想スコア: <b>${pred.total}</b>（L ${pred.listening} / R ${pred.reading}）</p>
    <div class="btn-row center">
      <a class="btn primary" href="#/home">ホームへ</a>
      <a class="btn" href="#/practice">続けて練習</a>
      ${r.some(x => !x.correct) ? '<a class="btn" href="#/quiz/review">間違いを復習</a>' : ''}
    </div>
  </section>`;
}


// ---------- 単語 ----------
let vocabSession = null;
function renderVocab(arg) {
  const st = S();
  const now = Date.now();
  if (arg === 'list') return renderMyWords();
  if (!vocabSession) {
    const due = VOCAB.filter(v => st.vocab[v.word] && st.vocab[v.word].due <= now);
    const fresh = VOCAB.filter(v => !st.vocab[v.word]);
    const task = st.schedule.find(t => t.kind === 'vocab');
    const size = task ? task.target : 30;
    const deck = [...shuffle(due), ...fresh].slice(0, size);
    vocabSession = { deck, i: 0, known: 0 };
  }
  const s = vocabSession;
  const mastered = Object.values(st.vocab).filter(v => v.box >= 4).length;
  if (s.i >= s.deck.length) {
    view().innerHTML = `<section class="card center"><h2>単語セッション完了</h2>
      <div class="big">${s.known} / ${s.deck.length}</div><p class="muted">習得済み ${mastered} / ${VOCAB.length}語</p>
      <div class="btn-row center"><button class="btn primary" id="again">もう1セット</button><a class="btn" href="#/vocab/list">My単語帳</a><a class="btn" href="#/home">ホーム</a></div></section>`;
    $('#again').addEventListener('click', () => { vocabSession = null; renderVocab(); });
    return;
  }
  const v = s.deck[s.i];
  view().innerHTML = `
  <div class="quiz-head"><span class="small"><b>単語フラッシュカード</b>（900点レベル）</span><a class="small" href="#/vocab/list">My単語帳 (${st.myWords.length})</a><span class="small muted">${s.i + 1}/${s.deck.length}</span></div>
  <div class="progress"><div style="width:${s.i / s.deck.length * 100}%"></div></div>
  <section class="card flash" id="flash">
    <div class="word">${esc(v.word)} <button class="btn sm" id="say">🔊</button></div>
    <div class="muted small">タップで意味を表示</div>
    <div class="back hidden-block" id="back">
      <div class="ja">[${esc(v.pos)}] ${esc(v.ja)}</div>
      <div class="ex">${esc(v.ex)} <button class="btn sm" id="sayEx">🔊</button></div>
    </div>
  </section>
  <div class="btn-row center" id="judge" style="visibility:hidden">
    <button class="btn wrongbtn" id="no">✗ 知らなかった</button>
    <button class="btn okbtn" id="yes">○ 知ってた</button>
  </div>
  <p class="center small muted">習得済み ${mastered} / ${VOCAB.length}語（間隔反復で自動的に出題）</p>`;
  const reveal = () => { $('#back').classList.remove('hidden-block'); $('#judge').style.visibility = 'visible'; };
  $('#flash').addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') reveal(); });
  $('#say').addEventListener('click', () => speak(v.word));
  $('#sayEx').addEventListener('click', () => speak(v.ex));
  const judge = ok => { recordVocab(v.word, ok); if (ok) s.known++; else s.deck.push(v); s.i++; renderVocab(); };
  $('#yes').addEventListener('click', () => judge(true));
  $('#no').addEventListener('click', () => judge(false));
}

function renderMyWords() {
  const words = S().myWords;
  view().innerHTML = `<section class="card"><div class="row-between"><h2>My単語帳</h2><a class="btn sm" href="#/vocab">フラッシュカードへ</a></div>
    <p class="small muted">ニュース記事でタップして保存した単語です。</p>
    ${words.length ? `<ul class="wordlist">${words.slice().reverse().map((w, i) => `<li><div><b>${esc(w.word)}</b> <span class="small">${esc(w.note || '')}</span><div class="small muted">${esc(w.source || '')}</div></div><button class="btn sm" data-del="${words.length - 1 - i}">削除</button></li>`).join('')}</ul>` : '<p class="muted">まだ保存した単語はありません。</p>'}
  </section>`;
  view().querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { S().myWords.splice(+b.dataset.del, 1); save(); renderMyWords(); }));
}

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- ニュース ----------
let newsCache = null;
let newsFilter = 'all';
async function loadNews() {
  if (newsCache) return newsCache;
  const res = await fetch('data/news.json?d=' + today(), { cache: 'no-cache' });
  if (!res.ok) throw new Error('news.json を読み込めませんでした');
  newsCache = await res.json();
  return newsCache;
}

async function renderNews(arg) {
  view().innerHTML = `<section class="card"><p class="muted">読み込み中…</p></section>`;
  let data;
  try { data = await loadNews(); } catch (e) {
    view().innerHTML = `<section class="card"><h2>海外ニュース</h2><p class="warn">${esc(e.message)}</p><p class="small muted">ローカルで開いている場合は <code>python3 -m http.server</code> などで起動してください。</p></section>`;
    return;
  }
  if (arg) return renderArticle(data.items.find(x => x.id === arg));
  const cats = ['all', ...new Set(data.items.map(x => x.category))];
  const items = data.items.filter(x => newsFilter === 'all' || x.category === newsFilter);
  const groups = {};
  for (const it of items) (groups[today(new Date(it.published))] ||= []).push(it);
  const readN = (S().log[today()]?.counts?.news) || 0;
  const task = S().schedule.find(t => t.kind === 'news');
  view().innerHTML = `
  <section class="card">
    <div class="row-between"><h2>海外ニュース</h2><span class="pill">今日 ${readN}${task ? '/' + task.target : ''} 記事</span></div>
    <p class="small muted">毎日自動更新（最終更新: ${new Date(data.updated).toLocaleString('ja-JP')}）。英文の要約を読み、知らない単語はタップして単語帳へ。TOEIC頻出語は<mark>ハイライト</mark>表示されます。</p>
    <div class="chips">${cats.map(c => `<button class="chip ${c === newsFilter ? 'on' : ''}" data-cat="${esc(c)}">${c === 'all' ? 'すべて' : esc(c)}</button>`).join('')}</div>
  </section>
  ${Object.entries(groups).map(([day, list]) => `
    <h3 class="day">${day}</h3>
    ${list.map(it => `<a class="card news-item ${S().newsRead[it.id] ? 'read' : ''}" href="#/news/${it.id}">
      ${it.thumb ? `<img src="${esc(it.thumb)}" alt="" loading="lazy">` : ''}
      <div><div class="small muted">${esc(it.source)} · ${esc(it.category)} ${S().newsRead[it.id] ? '· ✔既読' : ''}</div>
      <b>${esc(it.title)}</b><div class="small clamp">${esc(it.summary)}</div></div></a>`).join('')}`).join('') || '<p class="muted">記事がありません。</p>'}`;
  view().querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { newsFilter = b.dataset.cat; renderNews(); }));
}

const VOCAB_MAP = new Map(VOCAB.map(v => [v.word.toLowerCase(), v]));
function lookupVocab(w) {
  const lw = w.toLowerCase();
  for (const cand of [lw, lw.replace(/(es|s)$/, ''), lw.replace(/ed$/, ''), lw.replace(/d$/, ''), lw.replace(/ing$/, ''), lw.replace(/ing$/, 'e'), lw.replace(/ly$/, ''), lw.replace(/ies$/, 'y')]) {
    if (VOCAB_MAP.has(cand)) return VOCAB_MAP.get(cand);
  }
  return null;
}

function wordify(text) {
  return esc(text).replace(/[A-Za-z][A-Za-z'-]*/g, w => {
    const v = lookupVocab(w);
    return `<span class="w${v ? ' hl' : ''}" data-w="${w}">${w}</span>`;
  });
}

function renderArticle(it) {
  if (!it) return go('#/news');
  const read = !!S().newsRead[it.id];
  view().innerHTML = `
  <a href="#/news" class="small">← 一覧へ</a>
  <article class="card article">
    <div class="small muted">${esc(it.source)} · ${esc(it.category)} · ${new Date(it.published).toLocaleString('ja-JP')}</div>
    <h2 class="en">${wordify(it.title)}</h2>
    <p class="en lead">${wordify(it.summary)}</p>
    <div class="btn-row">
      <button class="btn" id="tts">🔊 読み上げ</button>
      <a class="btn" href="${esc(it.link)}" target="_blank" rel="noopener">元記事を読む ↗</a>
      <button class="btn primary" id="done" ${read ? 'disabled' : ''}>${read ? '✔ 読了済み' : '✔ 読了'}</button>
    </div>
    <div id="wordpop" class="wordpop hidden-block"></div>
    <p class="small muted">単語をタップすると意味の確認・単語帳への保存ができます。全文は元記事のサイトでお読みください。</p>
  </article>
  ${aiProvider(S().settings) ? `<section class="card"><button class="btn" id="aiExplain">🤖 AIで日本語解説＋理解度クイズ</button><div id="aiOut"></div></section>` : ''}`;
  $('#tts').addEventListener('click', () => speakSequence([{ text: it.title, gender: 'W' }, { text: it.summary, gender: 'W' }], 1));
  $('#done').addEventListener('click', () => {
    if (!S().newsRead[it.id]) { S().newsRead[it.id] = Date.now(); bump('news'); save(); }
    renderArticle(it);
  });
  view().querySelectorAll('.w').forEach(span => span.addEventListener('click', () => showWord(span.dataset.w, it)));
  $('#aiExplain')?.addEventListener('click', async e => {
    e.target.disabled = true;
    $('#aiOut').innerHTML = '<p class="muted small">生成中…</p>';
    try {
      const { explainNews } = await import('./ai.js');
      const r = await explainNews(it);
      $('#aiOut').innerHTML = `<p>${esc(r.summary_ja)}</p>
        <div class="chips">${r.vocab.map(v => `<span class="chip">${esc(v.word)}: ${esc(v.meaning)}</span>`).join('')}</div>
        ${r.questions.map((q, qi) => `<div class="setq" data-qi="${qi}"><div class="q-text"><b>Q${qi + 1}.</b> ${esc(q.q)}</div>${optionButtons(q.options, q.options.map((_, i) => i))}</div>`).join('')}`;
      $('#aiOut').querySelectorAll('.setq').forEach(div => grade(div, r.questions[+div.dataset.qi].answer, () => div.insertAdjacentHTML('beforeend', explBox(r.questions[+div.dataset.qi].expl))));
    } catch (err) { $('#aiOut').innerHTML = `<p class="warn small">${esc(err.message)}</p>`; e.target.disabled = false; }
  });
}

async function showWord(w, article) {
  const pop = $('#wordpop');
  const v = lookupVocab(w);
  pop.classList.remove('hidden-block');
  pop.innerHTML = `<div class="row-between"><b>${esc(w)}</b><button class="btn sm" id="sayW">🔊</button></div>
    ${v ? `<div>[${esc(v.pos)}] ${esc(v.ja)}</div><div class="small muted">${esc(v.ex)}</div>` : '<div class="small muted" id="def">辞書を検索中…</div>'}
    <div class="btn-row"><input id="note" placeholder="意味・メモ" value="${v ? esc(v.ja) : ''}"><button class="btn sm primary" id="saveW">単語帳に保存</button>
    <a class="btn sm" target="_blank" rel="noopener" href="https://ejje.weblio.jp/content/${encodeURIComponent(w.toLowerCase())}">Weblio ↗</a></div>`;
  $('#sayW').addEventListener('click', () => speak(w));
  $('#saveW').addEventListener('click', () => {
    S().myWords.push({ word: w.toLowerCase(), note: $('#note').value, ts: Date.now(), source: article.title });
    save();
    $('#saveW').textContent = '✔ 保存しました'; $('#saveW').disabled = true;
  });
  if (!v) {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w.toLowerCase())}`);
      const j = await res.json();
      const m = j[0]?.meanings?.[0];
      $('#def') && ($('#def').textContent = m ? `(${m.partOfSpeech}) ${m.definitions[0].definition}` : '見つかりませんでした');
    } catch { $('#def') && ($('#def').textContent = '辞書を取得できませんでした'); }
  }
}

// ---------- 記録 ----------
function renderHistory() {
  const st = S();
  const days = [...new Set(st.answers.map(a => today(new Date(a.ts))))].sort();
  // 日ごとの予想スコア推移（その日までの解答で再計算）
  const trend = days.map(d => {
    const end = new Date(d + 'T23:59:59').getTime();
    const p = predict({ ...st, answers: st.answers.filter(a => a.ts <= end) });
    return { d, total: p.total };
  });
  const last14 = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); last14.push(today(d)); }
  const tags = weakTags();
  view().innerHTML = `
  <section class="card"><h2>予想スコアの推移</h2>${trend.length > 1 ? lineChart(trend, st.settings.targetScore) : '<p class="muted small">2日以上解くと推移グラフが表示されます。</p>'}</section>
  <section class="card"><h2>学習カレンダー（14日）</h2>
    <div class="cal">${last14.map(d => {
      const n = st.answers.filter(a => today(new Date(a.ts)) === d).length;
      const full = dayComplete(d);
      return `<div class="cal-day ${full ? 'full' : n ? 'some' : ''}" title="${d}: ${n}問"><span>${d.slice(8)}</span><small>${n || ''}</small></div>`;
    }).join('')}</div>
    <p class="small muted">濃い色 = スケジュール全達成、薄い色 = 一部学習。数字は解答数。</p></section>
  <section class="card"><h2>弱点カテゴリ</h2>
    ${tags.length ? `<table class="tbl"><tr><th>カテゴリ</th><th>Part</th><th>正答率</th><th>解答数</th></tr>${tags.slice(0, 12).map(t => `<tr><td>${esc(t.tag)}</td><td>${t.part}</td><td>${pct(t.rate)}</td><td>${t.n}</td></tr>`).join('')}</table>` : '<p class="muted small">各カテゴリ2問以上解くと表示されます。</p>'}
  </section>
  <section class="card"><h2>ミニ模試の履歴</h2>
    ${st.mocks.length ? `<table class="tbl"><tr><th>日付</th><th>L</th><th>R</th><th>合計</th></tr>${st.mocks.slice().reverse().map(m => `<tr><td>${new Date(m.ts).toLocaleDateString('ja-JP')}</td><td>${m.listening}</td><td>${m.reading}</td><td><b>${m.total}</b></td></tr>`).join('')}</table>` : '<p class="muted small">まだ受けていません。</p>'}
  </section>
  <section class="card"><h2>最近の解答</h2>
    <ul class="log">${st.answers.slice(-30).reverse().map(a => `<li>${a.correct ? '⭕' : '❌'} Part ${a.part} <span class="muted small">${esc(a.tag)} · ${new Date(a.ts).toLocaleString('ja-JP')}</span></li>`).join('') || '<li class="muted">まだ解答がありません</li>'}</ul>
  </section>`;
}

function lineChart(points, target) {
  const W = 320, H = 140, pad = 28;
  const ys = points.map(p => p.total).concat(target);
  const min = Math.max(10, Math.floor((Math.min(...ys) - 50) / 50) * 50), max = Math.min(990, Math.ceil((Math.max(...ys) + 20) / 50) * 50);
  const x = i => pad + (W - pad * 2) * (points.length === 1 ? 0.5 : i / (points.length - 1));
  const y = v => H - pad + 8 - (H - pad) * (v - min) / (max - min || 1);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="予想スコア推移">
    <line x1="${pad}" x2="${W - pad}" y1="${y(target)}" y2="${y(target)}" class="target"/>
    <text x="${W - pad}" y="${y(target) - 4}" text-anchor="end" class="lbl">目標 ${target}</text>
    <text x="2" y="${y(max) + 4}" class="lbl">${max}</text><text x="2" y="${y(min)}" class="lbl">${min}</text>
    <path d="${path}" class="line"/>
    ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.total)}" r="3" class="dot"><title>${p.d}: ${p.total}</title></circle>`).join('')}
    <text x="${pad}" y="${H - 2}" class="lbl">${points[0].d.slice(5)}</text><text x="${W - pad}" y="${H - 2}" text-anchor="end" class="lbl">${points[points.length - 1].d.slice(5)}</text>
  </svg>`;
}

// ---------- 設定 ----------
function renderSettings() {
  const s = S().settings;
  view().innerHTML = `
  <section class="card"><h2>目標と現在の実力</h2>
    <div class="form">
      <label>現在のスコア（自己申告・最新の公式スコア）<input type="number" id="cur" min="10" max="990" step="5" value="${s.currentScore}"></label>
      <label>目標スコア<input type="number" id="tgt" min="10" max="990" step="5" value="${s.targetScore}"></label>
      <label>次の試験日<input type="date" id="exam" value="${esc(s.examDate)}"></label>
      <label>音声の速さ <input type="range" id="rate" min="0.6" max="1.4" step="0.05" value="${s.speechRate}"> <span id="rateV">${s.speechRate}x</span></label>
      <label>Part 5 の目標秒数/問<input type="number" id="p5t" min="5" max="60" value="${s.p5TimeLimit}"></label>
    </div>
    <p class="small muted">現在のスコアは、解答数が少ない間の予想スコアの初期値として使われます。解くほど実際の解答データが優先されます。</p>
  </section>
  <section class="card"><h2>毎日のスケジュール</h2>
    <p class="small muted">普段のスケジュールに合わせて自由に編集してください。「種類」に応じて、アプリ内で解いた量が自動でカウントされます。</p>
    <div id="sched"></div>
    <div class="btn-row"><button class="btn" id="addTask">＋ 項目を追加</button><button class="btn" id="resetSched">初期設定に戻す</button></div>
  </section>
  <section class="card"><h2>AI問題生成（任意）</h2>
    <div class="form">
      <label>使用するAI
        <select id="prov">
          <option value="none" ${s.aiProvider === 'none' || (!s.aiProvider && !s.apiKey) ? 'selected' : ''}>使わない</option>
          <option value="anthropic" ${s.aiProvider === 'anthropic' || (!s.aiProvider && s.apiKey) ? 'selected' : ''}>Claude（Anthropic）</option>
          <option value="openai" ${s.aiProvider === 'openai' ? 'selected' : ''}>OpenAI（ChatGPT）</option>
        </select></label>
      <div id="provAnthropic" class="form">
        <label>Anthropic API キー<input type="password" id="key" value="${esc(s.apiKey)}" placeholder="sk-ant-..." autocomplete="off"></label>
        <label>モデル<select id="claudeModel">${CLAUDE_MODELS.map(m => `<option value="${m.id}" ${s.claudeModel === m.id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></label>
      </div>
      <div id="provOpenAI" class="form">
        <label>OpenAI API キー<input type="password" id="okey" value="${esc(s.openaiKey)}" placeholder="sk-..." autocomplete="off"></label>
        <label>モデル（一覧から選択、または直接入力）
          <input id="omodel" list="omodels" value="${esc(s.openaiModel)}" autocomplete="off">
          <datalist id="omodels">${OPENAI_SUGGESTED.map(m => `<option value="${m}">`).join('')}</datalist></label>
        <div class="btn-row"><button class="btn sm" id="fetchModels">このキーで使えるモデル一覧を取得</button><span id="modelsStatus" class="small muted"></span></div>
        <p class="small muted">目安：gpt-5-mini は安価で十分な品質、gpt-5 は高品質（料金高め）、nano 系は最安。</p>
      </div>
    </div>
    <p class="small muted">キーはこの端末のブラウザ内にのみ保存され、選んだ会社の API への直接リクエストにだけ使われます。共有端末では入力しないでください。利用料金は各社 API の従量課金です（ChatGPT や Claude の月額サブスクとは別）。</p>
  </section>
  <section class="card"><h2>データ</h2>
    <p class="small muted">学習データはこのブラウザに保存されています。機種変更や別端末で使うときはバックアップを書き出してください。</p>
    <div class="btn-row"><button class="btn" id="exp">バックアップを書き出す</button><label class="btn">読み込む<input type="file" id="imp" accept="application/json" hidden></label><button class="btn danger" id="reset">全データを削除</button></div>
  </section>
  <div class="btn-row center"><button class="btn primary" id="saveS">保存</button></div>`;

  const schedEl = $('#sched');
  let sched = S().schedule.map(t => ({ ...t }));
  const kinds = { vocab: '単語', part: 'パート指定', listening: 'リスニング(P1-4)', review: '復習', news: 'ニュース', manual: '手動チェック' };
  const drawSched = () => {
    schedEl.innerHTML = sched.map((t, i) => `<div class="sched-row" data-i="${i}">
      <input class="s-label" value="${esc(t.label)}">
      <select class="s-kind">${Object.entries(kinds).map(([k, v]) => `<option value="${k}" ${t.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select class="s-part" ${t.kind === 'part' ? '' : 'hidden'}>${[1, 2, 3, 4, 5, 6, 7].map(p => `<option ${t.part === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
      <input class="s-target" type="number" min="1" value="${t.target}"><input class="s-unit" value="${esc(t.unit)}">
      <button class="btn sm" data-rm="${i}">✕</button></div>`).join('');
    schedEl.querySelectorAll('.s-kind').forEach(sel => sel.addEventListener('change', () => { collect(); drawSched(); }));
    schedEl.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { collect(); sched.splice(+b.dataset.rm, 1); drawSched(); }));
  };
  const collect = () => {
    sched = [...schedEl.querySelectorAll('.sched-row')].map((row, i) => ({
      id: sched[i].id, label: $('.s-label', row).value, kind: $('.s-kind', row).value,
      part: +$('.s-part', row).value, target: +$('.s-target', row).value || 1, unit: $('.s-unit', row).value,
    }));
  };
  drawSched();
  $('#addTask').addEventListener('click', () => { collect(); sched.push({ id: 't' + Date.now().toString(36), label: '新しい項目', kind: 'manual', target: 1, unit: '回' }); drawSched(); });
  $('#resetSched').addEventListener('click', () => { sched = DEFAULT_SCHEDULE.map(t => ({ ...t })); drawSched(); });
  const showProv = () => {
    $('#provAnthropic').classList.toggle('hidden-block', $('#prov').value !== 'anthropic');
    $('#provOpenAI').classList.toggle('hidden-block', $('#prov').value !== 'openai');
  };
  $('#prov').addEventListener('change', showProv);
  showProv();
  $('#fetchModels').addEventListener('click', async () => {
    const key = $('#okey').value.trim();
    if (!key) { $('#modelsStatus').textContent = '先にキーを入力してください'; return; }
    $('#modelsStatus').textContent = '取得中…';
    try {
      const { listOpenAIModels } = await import('./ai.js');
      const ids = await listOpenAIModels(key);
      $('#omodels').innerHTML = ids.map(m => `<option value="${esc(m)}">`).join('');
      $('#modelsStatus').textContent = `${ids.length}件取得しました。モデル欄をタップして選択できます。`;
    } catch (e) { $('#modelsStatus').textContent = e.message; }
  });
  $('#rate').addEventListener('input', e => { $('#rateV').textContent = e.target.value + 'x'; });
  $('#saveS').addEventListener('click', () => {
    collect();
    Object.assign(s, {
      currentScore: +$('#cur').value || 600, targetScore: +$('#tgt').value || 900, examDate: $('#exam').value,
      speechRate: +$('#rate').value, p5TimeLimit: +$('#p5t').value || 20, apiKey: $('#key').value.trim(),
      aiProvider: $('#prov').value, claudeModel: $('#claudeModel').value,
      openaiKey: $('#okey').value.trim(), openaiModel: $('#omodel').value.trim() || 'gpt-5-mini',
    });
    S().schedule = sched;
    save();
    toast('保存しました');
  });
  $('#exp').addEventListener('click', () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `toeic900-backup-${today()}.json`;
    a.click();
  });
  $('#imp').addEventListener('change', async e => {
    try { importJSON(await e.target.files[0].text()); toast('読み込みました'); renderSettings(); }
    catch (err) { alert('読み込みに失敗しました: ' + err.message); }
  });
  $('#reset').addEventListener('click', () => {
    if (confirm('解答履歴・単語・設定をすべて削除します。よろしいですか？')) { resetAll(); toast('削除しました'); renderSettings(); }
  });
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

// ---------- 起動 ----------
router();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
