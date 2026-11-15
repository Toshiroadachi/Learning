// Claude Code / Codex の操作をリアルに再現するシナリオプレイヤー
import { getState, save, logActivity } from './store.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// [[g:緑]] [[r:赤]] [[y:黄]] [[c:水色]] [[p:紫]] [[dim:灰]] [[cl:Claude色]] [[cx:Codex色]] **太字**
export function fmt(s) {
  return esc(s)
    .replace(/\[\[(\w+):([\s\S]*?)\]\]/g, '<span class="$1">$2</span>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}
const fmtTerm = s => esc(s)
  .replace(/\[\[(\w+):([\s\S]*?)\]\]/g, '<span class="$1">$2</span>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const MODES = {
  claude: {
    default: ['', '? for shortcuts'],
    accept: ['mode-accept', '⏵⏵ accept edits on (shift+tab to cycle)'],
    plan: ['mode-plan', '⏸ plan mode on (shift+tab to cycle)'],
    auto: ['mode-auto', '⏵⏵ auto mode on (shift+tab to cycle)'],
    bypass: ['mode-auto', '⏵⏵ bypass permissions on'],
  },
  codex: {
    default: ['', '⏎ send   ⇧⏎ newline   ⌃T transcript   ⌃C quit'],
    readonly: ['mode-plan', 'Read Only   ⏎ send   ⌃C quit'],
    auto: ['mode-accept', 'Auto (workspace-write)   ⏎ send'],
    full: ['mode-auto', 'Full Access ⚠   ⏎ send'],
  },
};

export class SimPlayer {
  constructor(root, scenario, { onFinish } = {}) {
    this.root = root;
    this.sc = scenario;
    this.tool = scenario.tool;
    this.i = 0;
    this.score = 0;
    this.total = 0;
    this.mode = scenario.mode || 'default';
    this.ctx = scenario.ctx ?? 100;
    this.onFinish = onFinish;
    this.ui = scenario.ui || '';      // '' = ターミナル / claude-desktop / claude-mobile / codex-vscode / codex-app
    this.app = !!this.ui;
    this.chips = { ...(scenario.chips || {}) };
    this.title = scenario.session || '';
    this.alive = true;
    this.render();
    this.run();
  }

  get speed() { return [0, 1, 2.2][getState().settings.typeSpeed ?? 1]; }

  render() {
    if (this.app) return this.renderApp();
    const title = this.tool === 'codex' ? 'codex — ' + (this.sc.cwd || '~/project') : 'claude — ' + (this.sc.cwd || '~/project');
    this.root.innerHTML = `
      <div class="term-wrap">
        <div class="term-head"><i></i><i></i><i></i><span>${esc(title)}</span></div>
        <div class="term" id="term"></div>
        <div class="statusline"><span id="sl-mode"></span><span id="sl-right"></span></div>
      </div>
      <div class="panel" id="panel"></div>`;
    this.term = this.root.querySelector('#term');
    this.panel = this.root.querySelector('#panel');
    this.updateStatus();
  }

  updateStatus() {
    if (this.app) return this.renderChips();
    const [cls, text] = (MODES[this.tool][this.mode] || MODES[this.tool].default);
    const m = this.root.querySelector('#sl-mode');
    m.className = cls; m.textContent = text;
    this.root.querySelector('#sl-right').textContent = this.tool === 'codex'
      ? `${this.ctx}% context left` : (this.ctx < 100 ? `Context left until auto-compact: ${this.ctx}%` : '');
  }

  renderApp() {
    const ui = this.ui;
    const head = {
      'claude-desktop': `<span class="aw-dots"><i></i><i></i><i></i></span><span class="aw-tabs"><span>Chat</span><span class="on">Code</span></span><span class="aw-title" id="aw-title"></span><span class="aw-icons">⌨︎ ± 🌐 📁 ⋮</span>`,
      'claude-mobile': `<span class="aw-back">‹</span><span class="aw-title" id="aw-title"></span><span class="aw-icons">⋮</span>`,
      'codex-vscode': `<span class="aw-dots"><i></i><i></i><i></i></span><span class="aw-title" id="aw-title"></span><span class="aw-icons">Visual Studio Code</span>`,
      'codex-app': `<span class="aw-dots"><i></i><i></i><i></i></span><span class="aw-logo">Codex</span><span class="aw-title" id="aw-title"></span><span class="aw-icons">⌨︎ ±</span>`,
    }[ui];
    const sub = {
      'codex-vscode': `<div class="aw-sub"><span class="aw-side">🧩 CODEX</span><span class="aw-ed" id="aw-ed">${esc(this.sc.editor || 'app.js')}</span></div>`,
      'codex-app': `<div class="aw-sub" id="aw-threads"></div>`,
    }[ui] || '';
    this.root.innerHTML = `
      <div class="appwin ui-${ui}">
        <div class="aw-head">${head}</div>${sub}
        <div class="aw-body" id="term"></div>
        <div class="aw-composer"><div class="aw-input" id="aw-input"><span class="aw-ph">${{ 'claude-desktop': 'Claude に依頼する…', 'claude-mobile': 'Claude に依頼する…', 'codex-vscode': 'Codex に依頼する…（@ でファイル、/ でコマンド）', 'codex-app': 'Codex に依頼する…' }[ui]}</span></div><div class="aw-chips" id="aw-chips"></div></div>
      </div>
      <div class="panel" id="panel"></div>`;
    this.term = this.root.querySelector('#term');
    this.panel = this.root.querySelector('#panel');
    this.renderChips();
  }

  renderChips() {
    const t = this.root.querySelector('#aw-title');
    if (t) t.textContent = this.title || { 'claude-desktop': '新しいセッション', 'claude-mobile': 'Code', 'codex-vscode': this.sc.cwd || 'project', 'codex-app': this.sc.cwd || 'project' }[this.ui];
    const th = this.root.querySelector('#aw-threads');
    if (th) th.innerHTML = (this.chips.threads || '').split('|').filter(Boolean).map((x, k) => `<span class="aw-thread ${k === 0 ? 'on' : ''}">${esc(x)}</span>`).join('');
    const ed = this.root.querySelector('#aw-ed');
    if (ed && this.chips.editor) ed.textContent = this.chips.editor;
    const order = ['env', 'folder', 'repo', 'branch', 'where', 'mode', 'model', 'perm', 'context', 'worktree'];
    const icon = { env: '💻', folder: '📁', repo: '📦', branch: '⎇', where: '☁︎', mode: '◐', model: '✦', perm: '🛡', context: '📎', worktree: '🌿' };
    this.root.querySelector('#aw-chips').innerHTML = order.filter(k => this.chips[k]).map(k =>
      `<span class="aw-chip ${k === 'mode' ? 'mode' : ''}">${icon[k]} ${esc(this.chips[k])}${k === 'context' || k === 'worktree' ? '' : ' ▾'}</span>`).join('');
  }

  scroll() { this.term.scrollTop = this.term.scrollHeight; }

  add(html, cls = 'ln') {
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = html;
    this.term.appendChild(d);
    this.scroll();
    return d;
  }
  gap() { this.add('', 'gap'); }

  async typeInto(el, prefixHtml, text) {
    const sp = this.speed;
    if (!sp) { el.innerHTML = prefixHtml + esc(text); this.scroll(); return; }
    const per = Math.max(6, Math.min(28, 900 / Math.max(text.length, 1))) * sp;
    for (let k = 1; k <= text.length && this.alive; k += (text.length > 120 ? 3 : 1)) {
      el.innerHTML = prefixHtml + esc(text.slice(0, k)) + '<span class="dim">▌</span>';
      this.scroll();
      await sleep(per);
    }
    el.innerHTML = prefixHtml + esc(text);
    this.scroll();
  }

  async pause(ms) { if (this.speed) await sleep(ms * this.speed); }

  // 「次へ」などのボタンを待つ
  waitPanel(html, bind) {
    return new Promise(resolve => {
      this.panel.innerHTML = html;
      bind(this.panel, resolve);
      this.panel.scrollIntoView({ block: 'nearest' });
    });
  }
  waitNext(label = '次へ ▶') {
    return this.waitPanel(`<button class="btn primary block" id="nx">${label}</button>`, (p, done) => {
      p.querySelector('#nx').onclick = () => done();
    });
  }

  async run() {
    const steps = this.sc.steps;
    while (this.i < steps.length && this.alive) {
      const s = steps[this.i++];
      await this.step(s);
    }
    if (this.alive) this.finish();
  }

  async step(s) {
    const cl = this.tool === 'claude';
    switch (s.t) {
      case 'banner': return this.banner(s);
      case 'clear': this.term.innerHTML = ''; return;
      case 'mode': this.mode = s.mode; this.updateStatus(); return;
      case 'chips': Object.assign(this.chips, s.set || {}); if (s.title != null) this.title = s.title; this.renderChips(); await this.pause(200); return;
      case 'card': {
        this.add(`${s.title ? `<div class="aw-card-t">${fmtTerm(s.title)}</div>` : ''}${s.body ? `<div class="aw-card-b">${fmtTerm(s.body).replace(/\n/g, '<br>')}</div>` : ''}${s.buttons ? `<div class="aw-btns">${s.buttons.map((b, k) => `<span class="aw-btn ${k === 0 ? 'pri' : ''}">${esc(b)}</span>`).join('')}</div>` : ''}`, 'aw-card' + (s.cls ? ' ' + s.cls : ''));
        await this.pause(400);
        return;
      }
      case 'ctx': this.ctx = s.v; this.updateStatus(); return;
      case 'gap': this.gap(); return;
      case 'out': for (const l of [].concat(s.lines ?? s.text)) this.add(fmtTerm(l)); await this.pause(250); return;
      case 'note': {
        this.add(fmt(s.text).replace(/\n/g, '<br>'), 'coach');
        await this.waitNext();
        return;
      }
      case 'shell': {
        if (this.app && s.pane !== false) {
          await this.waitPanel(`<div class="small muted">ターミナルでコマンドを実行します</div>
          <div class="cmdinput" style="margin-top:6px"><input value="${esc(s.cmd)}" readonly><button class="btn primary" id="go">⏎ 実行</button></div>`,
          (p, done) => { p.querySelector('#go').onclick = done; });
          this.panel.innerHTML = '';
          this.add(`<div class="aw-card-t">⌨︎ ターミナル</div><div class="aw-term"><span class="g">$</span> ${esc(s.cmd)}${[].concat(s.out || []).map(l => '\n' + fmtTerm(l)).join('')}</div>`, 'aw-card');
          await this.pause(500);
          return;
        }
        const line = this.add('');
        await this.waitPanel(`<div class="small muted">ターミナル（シェル）でコマンドを実行します</div>
          <div class="cmdinput" style="margin-top:6px"><input value="${esc(s.cmd)}" readonly><button class="btn primary" id="go">⏎ 実行</button></div>`,
          (p, done) => { p.querySelector('#go').onclick = done; });
        this.panel.innerHTML = '';
        await this.typeInto(line, '<span class="g">$</span> ', s.cmd);
        await this.pause(350);
        for (const l of [].concat(s.out || [])) this.add(fmtTerm(l));
        await this.pause(300);
        return;
      }
      case 'user': {
        await this.waitPanel(`<div class="small muted">${cl ? 'Claude' : 'Codex'} への入力</div>
          <div class="cmdinput" style="margin-top:6px"><input value="${esc(s.text)}" readonly><button class="btn primary" id="go">⏎ 送信</button></div>`,
          (p, done) => { p.querySelector('#go').onclick = done; });
        this.panel.innerHTML = '';
        await this.userLine(s.text);
        return;
      }
      case 'think': {
        const verbs = cl ? ['Thinking…', 'Pondering…', 'Clauding…', 'Reticulating…', 'Synthesizing…'] : ['Working', 'Thinking', 'Exploring'];
        if (this.app) { const d0 = this.add(`<span class="aw-think">${esc(s.text || (cl ? '考え中…' : 'Thinking'))}</span>`); await this.pause(s.ms || 900); d0.remove(); return; }
        const d = this.add(`<span class="spin ${cl ? '' : 'cx'}">${esc(s.text || verbs[Math.floor(Math.random() * verbs.length)])}</span> <span class="dim">(esc to interrupt)</span>`);
        await this.pause(s.ms || 900);
        d.remove();
        return;
      }
      case 'say': {
        const d = this.add('', this.app ? 'aw-msg' : 'ln');
        const bullet = this.app ? '' : cl ? '<span class="cl">⏺</span> ' : '<span class="cx">•</span> ';
        await this.typeInto(d, bullet, s.text);
        await this.pause(200);
        return;
      }
      case 'tool': return this.toolStep(s);
      case 'todo': {
        const icon = { x: '[[g:☒]]', ' ': '☐', '>': '[[y:◼]]' };
        const lines = s.items.map(([st, t]) => `${icon[st]} ${st === 'x' ? `[[dim:${t}]]` : st === '>' ? `**${t}**` : t}`);
        if (this.app) {
          this.add(`<div class="aw-card-t">☑︎ ${cl ? 'To-dos' : 'Plan'}</div>${lines.map(l => `<div>${fmtTerm(l)}</div>`).join('')}`, 'aw-card');
        } else if (cl) {
          this.add(`<span class="cl">⏺</span> <b>Update Todos</b>`);
          lines.forEach((l, k) => this.add((k ? '     ' : '  ⎿  ') + fmtTerm(l)));
        } else {
          this.add(`<span class="cx">•</span> <b>Updated Plan</b>`);
          lines.forEach((l, k) => this.add((k ? '    ' : '  └ ') + fmtTerm(l)));
        }
        await this.pause(500);
        return;
      }
      case 'file': {
        this.add(`<div class="fname">${esc(s.name)}</div>${fmtTerm(s.body)}`, 'ln file');
        await this.pause(400);
        return;
      }
      case 'box': {
        this.add(fmtTerm(s.text), `ln box ${cl ? '' : 'cx'} ${s.warn ? 'warnbox' : ''}`);
        await this.pause(300);
        return;
      }
      case 'perm': return this.perm(s);
      case 'choice': return this.choice(s);
      case 'type': return this.typeStep(s);
      case 'key': return this.keyStep(s);
      case 'wait': await this.pause(s.ms || 600); return;
      default: console.warn('unknown step', s);
    }
  }

  async userLine(text) {
    const cl = this.tool === 'claude';
    if (this.app) {
      const inp = this.root.querySelector('#aw-input');
      const ph = inp.innerHTML;
      await this.typeInto(inp, '', text);
      await this.pause(150);
      inp.innerHTML = ph;
      this.add(esc(text).replace(/\n/g, '<br>'), 'aw-user');
      await this.pause(250);
      return;
    }
    this.gap();
    const d = this.add('', 'ln userline');
    await this.typeInto(d, cl ? '<span class="dim">&gt;</span> ' : '<span class="cx">›</span> ', text);
    this.gap();
    await this.pause(250);
  }

  banner(s) {
    if (this.app) {
      const msg = {
        'claude-desktop': ['✻', '何をしましょう？', 'フォルダを選んで、Claude に作業を依頼できます'],
        'claude-mobile': ['✻', 'Code', 'リポジトリを選んでクラウドで Claude に作業を依頼'],
        'codex-vscode': ['◎', 'Codex', '開いているファイルは自動で文脈に含まれます'],
        'codex-app': ['◎', '何を作りましょう？', this.sc.cwd ? `プロジェクト: ${this.sc.cwd}` : ''],
      }[this.ui];
      this.add(`<div class="aw-hello-i">${msg[0]}</div><div class="aw-hello-t">${esc(msg[1])}</div><div class="aw-hello-s">${esc(msg[2])}</div>`, 'aw-hello');
      return;
    }
    if (this.tool === 'claude') {
      this.add(`<span class="cl">✻</span> Welcome to <b>Claude Code</b>!\n\n  <span class="dim">/help for help, /status for your current setup</span>\n\n  <span class="dim">cwd: ${esc(s.cwd || this.sc.cwd || '~/project')}</span>`, 'ln box');
      if (s.tips !== false) this.add('<span class="dim"> Tips for getting started:\n  1. Run /init to create a CLAUDE.md file with instructions for Claude\n  2. Use Claude to help with file analysis, editing, bash commands and git\n  3. Be as specific as you would with another engineer for the best results</span>');
    } else {
      this.add(`<span class="cx">&gt;_</span> <b>OpenAI Codex</b>\n\n  <span class="dim">model:</span>     ${esc(s.model || 'gpt-5-codex')}   <span class="dim">/model to change</span>\n  <span class="dim">directory:</span> ${esc(s.cwd || this.sc.cwd || '~/project')}`, 'ln box cx');
      if (s.tips !== false) this.add('<span class="dim">  To get started, describe a task or try one of these commands:\n\n  /init - create an AGENTS.md file with instructions for Codex\n  /status - show current session configuration\n  /permissions - choose what Codex can do without approval\n  /model - choose what model and reasoning effort to use</span>');
    }
    this.gap();
  }

  async toolStep(s) {
    const cl = this.tool === 'claude';
    const outs = [].concat(s.out || []);
    if (this.app) {
      const ic = { Read: '📄', Search: '🔍', Bash: '⌨︎', Ran: '⌨︎', Write: '✎', Update: '✎', Edit: '✎', Edited: '✎', Explored: '🔍' }[s.name] || '⚙︎';
      this.add(`<div class="aw-tool-h"><span class="${s.fail ? 'r' : 'aw-ok'}">${ic}</span> <b>${esc(s.name)}</b> <span class="aw-arg">${esc(s.arg ?? '')}</span></div>${outs.filter(Boolean).length ? `<div class="aw-tool-o">${outs.map(fmtTerm).join('<br>')}</div>` : ''}`, 'aw-tool');
      await this.pause(s.ms || 400);
      if (s.diff) {
        this.add(s.diff.map(l => `<div class="${l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : ''}">${esc(l)}</div>`).join(''), 'aw-diff');
        await this.pause(300);
      }
      return;
    }
    if (cl) {
      const arg = s.arg != null ? `(${esc(s.arg)})` : '';
      this.add(`<span class="${s.fail ? 'r' : 'g'}">⏺</span> <b>${esc(s.name)}</b>${arg}`);
      await this.pause(s.ms || 450);
      outs.forEach((l, k) => this.add((k ? '     ' : '  ⎿  ') + fmtTerm(l)));
    } else {
      this.add(`<span class="cx">•</span> <b>${esc(s.name)}</b> ${s.arg != null ? `<span class="c">${esc(s.arg)}</span>` : ''}`);
      await this.pause(s.ms || 450);
      outs.forEach((l, k) => this.add((k ? '    ' : '  └ ') + fmtTerm(l)));
    }
    if (s.diff) {
      const html = s.diff.map(l => {
        const c = l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : '';
        return `<div class="${c}">${esc(l)}</div>`;
      }).join('');
      this.add(html, 'ln diff');
    }
    await this.pause(300);
  }

  // 権限確認ダイアログ
  async perm(s) {
    const cl = this.tool === 'claude';
    const opts = s.options || (cl
      ? [{ label: 'Yes', ok: true }, { label: `Yes, and don't ask again for ${s.always || 'this command'}`, ok: true }, { label: 'No, and tell Claude what to do differently (esc)', ok: false }]
      : [{ label: 'Yes, proceed', ok: true }, { label: "Yes, and don't ask again for this command", ok: true }, { label: 'No, and tell Codex what to do differently (esc)', ok: false }]);
    if (this.app) {
      const ao = s.options;
      const card = this.add(`<div class="aw-card-t">⚠︎ ${esc(s.kind || '許可が必要です')}</div><div class="aw-term">${fmtTerm(s.body)}</div>${s.desc ? `<div class="aw-card-b">${esc(s.desc)}</div>` : ''}<div class="aw-btns">${ao.map((o, k) => `<span class="aw-btn ${k === 0 ? 'pri' : ''}">${esc(o.label)}</span>`).join('')}</div>`, 'aw-card perm');
      await this.ask({ q: s.q || 'どれを押す？', options: ao });
      card.querySelector('.aw-btns').innerHTML = `<span class="aw-chosen">✓ ${esc(ao[this.lastChoice].label)}</span>`;
      return;
    }
    const head = cl ? `<b>${esc(s.kind || 'Bash command')}</b>` : `<b>${esc(s.kind || 'Would you like to run the following command?')}</b>`;
    const body = `${head}\n\n  ${fmtTerm(s.body)}\n${s.desc ? `  <span class="dim">${esc(s.desc)}</span>\n` : ''}\n${cl ? 'Do you want to proceed?' : ''}\n` +
      opts.map((o, k) => `${k === 0 ? '<span class="cl">❯</span>' : ' '} ${k + 1}. ${esc(o.label)}`).join('\n');
    const box = this.add(body, `ln box ${cl ? '' : 'cx'} warnbox`);
    await this.ask({ q: s.q || 'どれを選ぶ？', options: opts.map((o, k) => ({ ...o, label: `${k + 1}. ${o.label}` })), mono: true });
    box.remove();
    const chosen = this.lastChoice;
    this.add(`<span class="dim">  ⎿  ${esc(opts[chosen].label.replace(/\s*\(esc\)$/, ''))}</span>`);
  }

  async choice(s) {
    await this.ask(s);
    if (s.send) {
      const opt = s.options[this.lastChoice];
      await this.userLine(opt.text || opt.label);
    }
  }

  // 選択式の共通処理（最初の選択で正解なら得点）
  ask(s) {
    this.total++;
    let first = true;
    return this.waitPanel(`<div class="q">${fmt(s.q)}</div><div class="opts">${s.options.map((o, k) =>
      `<button class="opt ${s.mono ? 'mono' : ''}" data-k="${k}">${s.mono ? `<span class="mono">${esc(o.label)}</span>` : fmt(o.label)}</button>`).join('')}</div><div id="fb"></div>`,
    (p, done) => {
      p.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const k = +b.dataset.k, o = s.options[k];
        const fb = p.querySelector('#fb');
        if (o.ok !== false) {
          if (first) this.score++;
          b.classList.add('correct');
          p.querySelectorAll('.opt').forEach(x => x.disabled = true);
          fb.innerHTML = `<div class="fb ok">${first ? '⭕ ' : ''}${fmt(o.fb || 'OK！')}</div><button class="btn primary block" id="nx" style="margin-top:8px">続ける ▶</button>`;
          fb.querySelector('#nx').onclick = () => { this.lastChoice = k; done(); };
        } else {
          first = false;
          b.classList.add('wrong'); b.disabled = true;
          fb.innerHTML = `<div class="fb ng">❌ ${fmt(o.fb || 'もう一度考えてみよう。')}</div>`;
        }
      });
    });
  }

  // コマンドを入力させる
  typeStep(s) {
    this.total++;
    let miss = 0;
    const answers = [].concat(s.answer).map(a => a.toLowerCase().replace(/\s+/g, ' ').trim());
    return this.waitPanel(`<div class="q">${fmt(s.q)}</div>
      <div class="cmdinput"><input id="ci" placeholder="${esc(s.placeholder || 'ここに入力')}" autocapitalize="off" autocomplete="off" spellcheck="false"><button class="btn primary" id="go">⏎</button></div>
      <div class="chips" id="hint"></div><div id="fb"></div>`,
    (p, done) => {
      const inp = p.querySelector('#ci');
      const submit = async () => {
        const v = inp.value.toLowerCase().replace(/\s+/g, ' ').trim();
        if (answers.includes(v) || (s.match && new RegExp(s.match, 'i').test(inp.value.trim()))) {
          if (!miss) this.score++;
          const shown = inp.value.trim();
          this.panel.innerHTML = '';
          if (s.render !== false) {
            if (s.shell) { const l = this.add(''); await this.typeInto(l, '<span class="g">$</span> ', shown); }
            else await this.userLine(shown);
          }
          if (s.fb) this.add(fmt(s.fb), 'coach');
          done();
        } else {
          miss++;
          p.querySelector('#fb').innerHTML = `<div class="fb ng">❌ ${fmt(s.wrong || '違うようです。')}${miss >= 1 ? ' 下のヒントをタップすると入力されます。' : ''}</div>`;
          p.querySelector('#hint').innerHTML = `<button class="chip" id="h">${esc(s.hint || [].concat(s.answer)[0])}</button>`;
          p.querySelector('#h').onclick = () => { inp.value = s.hint || [].concat(s.answer)[0]; inp.focus(); };
        }
      };
      p.querySelector('#go').onclick = submit;
      inp.onkeydown = e => { if (e.key === 'Enter') submit(); };
      // 補完候補（スラッシュコマンドを打つと候補が出る再現）
      if (s.suggest) inp.oninput = () => {
        const v = inp.value;
        const list = s.suggest.filter(x => v && x[0].startsWith(v)).slice(0, 6);
        p.querySelector('#hint').innerHTML = list.map(([c, d]) => `<button class="chip" data-c="${esc(c)}"><b class="mono">${esc(c)}</b> <span class="muted">${esc(d)}</span></button>`).join('');
        p.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { inp.value = b.dataset.c; inp.focus(); });
      };
    });
  }

  // キー操作（Shift+Tab など）
  keyStep(s) {
    this.total++;
    let miss = 0, pressed = 0;
    const keys = shuffle([s.key, ...(s.distract || ['Esc', 'Tab', 'Ctrl+C'])]);
    return this.waitPanel(`<div class="q">${fmt(s.q)}</div><div class="keys">${keys.map(k => `<button class="kbd" data-k="${esc(k)}">${esc(k)}</button>`).join('')}</div><div id="fb"></div>`,
      (p, done) => {
        p.querySelectorAll('.kbd').forEach(b => b.onclick = async () => {
          const fb = p.querySelector('#fb');
          if (b.dataset.k !== s.key) {
            miss++;
            fb.innerHTML = `<div class="fb ng">❌ ${fmt((s.wrongFb && s.wrongFb[b.dataset.k]) || 'そのキーではありません。')}</div>`;
            p.querySelector(`[data-k="${CSS.escape(s.key)}"]`).classList.add('hint');
            return;
          }
          if (s.modes) { this.mode = s.modes[pressed]; this.updateStatus(); }
          if (s.chips) { Object.assign(this.chips, s.chips[pressed] || {}); this.renderChips(); }
          pressed++;
          if (pressed < (s.times || 1)) { fb.innerHTML = `<div class="fb">あと ${(s.times || 1) - pressed} 回…（ステータス行の表示が変わったのを確認）</div>`; return; }
          if (!miss) this.score++;
          fb.innerHTML = `<div class="fb ok">⭕ ${fmt(s.fb || 'OK！')}</div><button class="btn primary block" id="nx" style="margin-top:8px">続ける ▶</button>`;
          p.querySelectorAll('.kbd').forEach(x => x.disabled = true);
          p.querySelector('#nx').onclick = () => done();
        });
      });
  }

  finish() {
    const st = getState();
    const prev = st.sims[this.sc.id];
    st.sims[this.sc.id] = { done: true, score: Math.max(this.score, prev?.score || 0), total: this.total, ts: Date.now() };
    save();
    logActivity('sim', this.sc.id);
    const learn = (this.sc.learn || []).map(l => `<li>${fmt(l)}</li>`).join('');
    this.panel.innerHTML = `<div class="q">🎉 シナリオ完了！</div>
      ${this.total ? `<div>正解（1回目で）: <b>${this.score} / ${this.total}</b></div>` : ''}
      ${learn ? `<h3>このシナリオで覚えること</h3><ul class="small">${learn}</ul>` : ''}
      <div class="btn-row"><button class="btn" id="again">もう一度</button><a class="btn primary" href="#/lab">シナリオ一覧へ</a>${this.onFinish ? '<button class="btn blue" id="nextsc">次のシナリオ ▶</button>' : ''}</div>`;
    this.panel.querySelector('#again').onclick = () => { this.i = 0; this.score = 0; this.total = 0; this.mode = this.sc.mode || 'default'; this.ctx = this.sc.ctx ?? 100; this.chips = { ...(this.sc.chips || {}) }; this.title = this.sc.session || ''; this.render(); this.run(); };
    const n = this.panel.querySelector('#nextsc');
    if (n) n.onclick = () => this.onFinish();
  }

  destroy() { this.alive = false; }
}

function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
