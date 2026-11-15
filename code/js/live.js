// 本物の AI（OpenAI）によるエージェント体験（Claude Code / Codex 風）
// 仮想プロジェクトのファイルはこの端末に保存。コード実行はブラウザ内の Python（Pyodide）。
import { getState, save, logActivity } from './store.js';
import { LIVE_PROJECTS } from '../data/live-projects.js';
import { runProject, warmup } from './py.js';
import * as AI from './ai.js';
import { esc, md, toast } from './util.js';

const $ = (s, el = document) => el.querySelector(s);
const MODE_LABEL = { default: '? 通常（毎回確認）', accept: '⏵⏵ accept edits on', plan: '⏸ plan mode on' };
const MODE_CLS = { default: '', accept: 'mode-accept', plan: 'mode-plan' };
const NEXT_MODE = { default: 'accept', accept: 'plan', plan: 'default' };

function lineDiff(a, b) {
  const A = a.split('\n'), B = b.split('\n');
  if (A.length * B.length > 250000) return [...A.map(l => '-' + l), ...B.map(l => '+' + l)];
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push(' ' + A[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push('-' + A[i++]);
    else out.push('+' + B[j++]);
  }
  while (i < n) out.push('-' + A[i++]);
  while (j < m) out.push('+' + B[j++]);
  // 変更行の前後2行だけ残す
  const keep = out.map((l, k) => out.slice(Math.max(0, k - 2), k + 3).some(x => x[0] !== ' '));
  const res = [];
  out.forEach((l, k) => { if (keep[k]) res.push(l); else if (res[res.length - 1] !== '…') res.push('…'); });
  return res;
}
const diffStat = d => `${d.filter(l => l[0] === '+').length} additions, ${d.filter(l => l[0] === '-').length} removals`;

function freshSession(p) {
  return { projectId: p.id, files: JSON.parse(JSON.stringify(p.files)), messages: [], transcript: [], mode: 'default', allow: { edit: false, run: false }, summary: '', usage: { in: 0, out: 0 } };
}

export function renderLive(view, arg) {
  const st = getState();
  if (!AI.hasKey()) {
    view.innerHTML = `<div class="row-between"><h1>⚡ 本物のAIで体験</h1><a class="small" href="#/lab">← AIラボ</a></div>
      <div class="card"><p>ここでは<b>本物の AI（OpenAI のモデル）</b>が、ブラウザ内の仮想プロジェクトのファイルを読み・編集し・テストを実行します。許可ダイアログ・プランモード・差分の確認など、Claude Code と同じ流れを体験できます。</p>
      <p class="small">利用には OpenAI の API キーが必要です（従量課金）。</p>
      <a class="btn primary" href="#/settings">設定で API キーを登録</a></div>`;
    return null;
  }
  if (arg === 'new' || !st.live) {
    view.innerHTML = `<div class="row-between"><h1>⚡ 本物のAIで体験</h1><a class="small" href="#/lab">← AIラボ</a></div>
      <p class="small muted">プロジェクトを選ぶと、AI（${esc(AI.currentModel())}）があなたの指示で実際に作業します。</p>
      ${LIVE_PROJECTS.map(p => `<button class="tile" style="width:100%;text-align:left;margin-bottom:10px;font:inherit" data-p="${p.id}"><div class="t">${esc(p.title)}</div><div class="small muted">${esc(p.desc)}</div></button>`).join('')}
      ${st.live ? '<a class="btn" href="#/live">← 前回の続きに戻る</a>' : ''}`;
    view.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
      const p = LIVE_PROJECTS.find(x => x.id === b.dataset.p);
      st.live = freshSession(p); save();
      location.hash = '#/live';
      if (arg !== 'new') renderLive(view, '');
    });
    return null;
  }
  return new LiveSession(view);
}

class LiveSession {
  constructor(view) {
    this.view = view;
    this.s = getState().live;
    this.project = LIVE_PROJECTS.find(p => p.id === this.s.projectId) || LIVE_PROJECTS[0];
    this.busy = false;
    this.ctrl = null;
    this.render();
    warmup();
  }
  destroy() { if (this.ctrl) this.ctrl.abort(); }
  persist() {
    // localStorage の容量対策：古い履歴を落とす（表示用は200件まで）
    if (this.s.transcript.length > 200) this.s.transcript = this.s.transcript.slice(-200);
    save();
  }

  render() {
    const s = this.s;
    this.view.innerHTML = `
      <div class="row-between" style="margin-bottom:6px"><a class="small" href="#/live/new">← プロジェクト選択</a>
        <span class="row"><button class="btn sm" id="files">📁 ファイル</button><button class="btn sm" id="help">?</button></span></div>
      <div class="term-wrap">
        <div class="term-head"><i></i><i></i><i></i><span>agent — ~/${esc(this.project.id)} · ${esc(AI.currentModel())}</span></div>
        <div class="term" id="term"></div>
        <div class="statusline"><span id="mode"></span><span id="usage"></span></div>
      </div>
      <div class="panel" id="panel"></div>`;
    this.term = $('#term', this.view);
    this.panel = $('#panel', this.view);
    if (!s.transcript.length) this.add({ k: 'banner' });
    else s.transcript.forEach(t => this.draw(t));
    this.status();
    this.inputPanel();
    $('#files', this.view).onclick = () => this.showFiles();
    $('#help', this.view).onclick = () => this.help();
  }

  status() {
    const m = $('#mode', this.view);
    m.className = MODE_CLS[this.s.mode];
    m.textContent = MODE_LABEL[this.s.mode] + ' (タップで切替)';
    m.style.cursor = 'pointer';
    m.onclick = () => { if (!this.busy) { this.s.mode = NEXT_MODE[this.s.mode]; this.persist(); this.status(); } };
    const u = this.s.usage;
    const usd = AI.costOf({ in: u.in, out: u.out });
    $('#usage', this.view).textContent = `${((u.in + u.out) / 1000).toFixed(1)}k tok${usd != null ? ` · $${usd.toFixed(3)}` : ''}`;
  }

  add(item) { this.s.transcript.push(item); this.draw(item); this.persist(); }
  draw(t) {
    const d = document.createElement('div');
    d.className = 'ln';
    switch (t.k) {
      case 'banner':
        d.className = 'ln box';
        d.innerHTML = `<span class="cl">✻</span> <b>AI エージェント体験</b>（OpenAI ${esc(AI.currentModel())}）\n\n  <span class="dim">本物の AI が仮想プロジェクトで、Claude Code / Codex と同じ流れで作業します</span>\n  <span class="dim">/help でコマンド一覧 · Shift+Tab の代わりにステータス行をタップ</span>\n\n  <span class="dim">cwd: ~/${esc(this.project.id)}</span>`;
        break;
      case 'user': d.className = 'ln userline'; d.innerHTML = `<span class="dim">&gt;</span> ${esc(t.text)}`; break;
      case 'text': d.innerHTML = `<span class="cl">⏺</span> ${esc(t.text)}`; break;
      case 'tool': d.innerHTML = `<span class="${t.fail ? 'r' : 'g'}">⏺</span> <b>${esc(t.name)}</b>(${esc(t.arg)})${t.out ? '\n' + t.out.split('\n').map((l, k) => (k ? '     ' : '  ⎿  ') + esc(l)).join('\n') : ''}`; break;
      case 'diff':
        d.className = 'ln diff';
        d.innerHTML = t.lines.map(l => `<div class="${l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : ''}">${esc(l)}</div>`).join('');
        break;
      case 'sys': d.innerHTML = `<span class="dim">${esc(t.text)}</span>`; break;
      case 'err': d.innerHTML = `<span class="r">${esc(t.text)}</span>`; break;
    }
    this.term.appendChild(d);
    this.term.scrollTop = this.term.scrollHeight;
  }

  inputPanel() {
    const tasks = this.project.tasks;
    this.panel.innerHTML = `
      <div class="cmdinput"><input id="pin" placeholder="指示を入力（/help でコマンド）" autocomplete="off"><button class="btn primary" id="send">⏎</button></div>
      <div class="chips" id="sug">${tasks.map(t => `<button class="chip" data-t="${esc(t)}">${esc(t.length > 26 ? t.slice(0, 26) + '…' : t)}</button>`).join('')}
        <button class="chip" data-t="/clear">/clear</button><button class="chip" data-t="/cost">/cost</button><button class="chip" data-t="/compact">/compact</button></div>`;
    const inp = $('#pin', this.panel);
    const go = () => { const v = inp.value.trim(); if (v) this.submit(v); };
    $('#send', this.panel).onclick = go;
    inp.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) go(); };
    this.panel.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { inp.value = b.dataset.t; inp.focus(); });
  }

  busyPanel() {
    this.panel.innerHTML = `<div class="row-between"><span class="small"><span class="spinner" style="width:18px;height:18px;border-width:3px;display:inline-block;vertical-align:middle;margin:0 6px 0 0"></span>AI が作業中…</span><button class="btn sm" id="stop">■ 中断（Esc）</button></div>`;
    $('#stop', this.panel).onclick = () => { if (this.ctrl) this.ctrl.abort(); };
  }

  async submit(text) {
    if (this.busy) return;
    const s = this.s;
    if (text.startsWith('/')) {
      const [cmd] = text.split(/\s+/);
      if (cmd === '/clear') { s.messages = []; s.transcript = []; s.summary = ''; this.persist(); this.render(); toast('会話をクリアしました（ファイルはそのまま）'); return; }
      if (cmd === '/cost') { const u = s.usage; this.add({ k: 'sys', text: `このセッション: 入力 ${u.in.toLocaleString()} / 出力 ${u.out.toLocaleString()} トークン · ${AI.costOf(u) != null ? '推定 $' + AI.costOf(u).toFixed(4) : '（設定で単価を入れると金額も表示）'}` }); this.inputPanel(); return; }
      if (cmd === '/help') { this.help(); return; }
      if (cmd === '/files') { this.showFiles(); return; }
      if (cmd === '/reset') { if (confirm('ファイルを初期状態に戻し、会話も消しますか？')) { getState().live = freshSession(this.project); this.s = getState().live; this.persist(); this.render(); } return; }
      if (cmd === '/model') { this.add({ k: 'sys', text: `現在のモデル: ${AI.currentModel()}（設定画面で変更できます）` }); this.inputPanel(); return; }
      if (cmd === '/compact') return this.compact();
      if (cmd === '/init') text = '/init — このプロジェクトを調べて、AGENTS.md（プロジェクトの説明書: 実行・テスト方法、構成、コーディング規約、注意点）を作成して。簡潔に。';
      else { this.add({ k: 'err', text: `不明なコマンド: ${cmd}（/help で一覧）` }); return; }
    }
    this.add({ k: 'user', text });
    let content = text;
    const pre = [];
    if (!s.messages.length) {
      if (s.summary) pre.push(`（これまでの会話の要約）\n${s.summary}`);
      for (const f of ['AGENTS.md', 'CLAUDE.md']) if (s.files[f]) pre.push(`<${f}>\n${s.files[f]}\n</${f}>`);
    }
    if (s.mode === 'plan') pre.push('（プランモード中：ファイルの変更や実行はせず、調査して実装計画を提示してください。ユーザーが承認したら実装します）');
    if (pre.length) content = pre.join('\n\n') + '\n\n' + text;
    s.messages.push({ role: 'user', content });
    await this.loop();
  }

  async loop() {
    const s = this.s;
    this.busy = true;
    this.ctrl = new AbortController();
    this.busyPanel();
    const before = getState().aiUsage.length;
    try {
      const r = await AI.agentTurn(s.messages, {
        signal: this.ctrl.signal,
        onText: t => this.add({ k: 'text', text: t }),
        execTool: (name, input) => this.exec(name, input),
      });
      if (r.stopped) this.add({ k: 'err', text: '  ⎿  Interrupted by user（中断しました。続けて指示できます）' });
      if (s.mode === 'plan' && !r.stopped) this.planApproval();
    } catch (e) {
      this.add({ k: 'err', text: 'エラー: ' + e.message });
      // ツール結果待ちのまま終わらないように整える
      const last = s.messages[s.messages.length - 1];
      if (last && last.role === 'user' && typeof last.content === 'string') s.messages.pop();
    }
    for (const u of getState().aiUsage.slice(before)) { s.usage.in += u.in; s.usage.out += u.out; }
    this.busy = false;
    this.ctrl = null;
    this.persist();
    this.status();
    if (!this.planPending) this.inputPanel();
    logActivity('live', s.projectId);
  }

  planApproval() {
    this.planPending = true;
    this.panel.innerHTML = `<div class="q">この計画で進めますか？</div><div class="opts">
      <button class="opt" data-k="accept">1. Yes, and auto-accept edits（編集を自動承認して実装）</button>
      <button class="opt" data-k="default">2. Yes, and manually approve edits（編集ごとに確認）</button>
      <button class="opt" data-k="no">3. No, keep planning（計画を修正する）</button></div>`;
    this.panel.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      this.planPending = false;
      const k = b.dataset.k;
      if (k === 'no') { this.inputPanel(); $('#pin', this.panel).placeholder = '計画への修正点を入力'; return; }
      this.s.mode = k; this.status();
      this.submit('計画を承認します。実装してください。');
    });
  }

  async compact() {
    const s = this.s;
    if (!s.messages.length) { toast('会話がありません'); return; }
    this.busy = true; this.busyPanel();
    try {
      s.messages.push({ role: 'user', content: 'ここまでの会話を、作業の続きに必要な情報（目的・変更したファイル・決定事項・残タスク）に絞って日本語で要約して。ツールは使わないで。' });
      const before = getState().aiUsage.length;
      let summary = '';
      await AI.agentTurn(s.messages, { onText: t => { summary += t + '\n'; }, execTool: async () => ({ content: '要約中はツールを使えません', isError: true }), maxSteps: 2 });
      for (const u of getState().aiUsage.slice(before)) { s.usage.in += u.in; s.usage.out += u.out; }
      s.summary = summary.trim();
      s.messages = [];
      this.add({ k: 'sys', text: '✻ Conversation compacted（会話を要約しました。次の指示から要約を引き継ぎます）' });
    } catch (e) { this.add({ k: 'err', text: e.message }); }
    this.busy = false; this.persist(); this.status(); this.inputPanel();
  }

  // ---------- ツールの実行 ----------
  async exec(name, input) {
    const s = this.s;
    const files = s.files;
    const norm = p => String(p || '').replace(/^\.?\//, '');
    switch (name) {
      case 'list_files': {
        const list = Object.keys(files).sort().map(p => `${p} (${files[p].split('\n').length} lines)`);
        this.add({ k: 'tool', name: 'List', arg: '.', out: `Listed ${list.length} files` });
        return { content: list.join('\n') || '(ファイルなし)' };
      }
      case 'read_file': {
        const p = norm(input.path);
        if (!(p in files)) { this.add({ k: 'tool', name: 'Read', arg: p, out: 'File not found', fail: true }); return { content: `ファイルがありません: ${p}`, isError: true }; }
        const lines = files[p].split('\n');
        this.add({ k: 'tool', name: 'Read', arg: p, out: `Read ${lines.length} lines` });
        return { content: lines.map((l, i) => `${String(i + 1).padStart(4)}\t${l}`).join('\n') };
      }
      case 'search': {
        let re;
        try { re = new RegExp(input.pattern, 'i'); } catch { return { content: '正規表現が不正です', isError: true }; }
        const hits = [];
        for (const [p, c] of Object.entries(files)) c.split('\n').forEach((l, i) => { if (re.test(l)) hits.push(`${p}:${i + 1}: ${l}`); });
        this.add({ k: 'tool', name: 'Search', arg: `pattern: "${input.pattern}"`, out: `Found ${hits.length} matches` });
        return { content: hits.slice(0, 200).join('\n') || '見つかりませんでした' };
      }
      case 'write_file':
      case 'edit_file': {
        const p = norm(input.path);
        const old = files[p];
        let next;
        if (name === 'edit_file') {
          if (old == null) return { content: `ファイルがありません: ${p}`, isError: true };
          const cnt = old.split(input.old_str).length - 1;
          if (cnt === 0) { this.add({ k: 'tool', name: 'Update', arg: p, out: 'old_str が見つかりません', fail: true }); return { content: 'old_str がファイル内に見つかりません。read_file で現在の内容を確認してください。', isError: true }; }
          if (cnt > 1) return { content: `old_str が ${cnt} 回出現します。前後の行を含めて一意にしてください。`, isError: true };
          next = old.replace(input.old_str, () => input.new_str);
        } else next = input.content;
        const diff = lineDiff(old ?? '', next);
        const label = old == null ? 'Write' : 'Update';
        if (s.mode === 'plan') {
          this.add({ k: 'tool', name: label, arg: p, out: 'プランモード中のため変更しませんでした', fail: true });
          return { content: 'プランモード中は変更できません。計画を提示してユーザーの承認を待ってください。', isError: true };
        }
        this.add({ k: 'diff', lines: diff.slice(0, 120) });
        if (s.mode !== 'accept' && !s.allow.edit) {
          const ans = await this.permission(old == null ? 'Create file' : 'Edit file', p, [
            'Yes', 'Yes, allow all edits during this session', 'No, and tell the agent what to do differently']);
          if (ans.k === 1) { s.allow.edit = true; }
          if (ans.k === 2) { this.add({ k: 'tool', name: label, arg: p, out: 'User rejected' + (ans.text ? `: ${ans.text}` : ''), fail: true }); return { content: `ユーザーがこの変更を拒否しました。${ans.text ? 'ユーザーのコメント: ' + ans.text : '別の方法を検討してください。'}`, isError: true }; }
        }
        files[p] = next;
        this.add({ k: 'tool', name: label, arg: p, out: old == null ? `Wrote ${next.split('\n').length} lines to ${p}` : `Updated ${p} with ${diffStat(diff)}` });
        return { content: old == null ? `${p} を作成しました` : `${p} を更新しました` };
      }
      case 'run_python':
      case 'run_tests': {
        const isTest = name === 'run_tests';
        const cmd = isTest ? 'pytest' : `python ${norm(input.path)}${input.stdin ? ' < stdin' : ''}`;
        if (!s.allow.run) {
          const ans = await this.permission('Bash command', cmd, ['Yes', `Yes, and don't ask again for python/pytest commands`, 'No, and tell the agent what to do differently']);
          if (ans.k === 1) s.allow.run = true;
          if (ans.k === 2) { this.add({ k: 'tool', name: 'Bash', arg: cmd, out: 'User rejected', fail: true }); return { content: `ユーザーが実行を拒否しました。${ans.text || ''}`, isError: true }; }
        }
        const stdin = (input.stdin || '').split('\n').filter((l, i, a) => !(i === a.length - 1 && l === ''));
        const r = await runProject(files, isTest ? 'test' : 'run', norm(input.path), stdin);
        const text = (r.out || '') + (r.err ? (r.out ? '\n' : '') + r.err : '');
        const fail = r.status !== 'ok' || /failed|ERROR/.test(r.out || '');
        this.add({ k: 'tool', name: 'Bash', arg: cmd, out: text.split('\n').slice(-14).join('\n').trim() || '(no output)', fail });
        return { content: text || '(出力なし)', isError: r.status === 'error' || r.status === 'timeout' };
      }
      default:
        return { content: `不明なツール: ${name}`, isError: true };
    }
  }

  permission(kind, body, options) {
    return new Promise(resolve => {
      this.panel.innerHTML = `<div class="small" style="color:var(--warn)"><b>${esc(kind)}</b></div>
        <div class="mono small" style="margin:4px 0 8px;word-break:break-all">${esc(body)}</div>
        <div class="small">Do you want to proceed?</div>
        <div class="opts" style="margin-top:6px">${options.map((o, k) => `<button class="opt mono" data-k="${k}">${k + 1}. ${esc(o)}</button>`).join('')}</div>
        <div id="nofb" class="hide" style="margin-top:8px"><div class="cmdinput"><input id="nt" placeholder="どうしてほしいか（任意）"><button class="btn primary" id="nsend">送る</button></div></div>`;
      this.panel.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const k = +b.dataset.k;
        if (k === 2) {
          $('#nofb', this.panel).classList.remove('hide');
          const send = () => { const t = $('#nt', this.panel).value.trim(); this.busyPanel(); resolve({ k, text: t }); };
          $('#nsend', this.panel).onclick = send;
          $('#nt', this.panel).onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) send(); };
          $('#nt', this.panel).focus();
          return;
        }
        this.busyPanel();
        resolve({ k });
      });
    });
  }

  showFiles() {
    const files = this.s.files;
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    const names = Object.keys(files).sort();
    bg.innerHTML = `<div class="modal"><div class="row-between"><h2 style="margin:0">📁 ファイル</h2><button class="btn sm" id="cl">閉じる</button></div>
      <div class="chips" style="margin:8px 0">${names.map(n => `<button class="chip" data-f="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      <pre class="code" id="fv" style="max-height:60vh;white-space:pre"></pre>
      <div class="btn-row"><button class="btn sm" id="rs">初期状態に戻す（/reset）</button></div></div>`;
    document.body.appendChild(bg);
    const show = n => {
      bg.querySelectorAll('[data-f]').forEach(c => c.classList.toggle('on', c.dataset.f === n));
      $('#fv', bg).textContent = files[n].split('\n').map((l, i) => `${String(i + 1).padStart(3)}  ${l}`).join('\n');
    };
    bg.querySelectorAll('[data-f]').forEach(c => c.onclick = () => show(c.dataset.f));
    if (names.length) show(names.find(n => n.endsWith('.py')) || names[0]);
    const close = () => bg.remove();
    $('#cl', bg).onclick = close;
    bg.onclick = e => { if (e.target === bg) close(); };
    $('#rs', bg).onclick = () => { close(); this.submit('/reset'); };
  }

  help() {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal lesson"><div class="row-between"><h2 style="margin:0">使い方</h2><button class="btn sm" id="cl">閉じる</button></div>${md(`- 下の入力欄に、Claude Code と同じように日本語で指示します（候補のチップをタップでも可）
- AI は **ファイルを読む → 変更する → テストを実行する** を自分で繰り返します
- 変更やコマンド実行の前に**許可**を求められます。「No」を選ぶと理由を伝えて別案を出させられます
- ステータス行をタップすると **通常 → accept edits → plan mode** に切り替わります（本物の Shift+Tab に相当）
- 作業中に「■ 中断」で止められます（本物の Esc に相当）
### コマンド
- \`/init\` … AGENTS.md を作らせる（以降の会話で自動的に読み込まれます）
- \`/clear\` … 会話をリセット（ファイルは残る）
- \`/compact\` … 会話を要約して続ける
- \`/cost\` … このセッションのトークン数と推定料金
- \`/files\` … ファイルを見る、\`/reset\` … プロジェクトを初期状態に
- \`/model\` … 使用中のモデル
> コードはブラウザ内の Python で実行されます。ネットワークや pip install は使えません。`)}</div>`;
    document.body.appendChild(bg);
    $('#cl', bg).onclick = () => bg.remove();
    bg.onclick = e => { if (e.target === bg) bg.remove(); };
    if (this.panel && !this.busy && !this.planPending) this.inputPanel();
  }
}
