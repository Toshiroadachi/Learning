// （任意機能）OpenAI API を使う機能：Python の AI 先生、Day31〜100 のレッスン生成、本物のエージェント体験
// API キーはこの端末の localStorage にのみ保存され、OpenAI の API へ直接送信されます。
import { getState, save } from './store.js';

export const OPENAI_SUGGESTED = ['gpt-6.1-sol', 'gpt-6-luna', 'gpt-6-astra', 'gpt-5.6-terra', 'gpt-5.6-luna'];
export const OPENAI_DEFAULT = 'gpt-6.1-sol';

export const hasKey = () => !!getState().settings.openaiKey;
export const currentModel = () => (getState().settings.openaiModel || OPENAI_DEFAULT).trim();

// 単価（任意設定、USD / 100万トークン）
export function costOf(u) {
  const s = getState().settings;
  if (s.openaiPriceIn === '' || s.openaiPriceOut === '' || s.openaiPriceIn == null || s.openaiPriceOut == null) return null;
  return (u.in * +s.openaiPriceIn + u.out * +s.openaiPriceOut) / 1e6;
}
export function usageSummary() {
  const list = getState().aiUsage || [];
  let usd = 0, unknown = false;
  const sum = list.reduce((a, u) => ({ n: a.n + 1, in: a.in + u.in, out: a.out + u.out }), { n: 0, in: 0, out: 0 });
  for (const u of list) { const c = costOf(u); if (c == null) unknown = true; else usd += c; }
  return { ...sum, usd: unknown ? null : usd };
}
function recordUsage(model, usage) {
  const st = getState();
  st.aiUsage.push({ ts: Date.now(), model, in: usage?.input_tokens || 0, out: usage?.output_tokens || 0 });
  if (st.aiUsage.length > 3000) st.aiUsage = st.aiUsage.slice(-3000);
  save();
}

// このキーで使えるテキスト生成モデルの一覧（新しい順）
export async function listModels(key) {
  const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`取得に失敗しました (${res.status}): ${data.error?.message || ''}`);
  return (data.data || [])
    .filter(m => /^(gpt|o\d|chatgpt)/.test(m.id) && !/(audio|realtime|tts|transcribe|image|search|embedding|instruct|computer)/.test(m.id))
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .map(m => m.id);
}

// Responses API を呼ぶ
async function respond(body, signal) {
  const key = getState().settings.openaiKey;
  if (!key) throw new Error('設定画面で OpenAI の API キーを入力してください。');
  const model = currentModel();
  let res, data;
  try {
    res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
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
  recordUsage(data.model || model, data.usage);
  return data;
}
const outputText = data => (data.output || []).filter(o => o.type === 'message').flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('');
const refusalOf = data => (data.output || []).flatMap(o => o.content || []).find(c => c.type === 'refusal');

// ---------- Python の AI 先生 ----------
const TUTOR_SYSTEM = `あなたは日本語で教える、やさしく的確な Python の先生です。受講者はスマホで「100日で学ぶ Python」を進めている初心者です。
- 説明は短く具体的に。専門用語には一言説明を添える。
- コードは \`\`\`python のコードブロックで示す。スマホで読むので1行を短めに。
- ブラウザで動く Python（Pyodide）を使っているため、tkinter やネットワーク通信、リアルタイムのキー入力は使えない。`;

export async function tutor(kind, { exercise, code, result, question, history = [] }) {
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
  const input = [...history, { role: 'user', content: `${task}\n\n${ctx}${question ? `\n\n## 質問\n${question}` : ''}` }];
  const data = await respond({ instructions: TUTOR_SYSTEM, input });
  const r = refusalOf(data);
  if (r) throw new Error('回答できない内容でした: ' + r.refusal);
  const text = outputText(data);
  return { text, messages: [...input, { role: 'assistant', content: text }] };
}

// ---------- Day 31〜100 のレッスン生成 ----------
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const str = { type: 'string' };
const arr = items => ({ type: 'array', items });
const DAY_SCHEMA = obj({
  title: str, goal: str, lesson: str,
  exercises: arr(obj({
    title: str, prompt: str, starter: str, solution: str, hint: str,
    tests: arr(obj({ name: str, inputs: arr(str), check: str })),
  })),
});

export async function generateDay(info, prevTitles) {
  const system = `あなたは「100日で学ぶ Python」コースの教材作成者です。日本語で、オリジナルの教材を作ります（市販の講座の内容を複製しない）。
受講者はスマホのブラウザで Python（Pyodide, Python 3.12）を実行します。制約:
- 使えないもの: tkinter / turtle のキー入力やアニメーション / ネットワーク通信（requests 等）/ Selenium / Flask サーバーの起動 / smtplib の送信
- 使えるもの: 標準ライブラリ、numpy, pandas, matplotlib（plt.show() で画像表示）, bs4, sqlite3, scipy, PIL
- API や Web が題材の日は、レスポンスの JSON や HTML を文字列として用意して「疑似体験」させ、PC での本番の書き方も lesson で示す
- Web サーバー（Flask）が題材の日は、デコレーターやルーティングの仕組みを自作の小さな関数で再現する演習にする

出力仕様:
- lesson: 簡易マークダウン（### 見出し、- 箇条書き、\`\`\`python コード\`\`\`、> ヒント、表は | 区切り）。800〜1800字。
- exercises: 2〜3個。starter は書き始めのコード、solution は模範解答（starter を完成させたもの）。
- tests: 各演習 1〜4個。check は Python コード。assert 文に日本語の失敗メッセージを付ける。変数 __out__（標準出力全体の文字列）、__lines__（出力の行リスト）、__code_src__（受講者のコード）と、受講者コードで定義した関数・変数が使える。inputs は input() に順に与える文字列。プログラムが input() を呼ぶなら、どのテストにも十分な inputs を与えること（関数だけを確かめるテストでも、トップレベルのコードが input を呼ぶならその分が必要）。
- テストは solution で必ず通り、starter では失敗するように。乱数を使う場合は結果に依存しない検証にする（random.seed(1) は実行前に設定済み）。`;
  const prompt = `Day ${info.day}: ${info.title}\n扱う内容: ${info.topics}\nブラウザでの扱い: ${{ ok: 'そのまま実行できる', sim: 'データを用意して疑似体験', pc: 'PC での実践が前提。ブラウザでは仕組みを理解する演習にする' }[info.browser]}\n\nこれまでの日のタイトル: ${prevTitles.join(' / ')}`;
  const data = await respond({
    instructions: system, input: prompt,
    text: { format: { type: 'json_schema', name: 'lesson', strict: true, schema: DAY_SCHEMA } },
  });
  if (data.status === 'incomplete') throw new Error('出力が途中で切れました。再試行してください。');
  const r = refusalOf(data);
  if (r) throw new Error('生成できませんでした: ' + r.refusal);
  const day = JSON.parse(outputText(data) || '{}');
  day.exercises.forEach((ex, i) => { ex.id = `ai${info.day}-${i + 1}`; });
  return day;
}

// ---------- 本物のエージェント体験（Claude Code / Codex 風） ----------
const tool = (name, description, properties) => ({ type: 'function', name, description, strict: true, parameters: obj(properties) });
export const AGENT_TOOLS = [
  tool('list_files', 'プロジェクト内のファイル一覧（パスと行数）を返す。', {}),
  tool('read_file', 'ファイルの内容を行番号付きで読む。', { path: { type: 'string', description: 'プロジェクトルートからの相対パス' } }),
  tool('search', 'すべてのファイルから正規表現で検索し、該当行を「パス:行番号: 内容」で返す。', { pattern: str }),
  tool('write_file', '新しいファイルを作る、またはファイル全体を書き換える（ユーザーの承認が必要）。', { path: str, content: str }),
  tool('edit_file', 'ファイル内の old_str（ファイル中で1回だけ出現する文字列）を new_str に置換する（ユーザーの承認が必要）。小さな変更はこちらを使う。', { path: str, old_str: str, new_str: str }),
  tool('run_python', 'Python ファイルを実行して標準出力を返す（ユーザーの承認が必要）。input() を使うプログラムは stdin に改行区切りで入力を与える。', { path: str, stdin: { type: 'string', description: 'input() に与える行（改行区切り）。不要なら空文字' } }),
  tool('run_tests', 'tests/ や test_*.py のテスト（test_ で始まる関数）をすべて実行し、pytest 風の結果を返す。', {}),
];

const AGENT_SYSTEM = `あなたは Claude Code や Codex のようなコーディングエージェントです。ユーザーはスマホから、ブラウザ内の仮想 Python プロジェクトで「AI エージェントとの開発」を体験しています。
- 日本語で、短く要点だけ話す。ツールを使う前に何をするか一言添える。
- まず list_files / read_file / search で調べてから変更する。推測で書き換えない。
- 変更は edit_file を優先（小さな差分）。新規ファイルや全面書き換えのみ write_file。
- 変更後は run_tests や run_python で必ず検証し、結果を報告する。
- 実行環境はブラウザ内の Python（Pyodide）。ネットワーク・pip install・tkinter は使えない。
- ユーザーが変更を拒否したら、理由を考えて別の方法を提案する。
- 最後に「何をしたか」を2〜4行でまとめる。
- AGENTS.md があればプロジェクトのルールとして従う。`;

// 1ターン分のエージェントループ。items は Responses API の入力アイテム列（会話履歴）
export async function agentTurn(items, { execTool, onText, signal, maxSteps = 25 }) {
  let steps = 0;
  while (steps++ < maxSteps) {
    let data;
    try {
      data = await respond({ instructions: AGENT_SYSTEM, tools: AGENT_TOOLS, input: items }, signal);
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
