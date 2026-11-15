import { getState, save, logActivity, exportData, importData, resetAll, streak } from './store.js';
import { SimPlayer } from './sim.js';
import { CODEX_SCENARIOS } from '../data/scen-codex.js';
import { CODEX_CLI_MORE } from '../data/scen-codex-cli2.js';
import { CLAUDE_APP_SCENARIOS } from '../data/scen-claude-app.js';
import { CODEX_APP_SCENARIOS } from '../data/scen-codex-app.js';
import { ADVANCED_SCENARIOS } from '../data/scen-advanced.js';
import { GUIDES } from '../data/guides.js';
import { COMMANDS } from '../data/commands.js';
import { REFERENCE, COMPARE } from '../data/reference.js';
import { DAYS_0 } from '../data/py-days-0.js';
import { DAYS_1 } from '../data/py-days-1.js';
import { DAYS_2 } from '../data/py-days-2.js';
import { ROADMAP } from '../data/py-roadmap.js';
import { createEditor, runPython, runTests, renderOutput, errorHint, warmup, onPyStatus } from './py.js';
import * as AI from './ai.js';
import { renderLive } from './live.js';
import { esc, md, toast } from './util.js';

const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
// ターミナル版は Codex CLI のみ（学習順に並べる）
const CLI_ORDER = ['cx-setup', 'cx-start', 'cx-tui', 'cx-approvals', 'cx-perm2', 'cx-fix', 'cx-review', 'cx-workspace', 'cx-chats', 'cx-session', 'cx-plan-goal', 'cx-config', 'cx-models', 'cx-ext', 'cx-agents', 'cx-custom', 'cx-exec', 'cx-exec2', 'cx-cloud', 'cx-cloudcli'];
const CODEX_CLI = [...CODEX_SCENARIOS, ...CODEX_CLI_MORE].sort((a, b) => CLI_ORDER.indexOf(a.id) - CLI_ORDER.indexOf(b.id));
export const SCENARIOS = [...CLAUDE_APP_SCENARIOS, ...CODEX_APP_SCENARIOS, ...ADVANCED_SCENARIOS, ...CODEX_CLI];
const SURFACE = { 'claude-desktop': 'デスクトップアプリ', 'claude-mobile': 'スマホアプリ', 'codex-vscode': 'VS Code', 'codex-app': 'Codex アプリ', '': 'ターミナル' };
const groupOf = s => s.adv ? 'adv' : s.ui ? s.tool : 'cli';
const toolName = s => s.tool === 'claude' ? 'Claude Code' : 'Codex';
const DAYS = [...DAYS_0, ...DAYS_1, ...DAYS_2];

// ---------- ルーター ----------
let current = null;
function route() {
  if (current && current.destroy) current.destroy();
  current = null;
  const hash = location.hash || '#/home';
  const [, name, arg] = hash.match(/^#\/(\w+)\/?(.*)$/) || [, 'home', ''];
  document.querySelectorAll('.tabbar a').forEach(a => {
    const r = a.dataset.route;
    a.classList.toggle('active', r === name || (r === 'lab' && ['sim', 'live'].includes(name)) || (r === 'python' && ['day', 'play'].includes(name)) || (r === 'ref' && ['refquiz', 'cmds'].includes(name)));
  });
  window.scrollTo(0, 0);
  const views = { home, lab, sim, live, python, day, play, ref, refquiz, settings, cmds };
  (views[name] || home)(decodeURIComponent(arg));
}
window.addEventListener('hashchange', route);

// ---------- ホーム ----------
function nextPythonDay() {
  const st = getState();
  const start = st.settings.startDay || 1;
  for (let d = start; d <= 100; d++) if (!st.days[d]?.done) return d;
  return 100;
}
// AI の利用状況（このアプリ内での利用記録から集計）
function aiUsageCard() {
  const st = getState();
  const usage = st.aiUsage || [];
  if (!AI.hasKey() && !usage.length) return '';
  const ym = d => `${d.getFullYear()}-${d.getMonth() + 1}`;   // 端末の現地時間で月を判定
  const month = ym(new Date());
  const all = AI.usageSummary(usage);
  const mon = AI.usageSummary(usage.filter(u => ym(new Date(u.ts)) === month));
  const k = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : String(v);
  const money = v => `$${v.toFixed(v < 1 ? 3 : 2)}（約${Math.round(v * 150).toLocaleString()}円）`;
  const costTxt = x => x.n === 0 ? '—' : x.usd == null ? '単価未設定' : money(x.usd);
  return `<div class="card">
    <div class="row-between"><h2 style="margin:0">AIの利用状況</h2><span class="pill">${AI.hasKey() ? 'OpenAI：' + esc(AI.currentModel()) : 'AI未設定'}</span></div>
    <table class="cmp" style="margin-top:6px">
      <tr><th></th><th>回数</th><th>トークン<br><small>入力/出力</small></th><th>推定金額</th></tr>
      <tr><td>今月</td><td>${mon.n}</td><td>${k(mon.in)} / ${k(mon.out)}</td><td>${costTxt(mon)}</td></tr>
      <tr><td>累計</td><td>${all.n}</td><td>${k(all.in)} / ${k(all.out)}</td><td>${costTxt(all)}</td></tr>
    </table>
    <p class="small muted" style="margin-bottom:0">このアプリで使った分の記録です（1ドル=150円で概算）。${st.settings.openaiPriceIn === '' || st.settings.openaiPriceIn == null ? '金額を出すには「設定」でモデルの単価を入力してください。' : ''}
    残高・正確な請求額は <a href="https://platform.openai.com/usage" target="_blank" rel="noopener">OpenAI の利用状況ページ ↗</a> で確認できます。</p>
  </div>`;
}

function home() {
  const st = getState();
  const simDone = SCENARIOS.filter(s => st.sims[s.id]?.done).length;
  const nextSim = SCENARIOS.find(s => s.ui && !st.sims[s.id]?.done) || SCENARIOS.find(s => !st.sims[s.id]?.done);
  const start = st.settings.startDay || 1;
  const daysDone = Array.from({ length: 100 }, (_, i) => i + 1).filter(d => d < start || st.days[d]?.done).length;
  const nd = nextPythonDay();
  const ndInfo = DAYS.find(d => d.day === nd) || ROADMAP.find(d => d.day === nd);
  view.innerHTML = `
    <div class="card">
      <div class="row-between"><h1>AI Code Dojo</h1><span class="pill">🔥 連続 ${streak()} 日</span></div>
      <p class="small muted" style="margin:0 0 10px">Claude Code（デスクトップ／スマホアプリ）と Codex（VS Code／Codex アプリ）の使い方を疑似体験。Python も100日カリキュラムで実際にコードを書いて学べます。</p>
      <div class="stat">
        <div><span class="small muted">AIラボ</span><b>${simDone}<small class="small muted"> / ${SCENARIOS.length}</small></b><span class="tiny muted">シナリオ完了</span></div>
        <div><span class="small muted">Python</span><b>${daysDone}<small class="small muted"> / 100</small></b><span class="tiny muted">日 修了</span></div>
      </div>
    </div>
    <a class="card" href="#/day/${nd}" style="border-left:4px solid var(--accent)">
      <div class="small muted">🐍 Python の続き</div>
      <div><b>Day ${nd}</b>：${esc(ndInfo?.title || '')}</div>
      <div class="small muted">${esc(ndInfo?.goal || ndInfo?.topics || '')}</div>
    </a>
    ${nextSim ? `<a class="card" href="#/sim/${nextSim.id}" style="border-left:4px solid var(--primary)">
      <div class="small muted">🤖 次のおすすめシナリオ</div>
      <div><span class="pill ${nextSim.tool}">${toolName(nextSim)} · ${SURFACE[nextSim.ui || '']}</span> <b>${esc(nextSim.title)}</b></div>
      <div class="small muted">${esc(nextSim.summary)}</div>
    </a>` : '<div class="card">🎉 すべてのシナリオを完了しました！ 次は「本物のAIで体験」に挑戦しよう。</div>'}
    ${aiUsageCard()}
    <div class="grid2">
      <a class="tile" href="#/live"><div class="t">⚡ 本物のAIで体験</div><div class="small muted">OpenAI の API キーを設定すると、AI が実際にファイルを読み書き・テスト実行するエージェント体験ができます</div></a>
      <a class="tile" href="#/lab/adv"><div class="t">⭐ 上級機能・使い方ガイド</div><div class="small muted">/goal・/loop・スケジュール・コンピューター操作・プラグイン・スキル・コネクタ・Dispatch</div></a>
      <a class="tile" href="#/cmds"><div class="t">⌨️ スラッシュコマンド大全</div><div class="small muted">Claude Code・Codex の / コマンドを全部、使い方つきで。入力練習も</div></a>
      <a class="tile" href="#/refquiz"><div class="t">🎯 コマンド早押しクイズ</div><div class="small muted">スラッシュコマンド・ショートカットを覚えよう</div></a>
      <a class="tile" href="#/play"><div class="t">📝 Python 練習帳</div><div class="small muted">自由にコードを書いて実行</div></a>
      <a class="tile" href="#/ref"><div class="t">📖 機能辞典</div><div class="small muted">Claude Code / Codex の全コマンド・設定・比較表</div></a>
    </div>`;
}

// ---------- AIラボ ----------
function lab(arg) {
  const st = getState();
  const tab = arg || sessionTab('lab', 'claude');
  const list = (group, ui) => SCENARIOS.filter(s => groupOf(s) === group && (ui == null || (s.ui || '') === ui || ((group === 'cli' || group === 'adv') && s.tool === ui))).map(s => {
    const r = st.sims[s.id];
    return `<a class="tile ${s.tool} ${r?.done ? 'done' : ''}" href="#/sim/${s.id}">
      <div class="row-between"><span class="pill">${s.level}${group === 'cli' ? ' · ' + toolName(s) : ''}</span>${r?.done ? `<span class="pill done">✓ ${r.total ? `${r.score}/${r.total}` : '完了'}</span>` : ''}</div>
      <div class="t" style="margin-top:4px">${esc(s.title)}</div><div class="small muted">${esc(s.summary)}</div></a>`;
  }).join('');
  view.innerHTML = `
    <div class="chips" style="margin-bottom:10px">
      <a class="chip ${tab === 'claude' ? 'on' : ''}" href="#/lab/claude">Claude Code</a>
      <a class="chip ${tab === 'codex' ? 'on' : ''}" href="#/lab/codex">Codex</a>
      <a class="chip ${tab === 'adv' ? 'on' : ''}" href="#/lab/adv">⭐ 上級機能・使い方</a>
      <a class="chip ${tab === 'compare' ? 'on' : ''}" href="#/lab/compare">比較・使い分け</a>
      <a class="chip ${tab === 'cli' ? 'on' : ''}" href="#/lab/cli">Codex CLI（ターミナル）</a>
      <a class="chip" href="#/live">⚡ 本物のAI</a>
    </div>
    <div id="labbody"></div>`;
  sessionTab('lab', tab, true);
  const body = $('#labbody');
  if (tab === 'compare') {
    body.innerHTML = `<div class="card"><h2>Claude Code と Codex の対応表</h2>
      <table class="cmp"><tr><th></th><th>Claude Code</th><th>Codex</th></tr>${COMPARE.map(r => `<tr><td><b>${esc(r[0])}</b></td><td class="mono">${esc(r[1])}</td><td class="mono">${esc(r[2])}</td></tr>`).join('')}</table></div>
      <div class="card"><h2>どんな場面で何を使う？（ユースケース集）</h2>${md(USECASES)}</div>`;
    return;
  }
  const note = '<p class="tiny muted">画面は公式ドキュメント等を元にした再現です。ボタンの文言や配置はバージョンによって異なります。</p>';
  if (tab === 'claude') body.innerHTML = `<p class="small muted">Anthropic の Claude Code を、<b>Claude デスクトップアプリ（Code タブ）</b>と<b>スマホの Claude アプリ</b>から使う想定です。</p>${note}
    <h3>🖥 デスクトップアプリ</h3><div class="grid2">${list('claude', 'claude-desktop')}</div>
    <h3>📱 スマホアプリ（クラウド・Remote Control）</h3><div class="grid2">${list('claude', 'claude-mobile')}</div>`;
  else if (tab === 'codex') body.innerHTML = `<p class="small muted">OpenAI の Codex を、<b>VS Code の拡張機能</b>と<b>Codex デスクトップアプリ</b>で使う想定です。</p>${note}
    <h3>🧩 VS Code 拡張</h3><div class="grid2">${list('codex', 'codex-vscode')}</div>
    <h3>🖥 Codex アプリ</h3><div class="grid2">${list('codex', 'codex-app')}</div>`;
  else if (tab === 'adv') {
    const guideHtml = tool => GUIDES.filter(g => g.tool === tool).map(g => `<details class="card guide"><summary><b>${esc(g.name)}</b><div class="small muted">${esc(g.what)}</div></summary>
      <div class="lesson"><h3>使いどころ</h3><p>${esc(g.when)}</p>
      <h3>使い方</h3><ol>${g.steps.map(x => `<li>${md(x).replace(/^<p>|<\/p>$/g, '')}</li>`).join('')}</ol>
      ${g.examples?.length ? `<h3>例</h3><ul>${g.examples.map(x => `<li>${md(x).replace(/^<p>|<\/p>$/g, '')}</li>`).join('')}</ul>` : ''}
      ${g.tips?.length ? `<h3>注意・コツ</h3><ul>${g.tips.map(x => `<li>${md(x).replace(/^<p>|<\/p>$/g, '')}</li>`).join('')}</ul>` : ''}
      ${g.scenario ? `<a class="btn primary sm" href="#/sim/${g.scenario}">▶ シナリオで体験</a>` : ''}</div></details>`).join('');
    body.innerHTML = `<p class="small muted">/goal・/loop・スケジュール・コンピューター操作・プラグイン・スキル・コネクタ・Dispatch など、上級機能の<b>使い方ガイド</b>と<b>体験シナリオ</b>です。ガイドをタップすると手順が開きます。</p>${note}
      <h3>🧡 Claude Code の上級機能</h3><div class="grid2">${list('adv', 'claude')}</div>
      <h3>使い方ガイド（Claude Code）</h3>${guideHtml('claude')}
      <h3>💙 Codex の上級機能</h3><div class="grid2">${list('adv', 'codex')}</div>
      <h3>使い方ガイド（Codex）</h3>${guideHtml('codex')}`;
  }
  else body.innerHTML = `<p class="small muted"><b>Codex CLI</b>（ターミナル版）のシナリオ ${CODEX_CLI.length} 本です。インストールから TUI の操作、権限、会話の管理、拡張、自動化、クラウドまで、上から順に進めると一通り身につきます。設定ファイル（AGENTS.md・config.toml）やスキル・MCP は VS Code 拡張・Codex アプリと共通です。</p>${note}
    <div class="grid2">${list('cli', 'codex')}</div>
    <p class="small"><a href="#/cmds/codex">⌨️ Codex の全コマンド一覧（コマンド大全）</a></p>`;
}
function sessionTab(key, def, set) {
  try { if (set) sessionStorage.setItem('tab:' + key, def); return sessionStorage.getItem('tab:' + key) || def; } catch { return def; }
}

const USECASES = `### 毎日の開発
- **バグ修正**：エラー全文と再現手順を渡し、テストで検証させる（→シナリオ「バグ修正の基本フロー」）
- **機能追加**：大きいものはプランモードで計画 → 承認 → 実装
- **テストを書く**：「この関数のテストを書いて。境界値も」→ TDD なら先にテスト
- **リファクタリング**：特性テストで挙動を固定してから小さく分割
- **コードレビュー**：/review、サブエージェント、GitHub の @claude / @codex review
### 調査・理解
- 知らないリポジトリの全体像・処理の流れを説明させる
- 「この関数はどこから呼ばれている？」「なぜこの実装？」（git log / blame も使える）
- エラーログ・スクリーンショットから原因を推測させる
### 自動化
- \`claude -p\` / \`codex exec\` をスクリプトや CI に組み込む（リリースノート作成、依存関係の更新、Issue の仕分け）
- フックで編集後の自動フォーマット・危険コマンドのブロック
- カスタムコマンド・スキルで定型作業を1コマンドに
### 並列・リモート
- git worktree で複数のエージェントを同時に
- クラウド（claude.ai/code・Codex Cloud）に任せて、スマホから進捗確認・PR レビュー
### 使い分けのヒント
- **ローカル CLI**：手元の環境で細かく確認しながら進めたいとき
- **クラウド**：明確なタスクを並列で任せたいとき、PC を開けないとき
- **IDE 拡張**：エディタで見ながら差分を確認したいとき
- どちらのツールも考え方はほぼ同じ。**説明書（CLAUDE.md / AGENTS.md）・権限・検証手段（テスト）**を整えるほど賢く動く`;

function sim(id) {
  const sc = SCENARIOS.find(s => s.id === id);
  if (!sc) return lab();
  const same = SCENARIOS.filter(s => groupOf(s) === groupOf(sc) && (groupOf(sc) !== 'cli' || s.tool === sc.tool));
  const next = same[same.indexOf(sc) + 1];
  view.innerHTML = `
    <div class="row-between" style="margin-bottom:8px">
      <a href="#/lab/${groupOf(sc)}" class="small">← 一覧</a>
      <span class="pill ${sc.tool}">${toolName(sc)} · ${SURFACE[sc.ui || '']} · ${sc.level}</span>
    </div>
    <h1>${esc(sc.title)}</h1>
    <p class="small muted" style="margin-top:0">${esc(sc.summary)}</p>
    <div id="simroot"></div>`;
  const p = new SimPlayer($('#simroot'), sc, { onFinish: next ? () => { location.hash = '#/sim/' + next.id; } : null });
  current = { destroy: () => p.destroy() };
}

function live(arg) {
  current = renderLive(view, arg);
}

// ---------- 辞典 ----------
function ref(arg) {
  const tab = arg || sessionTab('ref', 'claude');
  sessionTab('ref', tab, true);
  view.innerHTML = `
    <div class="chips" style="margin-bottom:8px">
      <a class="chip ${tab === 'claude' ? 'on' : ''}" href="#/ref/claude">Claude Code</a>
      <a class="chip ${tab === 'codex' ? 'on' : ''}" href="#/ref/codex">Codex</a>
      <a class="chip" href="#/lab/compare">比較表</a>
      <a class="chip" href="#/cmds/${tab}">⌨️ コマンド大全</a>
      <a class="chip" href="#/refquiz/${tab}">🎯 クイズ</a>
    </div>
    <input id="q" placeholder="検索（例: compact, 権限, 再開）" style="width:100%;margin-bottom:10px">
    <div id="refbody"></div>
    <p class="tiny muted">公式ドキュメント: <a href="https://code.claude.com/docs" target="_blank" rel="noopener">Claude Code</a> / <a href="https://developers.openai.com/codex" target="_blank" rel="noopener">Codex</a>（機能は頻繁に更新されます）</p>`;
  const render = () => {
    const q = $('#q').value.trim().toLowerCase();
    $('#refbody').innerHTML = REFERENCE[tab].map(c => {
      const items = c.items.filter(it => !q || (it.k + it.d + (it.ex || '')).toLowerCase().includes(q));
      if (!items.length) return '';
      return `<div class="card"><h2>${esc(c.cat)}</h2>${items.map(it => `<div class="ref-item"><div class="k">${esc(it.k)}</div><div class="d">${esc(it.d)}</div>${it.ex ? `<div class="ex">${esc(it.ex)}</div>` : ''}</div>`).join('')}</div>`;
    }).join('') || '<p class="muted">見つかりませんでした</p>';
  };
  $('#q').oninput = render;
  render();
}

function refquiz(arg) {
  const tool = arg === 'codex' ? 'codex' : arg === 'claude' ? 'claude' : 'mix';
  const pool = [];
  for (const t of tool === 'mix' ? ['claude', 'codex'] : [tool])
    for (const c of [...REFERENCE[t], ...COMMANDS[t]]) for (const it of c.items) if (!/廃止/.test(c.cat)) pool.push({ ...it, tool: t, cat: c.cat });
  let score = 0, n = 0;
  const TOTAL = 10;
  view.innerHTML = `<div class="row-between"><h1>🎯 コマンドクイズ</h1><span class="pill" id="sc"></span></div>
    <div class="chips"><a class="chip ${tool === 'mix' ? 'on' : ''}" href="#/refquiz/mix">ミックス</a><a class="chip ${tool === 'claude' ? 'on' : ''}" href="#/refquiz/claude">Claude Code</a><a class="chip ${tool === 'codex' ? 'on' : ''}" href="#/refquiz/codex">Codex</a></div>
    <div id="qz" class="panel"></div>`;
  const ask = () => {
    $('#sc').textContent = `${score} / ${n}`;
    if (n >= TOTAL) {
      $('#qz').innerHTML = `<div class="q">結果: ${score} / ${TOTAL}</div><p class="small">${score >= 8 ? 'すばらしい！ 実戦でも使いこなせそうです。' : 'シナリオで実際の場面を体験すると覚えやすくなります。'}</p><div class="btn-row"><a class="btn primary" href="#/refquiz/${tool}" onclick="setTimeout(()=>location.reload(),0)">もう一度</a><a class="btn" href="#/lab">シナリオへ</a></div>`;
      logActivity('quiz', tool);
      return;
    }
    const ans = pool[Math.floor(Math.random() * pool.length)];
    const same = pool.filter(p => p.cat === ans.cat && p.k !== ans.k);
    const others = shuffle(same.length >= 3 ? same : pool.filter(p => p.k !== ans.k)).slice(0, 3);
    const opts = shuffle([ans, ...others]);
    $('#qz').innerHTML = `<div class="small muted">${ans.tool === 'claude' ? 'Claude Code' : 'Codex'} · ${esc(ans.cat)}</div>
      <div class="q">${esc(ans.d)}</div><div class="opts">${opts.map((o, k) => `<button class="opt mono" data-k="${k}">${esc(o.k)}</button>`).join('')}</div><div id="fb"></div>`;
    $('#qz').querySelectorAll('.opt').forEach(b => b.onclick = () => {
      const o = opts[+b.dataset.k];
      const ok = o.k === ans.k;
      n++; if (ok) score++;
      $('#qz').querySelectorAll('.opt').forEach((x, k) => { x.disabled = true; if (opts[k].k === ans.k) x.classList.add('correct'); });
      if (!ok) b.classList.add('wrong');
      $('#fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'ng'}">${ok ? '⭕ 正解' : '❌ 正解は ' + esc(ans.k)}${ans.ex ? `<div class="tiny mono">${esc(ans.ex)}</div>` : ''}</div><button class="btn primary block" id="nx" style="margin-top:8px">次へ</button>`;
      $('#nx').onclick = ask;
    });
  };
  ask();
}
function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- スラッシュコマンド大全 ----------
function cmds(arg) {
  const tool = arg === 'codex' ? 'codex' : 'claude';
  view.innerHTML = `
    <div class="row-between"><h1>⌨️ コマンド大全</h1><a class="small" href="#/ref/${tool}">← 辞典</a></div>
    <div class="chips" style="margin-bottom:8px">
      <a class="chip ${tool === 'claude' ? 'on' : ''}" href="#/cmds/claude">Claude Code</a>
      <a class="chip ${tool === 'codex' ? 'on' : ''}" href="#/cmds/codex">Codex</a>
      <button class="chip" id="practice">✍️ 入力練習</button>
    </div>
    <p class="small muted" style="margin-top:0">${tool === 'claude' ? 'Claude Code の / コマンドの全一覧（公式ドキュメント 2026年11月時点）。デスクトップ・スマホ（Remote Control／クラウド）でも多くが使えます。🧩 は Claude が自動で使うこともある「スキル」。' : 'Codex の / コマンドの全一覧（Codex CLI 0.166 時点のまとめ）。多くは IDE 拡張・Codex アプリでも共通です。'} 入力欄に <code>/</code> と打つと候補が出ます。</p>
    <input id="q" placeholder="検索（例: goal, 巻き戻し, plugin）" style="width:100%;margin-bottom:10px">
    <div id="pr"></div><div id="cbody"></div>`;
  const render = () => {
    const q = $('#q').value.trim().toLowerCase();
    $('#cbody').innerHTML = COMMANDS[tool].map(c => {
      const items = c.items.filter(it => !q || (it.k + it.d + (it.ex || '') + (it.u || '')).toLowerCase().includes(q));
      if (!items.length) return '';
      return `<div class="card"><h2>${esc(c.cat)} <span class="pill">${items.length}</span></h2>${items.map(it => `<div class="ref-item"><div class="k">${esc(it.k)}${it.sk ? ' <span class="pill" title="スキル">🧩</span>' : ''}</div><div class="d">${esc(it.d)}</div>${it.ex ? `<div class="ex">例: ${esc(it.ex)}</div>` : ''}${it.u ? `<div class="small muted">💡 ${esc(it.u)}</div>` : ''}</div>`).join('')}</div>`;
    }).join('') || '<p class="muted">見つかりませんでした</p>';
  };
  $('#q').oninput = render;
  render();
  // 入力練習：説明を見てコマンドを打つ
  const pool = COMMANDS[tool].filter(c => !/廃止/.test(c.cat)).flatMap(c => c.items).filter(it => it.k.startsWith('/') && !it.k.includes('<スキル名>'));
  let score = 0, n = 0;
  const ask = () => {
    const it = pool[Math.floor(Math.random() * pool.length)];
    const answers = it.k.split(' / ').map(x => x.split(' ')[0].toLowerCase());
    $('#pr').innerHTML = `<div class="panel"><div class="row-between"><span class="small muted">入力練習（${tool === 'claude' ? 'Claude Code' : 'Codex'}）</span><span class="pill">${score} / ${n}</span></div>
      <div class="q" style="margin-top:6px">${esc(it.d)}</div>
      <div class="cmdinput"><input id="pi" placeholder="/..." autocapitalize="off" autocomplete="off" spellcheck="false"><button class="btn primary" id="pg">⏎</button></div>
      <div id="pf"></div></div>`;
    const inp = $('#pi');
    inp.focus();
    const check = () => {
      const v = inp.value.trim().toLowerCase().split(' ')[0];
      const ok = answers.includes(v);
      n++; if (ok) score++;
      $('#pf').innerHTML = `<div class="fb ${ok ? 'ok' : 'ng'}">${ok ? '⭕ 正解' : '❌ 正解は'} <b class="mono">${esc(it.k)}</b>${it.ex ? `<div class="tiny mono">例: ${esc(it.ex)}</div>` : ''}</div><div class="btn-row"><button class="btn primary" id="pn">次へ</button><button class="btn" id="pe">終わる</button></div>`;
      $('#pn').onclick = ask;
      $('#pe').onclick = () => { $('#pr').innerHTML = ''; if (n) toast(`${n}問中 ${score}問正解`); logActivity('quiz', 'cmds-' + tool); };
    };
    $('#pg').onclick = check;
    inp.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) check(); };
  };
  $('#practice').onclick = ask;
}

// ---------- Python ----------
function python() {
  const st = getState();
  const start = st.settings.startDay || 1;
  const nd = nextPythonDay();
  const cell = (d, title, cls) => `<a class="dayc ${cls}" href="#/day/${d}"><b>Day ${d}</b>${esc(title)}</a>`;
  const block = (from, to) => {
    let h = '';
    for (let d = from; d <= to; d++) {
      const info = DAYS.find(x => x.day === d);
      const road = ROADMAP.find(x => x.day === d);
      const done = st.days[d]?.done || d < start;
      const cls = [done ? 'done' : '', d === nd ? 'next' : '', !info && !st.aiDays[d] ? 'road' : '', st.aiDays[d] ? 'ai' : ''].join(' ');
      h += cell(d, info?.title || st.aiDays[d]?.title || road?.title || '', cls);
    }
    return h;
  };
  view.innerHTML = `
    <div class="card">
      <h1>🐍 Python 100日</h1>
      <p class="small" style="margin:0">本物の Python（ブラウザ内で動作）でコードを書き、自動テストで採点します。スマホ向けに記号キーのバーを用意しました。</p>
      <div class="btn-row"><a class="btn primary" href="#/day/${nd}">Day ${nd} から続ける ▶</a><a class="btn" href="#/play">📝 練習帳</a></div>
      <p class="tiny muted" style="margin-bottom:0">Day ${start - 1 >= 1 ? `1〜${start - 1} は修了済みとして扱っています（復習用に開けます）。変更は設定から。` : ''} Day 31 以降はロードマップ。AI（設定でAPIキー）を使うとその日のレッスンと演習を作成できます。</p>
    </div>
    <h3>Day 1〜10 基礎</h3><div class="daylist">${block(1, 10)}</div>
    <h3>Day 11〜30 中級：プロジェクト・OOP・ファイル・データ</h3><div class="daylist">${block(11, 30)}</div>
    <h3>Day 31〜53 API・Web スクレイピング・自動化</h3><div class="daylist">${block(31, 53)}</div>
    <h3>Day 54〜70 Web 開発（Flask・DB・認証）</h3><div class="daylist">${block(54, 70)}</div>
    <h3>Day 71〜80 データサイエンス</h3><div class="daylist">${block(71, 80)}</div>
    <h3>Day 81〜100 ポートフォリオ制作</h3><div class="daylist">${block(81, 100)}</div>`;
  warmup();
}

function day(arg) {
  const n = +arg || 1;
  const st = getState();
  let info = DAYS.find(d => d.day === n);
  const road = ROADMAP.find(d => d.day === n);
  const aiInfo = st.aiDays[n];
  if (!info && aiInfo) info = { ...aiInfo, day: n, ai: true };
  const nav = `<div class="row-between" style="margin-bottom:6px">
      <a class="small" href="#/python">← 一覧</a>
      <span class="row">${n > 1 ? `<a class="btn sm" href="#/day/${n - 1}">◀ Day ${n - 1}</a>` : ''}${n < 100 ? `<a class="btn sm" href="#/day/${n + 1}">Day ${n + 1} ▶</a>` : ''}</span></div>`;
  if (!info) {
    view.innerHTML = `${nav}<div class="card"><div class="small muted">Day ${n} · ロードマップ</div><h1>${esc(road?.title)}</h1>
      <p>${esc(road?.topics)}</p>
      <p class="small muted">${{ ok: 'ブラウザ版 Python でそのまま練習できる内容です。', sim: 'ネットワーク等を使う内容なので、データを用意して疑似体験する形で学びます。', pc: 'PC での実践が前提の内容です。ここでは仕組みを理解する演習を行い、PC で Claude Code や Codex と一緒に本番の開発をしてみましょう。' }[road?.browser]}</p>
      ${AI.hasKey() ? `<button class="btn primary" id="gen">🤖 AI でこの日のレッスンと演習を作成</button><p class="tiny muted">${esc(AI.currentModel())} を使用。作成後は端末に保存されます。</p>`
        : `<p class="small">設定で OpenAI の API キーを登録すると、AI がこの日のレッスンと採点付き演習をその場で作成します。</p><a class="btn" href="#/settings">設定へ</a> <a class="btn" href="#/play">練習帳で自習</a>`}
      <div id="genout"></div></div>`;
    const g = $('#gen');
    if (g) g.onclick = async () => {
      g.disabled = true;
      $('#genout').innerHTML = '<div class="spinner"></div><p class="small center muted">レッスンを作成中…（30秒〜1分ほど）</p>';
      try {
        const prev = [...DAYS, ...ROADMAP].filter(d => d.day < n).slice(-12).map(d => `Day${d.day} ${d.title}`);
        const data = await AI.generateDay(road, prev);
        $('#genout').innerHTML = '<p class="small center muted">模範解答でテストを検証中…</p>';
        for (const ex of data.exercises) {
          const r = await runTests(ex.solution, ex.tests);
          ex.verified = r.tests && r.tests.length && r.tests.every(t => t.pass);
        }
        st.aiDays[n] = data; save();
        day(String(n));
      } catch (e) {
        g.disabled = false;
        $('#genout').innerHTML = `<p class="ngc small">${esc(e.message)}</p>`;
      }
    };
    return;
  }
  const allPassed = () => info.exercises.every(ex => getState().exercises[ex.id]?.passed);
  view.innerHTML = `${nav}
    <div class="card lesson">
      <div class="small muted">Day ${n}${info.review ? ' · 復習' : ''}${info.project ? ' · プロジェクト' : ''}${info.ai ? ' · AI 作成' : ''}</div>
      <h1>${esc(info.title)}</h1>
      <p class="small muted" style="margin-top:0">🎯 ${esc(info.goal)}</p>
      ${md(info.lesson)}
      ${info.ai ? `<div class="btn-row"><button class="btn sm" id="regen">🔄 作り直す</button></div>` : ''}
    </div>
    <div id="exs"></div>
    <div class="card center" id="daydone"></div>`;
  if (info.ai) $('#regen').onclick = () => { if (confirm('この日のレッスンを作り直しますか？')) { delete st.aiDays[n]; save(); day(String(n)); } };
  const updateDone = () => {
    const ok = allPassed();
    if (ok && !st.days[n]?.done) { st.days[n] = { done: true, ts: Date.now() }; save(); logActivity('day', n); toast(`🎉 Day ${n} 修了！`); }
    $('#daydone').innerHTML = (ok || st.days[n]?.done)
      ? `<div>🎉 <b>Day ${n} 修了！</b></div><div class="btn-row" style="justify-content:center">${n < 100 ? `<a class="btn primary" href="#/day/${n + 1}">Day ${n + 1} へ ▶</a>` : ''}</div>`
      : `<div class="small muted">すべての演習のテストに合格すると Day ${n} 修了です</div><button class="btn sm" id="markdone" style="margin-top:6px">演習なしで修了にする</button>`;
    const m = $('#markdone');
    if (m) m.onclick = () => { st.days[n] = { done: true, ts: Date.now() }; save(); logActivity('day', n); updateDone(); };
  };
  const exs = $('#exs');
  info.exercises.forEach((ex, idx) => {
    const box = document.createElement('div');
    exs.appendChild(box);
    exerciseCard(box, ex, idx, info, updateDone);
  });
  updateDone();
  warmup();
}

function exerciseCard(box, ex, idx, info, onPass) {
  const st = getState();
  const passed = () => getState().exercises[ex.id]?.passed;
  box.className = 'card ex-card' + (passed() ? ' passed' : '');
  box.innerHTML = `
    <div class="row-between"><h2 style="margin:0">演習 ${idx + 1}：${esc(ex.title)}</h2>${passed() ? '<span class="pill done">✓ 合格</span>' : ''}</div>
    ${ex.verified === false ? '<p class="tiny warn">⚠ AI が作った演習のうち、模範解答でテストが通らなかったものです。テストの判定が不正確な可能性があります。</p>' : ''}
    <div class="lesson">${md(ex.prompt)}</div>
    <div class="ed"></div>
    <div class="btn-row">
      <button class="btn primary run">▶ 実行</button>
      <button class="btn blue test">✓ 採点</button>
      <button class="btn hint">💡 ヒント</button>
      <button class="btn sm ans">答え</button>
      <button class="btn sm reset">リセット</button>
    </div>
    <div class="out hide"></div>
    <div class="testres"></div>
    <div class="aiarea"></div>`;
  const draft = st.drafts[ex.id] ?? st.exercises[ex.id]?.code ?? ex.starter;
  let tsave = null;
  const ed = createEditor($('.ed', box), {
    value: draft,
    onChange: v => { clearTimeout(tsave); tsave = setTimeout(() => { getState().drafts[ex.id] = v; save(); }, 500); },
  });
  const out = $('.out', box);
  let lastRun = null;

  // 実行（input() は入力欄で受け付け、全体を再実行して続きを再現する）
  const doRun = async () => {
    out.classList.remove('hide');
    out.innerHTML = '<span class="sys">実行中…</span>';
    const code = ed.value;
    const inputs = [];
    const seed = Math.floor(Math.random() * 1e6);
    const step = async () => {
      const res = await runPython(code, inputs, seed);
      lastRun = res;
      renderOutput(out, res, { onInput: v => { inputs.push(v); out.insertAdjacentHTML('beforeend', '<span class="sys">\n…</span>'); step(); } });
      aiButtons();
    };
    await step();
  };
  $('.run', box).onclick = doRun;

  $('.test', box).onclick = async () => {
    const tr = $('.testres', box);
    tr.innerHTML = '<div class="spinner"></div>';
    const code = ed.value;
    const res = await runTests(code, ex.tests);
    if (res.status === 'timeout' || res.status === 'error') {
      tr.innerHTML = `<div class="result ng">${esc(res.err)}</div>`;
      return;
    }
    const all = res.tests.every(t => t.pass);
    tr.innerHTML = res.tests.map(t => `<div class="result ${t.pass ? 'ok' : 'ng'}">${t.pass ? '✅' : '❌'} ${esc(t.name)}${t.pass ? '' : `<pre class="code" style="margin-top:6px;white-space:pre-wrap">${esc(t.msg)}</pre>${errorHint(t.msg) ? `<div class="small">💡 ${esc(errorHint(t.msg))}</div>` : ''}${t.out ? `<details class="small"><summary>このテストでの出力</summary><pre class="code" style="white-space:pre-wrap">${esc(t.out.slice(0, 3000))}</pre></details>` : ''}`}</div>`).join('');
    lastRun = { status: all ? 'ok' : 'error', out: res.tests.map(t => t.out).join('\n'), err: res.tests.filter(t => !t.pass).map(t => t.msg).join('\n') };
    if (all) {
      const s = getState();
      const first = !s.exercises[ex.id]?.passed;
      s.exercises[ex.id] = { passed: true, code, ts: Date.now() };
      save();
      if (first) logActivity('exercise', ex.id);
      box.classList.add('passed');
      tr.insertAdjacentHTML('afterbegin', '<div class="result ok"><b>🎉 合格！</b> すべてのテストに通りました。</div>');
      onPass();
    }
    aiButtons(all);
  };
  $('.hint', box).onclick = () => {
    const a = $('.aiarea', box);
    a.innerHTML = `<div class="ai-box">💡 ${md(ex.hint)}</div>`;
    aiButtons();
  };
  $('.ans', box).onclick = () => {
    if (!confirm('模範解答を表示しますか？（まずは自分で考えてみるのがおすすめ）')) return;
    $('.aiarea', box).innerHTML = `<div class="ai-box"><b>模範解答</b><pre class="code">${esc(ex.solution)}</pre><button class="btn sm" id="useans">エディタに入れる</button></div>`;
    $('#useans', box).onclick = () => { ed.value = ex.solution; getState().drafts[ex.id] = ex.solution; save(); };
  };
  $('.reset', box).onclick = () => {
    if (!confirm('最初のコードに戻しますか？')) return;
    ed.value = ex.starter; delete getState().drafts[ex.id]; save();
  };

  // AI 先生
  let history = [];
  function aiButtons(justPassed) {
    if (!AI.hasKey()) return;
    let bar = $('.aibar', box);
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'btn-row aibar';
      $('.aiarea', box).after(bar);
    }
    const hasErr = lastRun && (lastRun.status === 'error' || lastRun.status === 'timeout');
    bar.innerHTML = `<span class="small muted">🤖 AI先生:</span>
      <button class="btn sm" data-k="hint">ヒントをもらう</button>
      ${hasErr ? '<button class="btn sm" data-k="error">エラーを解説</button>' : ''}
      ${justPassed || passed() ? '<button class="btn sm" data-k="review">コードレビュー</button>' : ''}
      <button class="btn sm" data-k="ask">質問する</button>`;
    bar.querySelectorAll('button').forEach(b => b.onclick = () => askAI(b.dataset.k));
  }
  async function askAI(kind) {
    let question = '';
    if (kind === 'ask') { question = prompt('AI先生への質問'); if (!question) return; }
    const area = document.createElement('div');
    area.className = 'ai-box';
    area.innerHTML = '<div class="spinner"></div>';
    $('.aibar', box).before(area);
    try {
      const r = await AI.tutor(kind, { exercise: ex, code: ed.value, result: lastRun ? (lastRun.out || '') + '\n' + (lastRun.err || '') : '', question, history });
      history = r.messages.slice(-8);
      area.innerHTML = `🤖 ${md(r.text)}`;
    } catch (e) { area.innerHTML = `<span class="ngc">${esc(e.message)}</span>`; }
  }
  aiButtons();
}

function play() {
  const st = getState();
  view.innerHTML = `<div class="row-between"><h1>📝 Python 練習帳</h1><a class="small" href="#/python">← 100日</a></div>
    <p class="small muted" style="margin-top:0">自由にコードを書いて実行できます。turtle で絵を描いたり、pandas・matplotlib も使えます。</p>
    <div class="chips" id="snips"></div>
    <div id="ed"></div>
    <div class="btn-row"><button class="btn primary" id="run">▶ 実行</button><button class="btn sm" id="clr">クリア</button>${AI.hasKey() ? '<button class="btn sm" id="ask">🤖 AIに質問</button>' : ''}</div>
    <div class="out hide" id="out"></div><div id="aiout"></div>`;
  const SNIPS = {
    'こんにちは': 'name = input("名前は？ ")\nprint(f"こんにちは、{name}さん！")\n',
    'タートル': 'import turtle\nt = turtle.Turtle()\nt.color("tomato")\nfor i in range(36):\n    t.forward(150)\n    t.left(170)\n',
    'グラフ': 'import matplotlib.pyplot as plt\nx = list(range(1, 11))\nplt.plot(x, [n * n for n in x], marker="o")\nplt.title("y = x^2")\nplt.show()\n',
    'pandas': 'import pandas as pd\ndf = pd.DataFrame({"name": ["A", "B", "C"], "score": [80, 95, 72]})\nprint(df.describe())\nprint(df.sort_values("score", ascending=False))\n',
    'クラス': 'class Dog:\n    def __init__(self, name):\n        self.name = name\n\n    def bark(self):\n        print(f"{self.name}: ワン！")\n\nDog("ポチ").bark()\n',
  };
  $('#snips').innerHTML = Object.keys(SNIPS).map(k => `<button class="chip" data-k="${k}">${k}</button>`).join('');
  let t = null;
  const ed = createEditor($('#ed'), { value: st.playground || SNIPS['こんにちは'], onChange: v => { clearTimeout(t); t = setTimeout(() => { getState().playground = v; save(); }, 500); } });
  $('#snips').querySelectorAll('.chip').forEach(b => b.onclick = () => { ed.value = SNIPS[b.dataset.k]; getState().playground = ed.value; save(); });
  let last = null;
  $('#run').onclick = async () => {
    const out = $('#out');
    out.classList.remove('hide');
    out.innerHTML = '<span class="sys">実行中…</span>';
    const inputs = [], seed = Math.floor(Math.random() * 1e6), code = ed.value;
    const step = async () => {
      last = await runPython(code, inputs, seed);
      renderOutput(out, last, { onInput: v => { inputs.push(v); step(); } });
    };
    await step();
    logActivity('play', '');
  };
  $('#clr').onclick = () => { ed.value = ''; };
  const ask = $('#ask');
  if (ask) ask.onclick = async () => {
    const q = prompt('このコードについての質問'); if (!q) return;
    $('#aiout').innerHTML = '<div class="spinner"></div>';
    try {
      const r = await AI.tutor('ask', { code: ed.value, result: last ? (last.out || '') + (last.err || '') : '', question: q });
      $('#aiout').innerHTML = `<div class="ai-box">🤖 ${md(r.text)}</div>`;
    } catch (e) { $('#aiout').innerHTML = `<p class="ngc">${esc(e.message)}</p>`; }
  };
  warmup();
}

// ---------- 設定 ----------
function settings() {
  const st = getState();
  const s = st.settings;
  view.innerHTML = `
    <div class="card"><h2>🤖 AI 機能（任意・OpenAI）</h2>
      <p class="small">OpenAI の API キーを登録すると、①本物の AI によるエージェント体験 ②Python の AI 先生 ③Day 31〜100 のレッスン自動作成 が使えます。</p>
      <div class="form">
        <label>OpenAI API キー<input type="password" id="key" value="${esc(s.openaiKey)}" placeholder="sk-..." autocomplete="off"></label>
        <label>モデル<select id="model"></select></label>
        <label id="modelCustomWrap" class="hide">モデル名を直接入力<input id="modelCustom" value="${esc(s.openaiModel)}" placeholder="${AI.OPENAI_DEFAULT}" autocomplete="off" autocapitalize="off"></label>
        <div class="btn-row" style="margin-top:0"><button class="btn sm" id="listm">このキーで使えるモデル一覧を取得</button><span id="modelsStatus" class="small muted"></span></div>
        <div class="two">
          <label>単価：入力（$/100万トークン）<input type="number" id="pin" min="0" step="0.01" value="${esc(s.openaiPriceIn)}" placeholder="例 2"></label>
          <label>単価：出力（$/100万トークン）<input type="number" id="pout" min="0" step="0.01" value="${esc(s.openaiPriceOut)}" placeholder="例 10"></label>
        </div>
      </div>
      <p class="small muted">単価は任意。入れるとホームに推定金額が出ます（選んだモデルの単価は <a href="https://platform.openai.com/docs/pricing" target="_blank" rel="noopener">OpenAI の料金ページ ↗</a> で確認）。</p>
      <p class="small muted">OpenAI のモデルは頻繁に更新されます。キーを入れたら「一覧を取得」を押してください（使えない名前は自動で最新モデルに置き換わります）。目安：名前に mini / nano / luna が付くものは安価、無印や上位名は高品質・高価格。</p>
      <p class="small muted">キーはこの端末のブラウザ内にのみ保存され、OpenAI の API への直接リクエストにだけ使われます。共有端末では入力しないでください。利用料金は API の従量課金です（ChatGPT の月額プランとは別）。</p>
      <div class="btn-row"><button class="btn primary" id="saveAI">保存</button></div>
    </div>
    <div class="card"><h2>学習の設定</h2>
      <div class="form">
        <label>Python の開始日（それより前の Day は修了扱い）<input type="number" id="startDay" min="1" max="100" value="${s.startDay}"></label>
        <label>シミュレーターの文字送り<select id="speed"><option value="0" ${s.typeSpeed == 0 ? 'selected' : ''}>瞬時</option><option value="1" ${s.typeSpeed == 1 ? 'selected' : ''}>普通</option><option value="2" ${s.typeSpeed == 2 ? 'selected' : ''}>ゆっくり</option></select></label>
        <label>テーマ<select id="theme"><option value="">端末に合わせる</option><option value="light" ${s.theme === 'light' ? 'selected' : ''}>ライト</option><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>ダーク</option></select></label>
      </div>
    </div>
    <div class="card"><h2>データ</h2>
      <p class="small muted">学習記録はこの端末のブラウザに保存されています。機種変更の前に書き出しておきましょう。</p>
      <div class="btn-row"><button class="btn" id="exp">書き出し</button><label class="btn">読み込み<input type="file" id="imp" accept="application/json" hidden></label><button class="btn danger" id="reset" style="color:var(--ng)">すべてリセット</button></div>
    </div>
    <div class="card small muted">ホーム画面に追加するとアプリのように使えます（iPhone: 共有 → ホーム画面に追加 / Android: メニュー → アプリをインストール）。<br>
    シナリオの画面は実際の Claude Code / Codex を元にした再現で、バージョンにより表示や機能が異なる場合があります。最新情報は公式ドキュメントを確認してください。</div>`;
  const upd = (k, v) => { st.settings[k] = v; save(); };
  // モデルのプルダウン（取得済み一覧があればそれを、なければ参考候補を表示）
  const drawModels = (list, selected) => {
    const ids = list.map(m => m.id);
    const sel = selected || ids[0] || AI.OPENAI_DEFAULT;
    const known = ids.includes(sel);
    $('#model').innerHTML = list.map((m, i) => `<option value="${esc(m.id)}" ${m.id === sel ? 'selected' : ''}>${esc(m.id)}${m.date ? `（${esc(m.date)}）` : ''}${i === 0 && m.date ? ' ★最新' : ''}</option>`).join('')
      + `<option value="__custom" ${known ? '' : 'selected'}>その他（直接入力）</option>`;
    if (!known) $('#modelCustom').value = sel;
    $('#modelCustomWrap').classList.toggle('hide', known);
  };
  const saved = (s.openaiModels || []).map(m => typeof m === 'string' ? { id: m, date: '' } : m);
  drawModels(saved.length ? saved : AI.OPENAI_SUGGESTED.map(id => ({ id, date: '' })), s.openaiModel || AI.OPENAI_DEFAULT);
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
      drawModels(list, list.some(m => m.id === cur) ? cur : list[0].id);  // 使えないモデルなら最新に置き換え
      $('#modelsStatus').textContent = `${list.length}件取得しました（新しい順）。上の「モデル」から選んで「保存」を押してください。`;
    } catch (e) { $('#modelsStatus').textContent = e.message; }
  };
  $('#key').onchange = () => { if ($('#key').value.trim()) $('#listm').click(); };
  $('#saveAI').onclick = () => {
    const m = $('#model').value === '__custom' ? $('#modelCustom').value.trim() : $('#model').value;
    Object.assign(st.settings, { openaiKey: $('#key').value.trim(), openaiModel: m || AI.OPENAI_DEFAULT, openaiPriceIn: $('#pin').value, openaiPriceOut: $('#pout').value });
    save(); toast('保存しました');
  };
  $('#startDay').onchange = e => upd('startDay', Math.max(1, Math.min(100, +e.target.value || 1)));
  $('#speed').onchange = e => upd('typeSpeed', +e.target.value);
  $('#theme').onchange = e => { upd('theme', e.target.value); applyTheme(); };
  $('#exp').onclick = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `codedojo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  $('#imp').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { importData(await f.text()); toast('読み込みました'); settings(); } catch { toast('読み込めませんでした'); }
  };
  $('#reset').onclick = () => { if (confirm('学習記録・設定をすべて消去しますか？')) { resetAll(); settings(); } };
}

function applyTheme() {
  const t = getState().settings.theme;
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}

onPyStatus(msg => { const el = $('#topinfo'); if (el) el.textContent = msg ? '🐍 ' + msg.slice(0, 40) : ''; });
applyTheme();
route();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
