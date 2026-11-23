// （任意機能）AI を使う機能：Python の AI 先生、Day31〜100 のレッスン生成、本物のエージェント体験
// AI は Claude（Anthropic）か OpenAI を設定画面で選ぶ。API キーはこの端末の localStorage にのみ保存され、
// 選んだ会社の API へ直接送信されます。
import { getState, save } from './store.js';

// ---------- モデル・料金 ----------
const ANTHROPIC_SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.2.0/+esm';
export const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5（高品質・推奨）' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5（約半額）' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5（最安・高速）' },
];
const CLAUDE_DEFAULT = 'claude-opus-5-5';
// Claude の単価（USD / 100万トークン：入力, 出力）
const CLAUDE_PRICES = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.10, 0.50] };

// OpenAI の候補（参考）。実際に使えるモデルは設定画面の「一覧を取得」でキーに応じた最新一覧に置き換わる
export const OPENAI_SUGGESTED = ['gpt-6.1-sol', 'gpt-6-luna', 'gpt-6-astra', 'gpt-5.6-terra', 'gpt-5.6-luna'];
export const OPENAI_DEFAULT = 'gpt-6.1-sol';

// 使う AI：'anthropic' | 'openai' | null（未設定）
export function provider(s = getState().settings) {
  if (s.aiProvider === 'none') return null;
  if (s.aiProvider === 'anthropic') return s.apiKey ? 'anthropic' : null;
  if (s.aiProvider === 'openai') return s.openaiKey ? 'openai' : null;
  return s.openaiKey ? 'openai' : s.apiKey ? 'anthropic' : null;   // 未選択なら入っているキーから判断
}
export const hasKey = () => !!provider();
export function currentModel(s = getState().settings) {
  const p = provider(s);
  if (p === 'anthropic') return s.claudeModel || CLAUDE_DEFAULT;
  if (p === 'openai') return (s.openaiModel || OPENAI_DEFAULT).trim();
  return '';
}
export const providerName = p => (p || provider()) === 'anthropic' ? 'Claude' : 'OpenAI';

// 1回の利用の推定金額（単価不明なら null）
export function costOf(u) {
  const s = getState().settings;
  if (u.provider === 'anthropic') {
    const p = CLAUDE_PRICES[u.model];
    return p ? (u.in * p[0] + u.out * p[1]) / 1e6 : null;
  }
  if (s.openaiPriceIn === '' || s.openaiPriceOut === '' || s.openaiPriceIn == null || s.openaiPriceOut == null) return null;
  return (u.in * +s.openaiPriceIn + u.out * +s.openaiPriceOut) / 1e6;
}
export function usageSummary(list = getState().aiUsage || []) {
  let usd = 0, unknown = false;
  const sum = list.reduce((a, u) => ({ n: a.n + 1, in: a.in + u.in, out: a.out + u.out }), { n: 0, in: 0, out: 0 });
  for (const u of list) { const c = costOf(u); if (c == null) unknown = true; else usd += c; }
  return { ...sum, usd, unknown };
}
function recordUsage(prov, model, inTok, outTok) {
  const st = getState();
  st.aiUsage.push({ ts: Date.now(), provider: prov, model, in: inTok || 0, out: outTok || 0 });
  if (st.aiUsage.length > 3000) st.aiUsage = st.aiUsage.slice(-3000);
  save();
}

// ---------- OpenAI（Responses API） ----------
export async function listModels(key) {
  const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`取得に失敗しました (${res.status}): ${data.error?.message || ''}`);
  return (data.data || [])
    .filter(m => /^(gpt|o\d|chatgpt)/.test(m.id) && !/(audio|realtime|tts|transcribe|image|search|embedding|instruct|computer)/.test(m.id))
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .map(m => ({ id: m.id, date: m.created ? new Date(m.created * 1000).toISOString().slice(0, 10) : '' }));
}

async function openaiRespond(body, signal) {
  const s = getState().settings;
  const model = currentModel(s);
  let res, data;
  try {
    res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.openaiKey}` },
      body: JSON.stringify({ model, ...body }),
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error('通信できませんでした。ネット接続を確認してください。');
  }
  if (!res.ok) {
    const msg = data.error?.message || res.statusText;
    let hint = '';
    if (res.status === 401) hint = '\nAPI キーが正しくありません。設定画面で確認してください。';
    else if (res.status === 429) hint = '\n利用制限または残高不足です。少し待つか、OpenAI の Billing を確認してください。';
    else if (/model/i.test(msg) && /(not exist|not found|does not have access|invalid)/i.test(msg)) hint = `\nモデル「${model}」が使えません。設定画面の「使えるモデル一覧を取得」から選び直してください。`;
    throw new Error(`OpenAI API エラー (${res.status}): ${msg}${hint}`);
  }
  recordUsage('openai', data.model || model, data.usage?.input_tokens, data.usage?.output_tokens);
  return data;
}
const oaText = data => (data.output || []).filter(o => o.type === 'message').flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('');
const oaRefusal = data => (data.output || []).flatMap(o => o.content || []).find(c => c.type === 'refusal');

// ---------- Claude（Anthropic SDK） ----------
let clientP = null;
async function claudeClient() {
  const key = getState().settings.apiKey;
  if (!clientP || clientP.key !== key) {
    const p = import(ANTHROPIC_SDK_URL).then(mod => {
      const Anthropic = mod.default || mod.Anthropic;
      // 個人利用のアプリなのでブラウザから直接呼び出す（キーは自分の端末内のみ）
      return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    });
    p.key = key;
    clientP = p;
  }
  return clientP;
}
async function claudeCreate(params, signal) {
  const c = await claudeClient();
  const model = currentModel();
  const body = { model, ...params };
  try {
    // 安全性判定で断られたとき別モデルで自動再試行（Haiku は非対応のため通常呼び出し）
    const resp = model.includes('haiku')
      ? await c.messages.create(body, { signal })
      : await c.beta.messages.create({ ...body, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { signal });
    const u = resp.usage || {};
    recordUsage('anthropic', model, (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), u.output_tokens);
    return resp;
  } catch (e) {
    if (signal?.aborted) throw e;
    const m = String(e?.message || e);
    if (/401|authentication|invalid x-api-key/i.test(m)) throw new Error('Anthropic API キーが正しくありません。設定画面で確認してください。');
    if (/credit|billing|balance/i.test(m)) throw new Error('API のクレジット残高が不足しています（Anthropic Console で確認）。');
    if (/429|rate/i.test(m)) throw new Error('利用制限に達しました。少し待ってから再試行してください。');
    if (/fetch|network|Failed to/i.test(m)) throw new Error('通信できませんでした。ネット接続を確認してください。');
    throw new Error('Claude API エラー: ' + m);
  }
}
const clText = resp => resp.content.filter(b => b.type === 'text').map(b => b.text).join('');

function need() {
  const p = provider();
  if (!p) throw new Error('設定画面で使用する AI と API キーを設定してください。');
  return p;
}

// ---------- Python の AI 先生 ----------
const TUTOR_SYSTEM = `あなたは日本語で教える、やさしく的確な Python の先生です。受講者はスマホで「100日で学ぶ Python」を進めている初心者です。
- 説明は短く具体的に。専門用語には一言説明を添える。
- コードは \`\`\`python のコードブロックで示す。スマホで読むので1行を短めに。
- ブラウザで動く Python（Pyodide）を使っているため、tkinter やネットワーク通信、リアルタイムのキー入力は使えない。`;

export async function tutor(kind, { exercise, code, result, question, history = [] }) {
  const p = need();
  const task = {
    hint: '受講者は行き詰まっています。**答えのコードは書かずに**、次の一歩が分かるヒントを2〜3段階で出してください（最初は軽いヒント、最後は具体的に）。',
    error: '実行結果のエラーを、初心者向けに「何が起きたか」「どこを直すか」の順で説明してください。修正後のコードは該当部分だけ示す。',
    review: '受講者のコードは正解しました。良い点を1つ褒め、より読みやすく・Python らしくする改善点を2〜3個、短いコード例つきで提案してください。',
    ask: '受講者の質問に答えてください。',
  }[kind];
  const ctx = [
    exercise ? `## 課題: ${exercise.title}\n${exercise.prompt}` : '',
    code != null ? `## 受講者のコード\n\`\`\`python\n${code}\n\`\`\`` : '',
    result ? `## 実行結果\n\`\`\`\n${(result || '').slice(0, 3000)}\n\`\`\`` : '',
  ].filter(Boolean).join('\n\n');
  // 履歴は {role, content: 文字列} の形にそろえる（どちらの AI でも使える）
  const msgs = [...history, { role: 'user', content: `${task}\n\n${ctx}${question ? `\n\n## 質問\n${question}` : ''}` }];
  let text;
  if (p === 'anthropic') {
    const resp = await claudeCreate({ max_tokens: 4000, output_config: { effort: 'low' }, system: TUTOR_SYSTEM, messages: msgs });
    if (resp.stop_reason === 'refusal') throw new Error('回答できない内容でした。質問を変えてみてください。');
    text = clText(resp);
  } else {
    const data = await openaiRespond({ instructions: TUTOR_SYSTEM, input: msgs });
    const r = oaRefusal(data);
    if (r) throw new Error('回答できない内容でした: ' + r.refusal);
    text = oaText(data);
  }
  return { text, messages: [...msgs, { role: 'assistant', content: text }] };
}

// ---------- Day 31〜100 のレッスン生成 ----------
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const str = { type: 'string' };
const arr = items => ({ type: 'array', items });
const CHECK_SCHEMA = arr(obj({ q: str, choices: arr(str), answer: { type: 'integer' }, exp: str }));
const DAY_SCHEMA = obj({
  title: str, goal: str, image: str, lesson: str, pitfalls: str, check: CHECK_SCHEMA,
  exercises: arr(obj({
    title: str, prompt: str, steps: str, starter: str, solution: str, hint: str,
    tests: arr(obj({ name: str, inputs: arr(str), check: str })),
  })),
});
const DAY_SYSTEM = `あなたは「100日で学ぶ Python」コースの教材作成者です。日本語で、オリジナルの教材を作ります（市販の講座の内容を複製しない）。
受講者はスマホのブラウザで Python（Pyodide, Python 3.12）を実行します。制約:
- 使えないもの: tkinter / turtle のキー入力やアニメーション / ネットワーク通信（requests 等）/ Selenium / Flask サーバーの起動 / smtplib の送信
- 使えるもの: 標準ライブラリ、numpy, pandas, matplotlib（plt.show() で画像表示）, bs4, sqlite3, scipy, PIL
- API や Web が題材の日は、レスポンスの JSON や HTML を文字列として用意して「疑似体験」させ、PC での本番の書き方も lesson で示す
- Web サーバー（Flask）が題材の日は、デコレーターやルーティングの仕組みを自作の小さな関数で再現する演習にする

受講者は初心者で「説明が足りないまま演習に進んでしまう」ことが多いので、演習の前に理解できるよう、ていねいに説明してください。

出力仕様:
- image: この日に学ぶことを、身近なたとえで3〜6行で説明する導入（簡易マークダウン）。「なぜ必要か」「何ができるようになるか」を書く。
- lesson: くわしい解説（簡易マークダウン：### 見出し、- 箇条書き、\`\`\`python コード\`\`\`、> ヒント、表は | 区切り）。2000〜3500字。
  - 見出しで5〜7個の小さなステップに分け、1ステップに新しいことは1つだけ。
  - 各コード例のすぐ後に「▶ 実行結果」として \`\`\` で出力を示す。
  - 新しい書き方は、コードの各部分が何をしているかを言葉で説明する。ループや状態が変わる例は、変数の値の変化を表（| 区切り）で追う。
  - 演習で使う書き方は、必ずこの解説の中で一度は例を見せる。
- pitfalls: つまずきやすい点・よくあるエラーを4〜6個の箇条書きで（エラー名・原因・直し方）。
- check: 理解度チェックの4択問題を3個。choices は4つ、answer は正解の選択肢の番号（0始まり）、exp は正解の理由。コードの実行結果を問う問題を1つ以上含める。
- exercises: 2〜3個。starter は書き始めのコード、solution は模範解答（starter を完成させたもの）。
  - steps: 答えのコードは書かずに、考え方の手順を 3〜5 個の番号付きリストで（何をどの順に書くか）。
- tests: 各演習 1〜4個。check は Python コード。assert 文に日本語の失敗メッセージを付ける。変数 __out__（標準出力全体の文字列）、__lines__（出力の行リスト）、__code_src__（受講者のコード）と、受講者コードで定義した関数・変数が使える。inputs は input() に順に与える文字列。プログラムが input() を呼ぶなら、どのテストにも十分な inputs を与えること（関数だけを確かめるテストでも、トップレベルのコードが input を呼ぶならその分が必要）。
- テストは solution で必ず通り、starter では失敗するように。乱数を使う場合は結果に依存しない検証にする（random.seed(1) は実行前に設定済み）。`;

export async function generateDay(info, prevTitles) {
  const p = need();
  const prompt = `Day ${info.day}: ${info.title}\n扱う内容: ${info.topics}\nブラウザでの扱い: ${{ ok: 'そのまま実行できる', sim: 'データを用意して疑似体験', pc: 'PC での実践が前提。ブラウザでは仕組みを理解する演習にする' }[info.browser]}\n\nこれまでの日のタイトル: ${prevTitles.join(' / ')}`;
  let text;
  if (p === 'anthropic') {
    const resp = await claudeCreate({
      max_tokens: 16000, output_config: { effort: 'medium', format: { type: 'json_schema', schema: DAY_SCHEMA } },
      system: DAY_SYSTEM, messages: [{ role: 'user', content: prompt }],
    });
    if (resp.stop_reason === 'refusal') throw new Error('生成できませんでした。もう一度お試しください。');
    if (resp.stop_reason === 'max_tokens') throw new Error('出力が長すぎて途中で切れました。再試行してください。');
    text = clText(resp);
  } else {
    const data = await openaiRespond({
      instructions: DAY_SYSTEM, input: prompt,
      text: { format: { type: 'json_schema', name: 'lesson', strict: true, schema: DAY_SCHEMA } },
    });
    if (data.status === 'incomplete') throw new Error('出力が途中で切れました。再試行してください。');
    const r = oaRefusal(data);
    if (r) throw new Error('生成できませんでした: ' + r.refusal);
    text = oaText(data);
  }
  const day = JSON.parse(text || '{}');
  day.exercises.forEach((ex, i) => { ex.id = `ai${info.day}-${i + 1}`; });
  day.check = (day.check || []).map(q => ({ q: q.q, choices: q.choices, a: q.answer, exp: q.exp }));
  return day;
}

// ---------- 既存のレッスンの解説を詳しくする（演習・記録はそのまま） ----------
const EXPLAIN_SCHEMA = obj({ image: str, detail: str, pitfalls: str, check: CHECK_SCHEMA, steps: arr(obj({ id: str, steps: str })) });
export async function generateExplain(info) {
  const sys = DAY_SYSTEM.split('出力仕様:')[0] + `次のレッスンは説明が短く、受講者が理解しないまま演習に進んでしまいます。演習の内容は変えずに、解説だけを詳しく書き直してください。
- image: 身近なたとえで3〜6行の導入
- detail: くわしい解説 2000〜3500字（5〜7個の小さなステップ、各コード例の後に「▶ 実行結果」、変数の変化は表で追う、演習で使う書き方は必ず例を見せる）
- pitfalls: つまずきやすい点を4〜6個の箇条書き
- check: 4択の理解度チェックを3問（answer は正解の番号、0始まり）
- steps: 各演習（id で指定）について、答えのコードを書かずに考え方の手順を3〜5個の番号付きリストで`;
  const prompt = `Day ${info.day}: ${info.title}\nねらい: ${info.goal}\n\n## 元の解説\n${info.lesson}\n\n## 演習\n${info.exercises.map(e => `### id: ${e.id}　${e.title}\n${e.prompt}`).join('\n\n')}`;
  const p = need();
  let text;
  if (p === 'anthropic') {
    const resp = await claudeCreate({ max_tokens: 16000, output_config: { effort: 'medium', format: { type: 'json_schema', schema: EXPLAIN_SCHEMA } }, system: sys, messages: [{ role: 'user', content: prompt }] });
    if (resp.stop_reason === 'refusal' || resp.stop_reason === 'max_tokens') throw new Error('作成できませんでした。もう一度お試しください。');
    text = clText(resp);
  } else {
    const data = await openaiRespond({ instructions: sys, input: prompt, text: { format: { type: 'json_schema', name: 'explain', strict: true, schema: EXPLAIN_SCHEMA } } });
    if (data.status === 'incomplete') throw new Error('出力が途中で切れました。再試行してください。');
    text = oaText(data);
  }
  const r = JSON.parse(text || '{}');
  return { image: r.image, detail: r.detail, pitfalls: r.pitfalls, check: (r.check || []).map(q => ({ q: q.q, choices: q.choices, a: q.answer, exp: q.exp })), steps: Object.fromEntries((r.steps || []).map(x => [x.id, x.steps])) };
}

// ---------- レッスンについて AI に質問 ----------
export async function askLesson({ day, title, text, question, history = [] }) {
  const p = need();
  const msgs = [...history, { role: 'user', content: `${history.length ? '' : `## Day ${day}: ${title}\n${String(text).slice(0, 6000)}\n\n`}## 質問\n${question}` }];
  let out;
  if (p === 'anthropic') {
    const resp = await claudeCreate({ max_tokens: 4000, output_config: { effort: 'low' }, system: TUTOR_SYSTEM + '\n- 受講者は上のレッスンを読んでいる途中です。レッスンの内容に沿って、たとえや小さなコード例と実行結果を使って、かみくだいて説明してください。', messages: msgs });
    if (resp.stop_reason === 'refusal') throw new Error('回答できない内容でした。質問を変えてみてください。');
    out = clText(resp);
  } else {
    const data = await openaiRespond({ instructions: TUTOR_SYSTEM + '\n- 受講者は上のレッスンを読んでいる途中です。レッスンの内容に沿って、たとえや小さなコード例と実行結果を使って、かみくだいて説明してください。', input: msgs });
    out = oaText(data);
  }
  return { text: out, messages: [...msgs, { role: 'assistant', content: out }] };
}

// ---------- 本物のエージェント体験（Claude Code / Codex 風） ----------
const TOOL_DEFS = [
  ['list_files', 'プロジェクト内のファイル一覧（パスと行数）を返す。', {}],
  ['read_file', 'ファイルの内容を行番号付きで読む。', { path: { type: 'string', description: 'プロジェクトルートからの相対パス' } }],
  ['search', 'すべてのファイルから正規表現で検索し、該当行を「パス:行番号: 内容」で返す。', { pattern: str }],
  ['write_file', '新しいファイルを作る、またはファイル全体を書き換える（ユーザーの承認が必要）。', { path: str, content: str }],
  ['edit_file', 'ファイル内の old_str（ファイル中で1回だけ出現する文字列）を new_str に置換する（ユーザーの承認が必要）。小さな変更はこちらを使う。', { path: str, old_str: str, new_str: str }],
  ['run_python', 'Python ファイルを実行して標準出力を返す（ユーザーの承認が必要）。input() を使うプログラムは stdin に改行区切りで入力を与える。', { path: str, stdin: { type: 'string', description: 'input() に与える行（改行区切り）。不要なら空文字' } }],
  ['run_tests', 'tests/ や test_*.py のテスト（test_ で始まる関数）をすべて実行し、pytest 風の結果を返す。', {}],
];
const OPENAI_TOOLS = TOOL_DEFS.map(([name, description, props]) => ({ type: 'function', name, description, strict: true, parameters: obj(props) }));
const CLAUDE_TOOLS = TOOL_DEFS.map(([name, description, props]) => ({ name, description, strict: true, input_schema: obj(props) }));

const AGENT_SYSTEM = `あなたは Claude Code や Codex のようなコーディングエージェントです。ユーザーはスマホから、ブラウザ内の仮想 Python プロジェクトで「AI エージェントとの開発」を体験しています。
- 日本語で、短く要点だけ話す。ツールを使う前に何をするか一言添える。
- まず list_files / read_file / search で調べてから変更する。推測で書き換えない。
- 変更は edit_file を優先（小さな差分）。新規ファイルや全面書き換えのみ write_file。
- 変更後は run_tests や run_python で必ず検証し、結果を報告する。
- 実行環境はブラウザ内の Python（Pyodide）。ネットワーク・pip install・tkinter は使えない。
- ユーザーが変更を拒否したら、理由を考えて別の方法を提案する。
- 最後に「何をしたか」を2〜4行でまとめる。
- AGENTS.md や CLAUDE.md があればプロジェクトのルールとして従う。`;

// 1ターン分のエージェントループ。items は会話履歴（使う AI ごとの形式）
export async function agentTurn(items, opts) {
  return need() === 'anthropic' ? claudeAgentTurn(items, opts) : openaiAgentTurn(items, opts);
}

async function openaiAgentTurn(items, { execTool, onText, signal, maxSteps = 25 }) {
  let steps = 0;
  while (steps++ < maxSteps) {
    let data;
    try {
      data = await openaiRespond({ instructions: AGENT_SYSTEM, tools: OPENAI_TOOLS, input: items }, signal);
    } catch (e) {
      if (signal?.aborted) return { stopped: true };
      throw e;
    }
    const out = data.output || [];
    items.push(...out);
    for (const o of out) {
      if (o.type === 'message') {
        const t = (o.content || []).map(c => c.type === 'output_text' ? c.text : c.type === 'refusal' ? '（対応できませんでした）' + c.refusal : '').join('').trim();
        if (t) onText(t);
      }
    }
    const calls = out.filter(o => o.type === 'function_call');
    if (data.status === 'incomplete') { onText('（出力が上限に達しました。「続けて」と送ると再開します）'); return { done: true }; }
    if (!calls.length) return { done: true };
    for (const c of calls) {
      if (signal?.aborted) { items.push({ type: 'function_call_output', call_id: c.call_id, output: 'ユーザーが中断しました。' }); continue; }
      let args = {};
      try { args = JSON.parse(c.arguments || '{}'); } catch { items.push({ type: 'function_call_output', call_id: c.call_id, output: '引数の JSON が不正です' }); continue; }
      const r = await execTool(c.name, args);
      items.push({ type: 'function_call_output', call_id: c.call_id, output: (r.isError ? 'エラー: ' : '') + String(r.content).slice(0, 20000) });
    }
    if (signal?.aborted) return { stopped: true };
  }
  onText('（ステップ数の上限に達したため一旦止めました。「続けて」と送ると再開します）');
  return { done: true };
}

async function claudeAgentTurn(messages, { execTool, onText, signal, maxSteps = 25 }) {
  let steps = 0;
  while (steps++ < maxSteps) {
    let resp;
    try {
      resp = await claudeCreate({ max_tokens: 16000, output_config: { effort: 'medium' }, system: AGENT_SYSTEM, tools: CLAUDE_TOOLS, messages }, signal);
    } catch (e) {
      if (signal?.aborted) return { stopped: true };
      throw e;
    }
    messages.push({ role: 'assistant', content: resp.content });
    for (const b of resp.content) if (b.type === 'text' && b.text.trim()) onText(b.text);
    if (resp.stop_reason === 'refusal') { onText('（この依頼には対応できませんでした）'); return { done: true }; }
    if (resp.stop_reason === 'max_tokens') { onText('（出力が上限に達しました。「続けて」と送ると再開します）'); return { done: true }; }
    if (resp.stop_reason !== 'tool_use') return { done: true };
    const results = [];
    for (const b of resp.content.filter(b => b.type === 'tool_use')) {
      if (signal?.aborted) { results.push({ type: 'tool_result', tool_use_id: b.id, content: 'ユーザーが中断しました。', is_error: true }); continue; }
      const r = await execTool(b.name, b.input || {});
      results.push({ type: 'tool_result', tool_use_id: b.id, content: String(r.content).slice(0, 20000), ...(r.isError ? { is_error: true } : {}) });
    }
    messages.push({ role: 'user', content: results });
    if (signal?.aborted) return { stopped: true };
  }
  onText('（ステップ数の上限に達したため一旦止めました。「続けて」と送ると再開します）');
  return { done: true };
}
