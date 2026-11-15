// （任意機能）Claude API を使う機能：Python の AI 先生、Day31〜100 のレッスン生成、本物のエージェント体験
// API キーはこの端末の localStorage にのみ保存され、Anthropic の API へ直接送信されます。
import { getState, save } from './store.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.2.0/+esm';

export const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5（高品質・推奨）' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5（速い・約半額）' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5（最安・最速）' },
];
// USD / 100万トークン（入力, 出力）
const PRICES = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.10, 0.50] };

export const hasKey = () => !!getState().settings.apiKey;
export const currentModel = () => getState().settings.claudeModel || 'claude-opus-5-5';

export function costOf(u) {
  const p = PRICES[u.model];
  return p ? (u.in * p[0] + u.out * p[1]) / 1e6 : 0;
}
export function usageSummary() {
  const list = getState().aiUsage || [];
  const sum = list.reduce((a, u) => ({ n: a.n + 1, in: a.in + u.in, out: a.out + u.out, usd: a.usd + costOf(u) }), { n: 0, in: 0, out: 0, usd: 0 });
  return sum;
}
function recordUsage(model, usage) {
  const st = getState();
  st.aiUsage.push({ ts: Date.now(), model, in: (usage?.input_tokens || 0) + (usage?.cache_read_input_tokens || 0) + (usage?.cache_creation_input_tokens || 0), out: usage?.output_tokens || 0 });
  if (st.aiUsage.length > 3000) st.aiUsage = st.aiUsage.slice(-3000);
  save();
}

let clientP = null;
async function client() {
  const key = getState().settings.apiKey;
  if (!key) throw new Error('設定画面で Anthropic API キーを入力してください。');
  if (!clientP || clientP.key !== key) {
    const p = import(SDK_URL).then(mod => {
      const Anthropic = mod.default || mod.Anthropic;
      // 個人利用のアプリなのでブラウザから直接呼び出す（キーは自分の端末内のみ）
      return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    });
    p.key = key;
    clientP = p;
  }
  return clientP;
}

// 安全性判定で断られたとき別モデルで自動再試行（Haiku は非対応のため通常呼び出し）
async function create(params, opts) {
  const c = await client();
  const model = params.model;
  const resp = model.includes('haiku')
    ? await c.messages.create(params, opts)
    : await c.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, opts);
  recordUsage(model, resp.usage);
  return resp;
}

function friendlyError(e) {
  const s = String(e?.message || e);
  if (/401|authentication|invalid x-api-key/i.test(s)) return 'API キーが正しくありません。設定画面で確認してください。';
  if (/429|rate/i.test(s)) return '利用制限に達しました。少し待ってから再試行してください。';
  if (/credit|billing|balance/i.test(s)) return 'API のクレジット残高が不足しています（Anthropic Console で確認）。';
  if (/fetch|network|Failed to/i.test(s)) return '通信できませんでした。ネット接続を確認してください。';
  return s;
}
export { friendlyError };

const textOf = resp => resp.content.filter(b => b.type === 'text').map(b => b.text).join('');

// ---------- Python の AI 先生 ----------
const TUTOR_SYSTEM = `あなたは日本語で教える、やさしく的確な Python の先生です。受講者はスマホで学習中の初心者〜中級者で、Day 1〜10（print, 変数, if, for, while, 関数, リスト, 辞書）は修了しています。
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
  const messages = [...history];
  messages.push({ role: 'user', content: `${task}\n\n${ctx}${question ? `\n\n## 質問\n${question}` : ''}` });
  try {
    const resp = await create({ model: currentModel(), max_tokens: 4000, output_config: { effort: 'low' }, system: TUTOR_SYSTEM, messages });
    if (resp.stop_reason === 'refusal') throw new Error('回答できない内容でした。質問を変えてみてください。');
    return { text: textOf(resp), messages: [...messages, { role: 'assistant', content: resp.content }] };
  } catch (e) { throw new Error(friendlyError(e)); }
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
  try {
    const resp = await create({
      model: currentModel(), max_tokens: 16000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: DAY_SCHEMA } },
      system, messages: [{ role: 'user', content: prompt }],
    });
    if (resp.stop_reason === 'refusal') throw new Error('生成できませんでした。もう一度お試しください。');
    if (resp.stop_reason === 'max_tokens') throw new Error('出力が長すぎて途中で切れました。再試行してください。');
    const data = JSON.parse(textOf(resp));
    data.exercises.forEach((ex, i) => { ex.id = `ai${info.day}-${i + 1}`; });
    return data;
  } catch (e) { throw new Error(friendlyError(e)); }
}

// ---------- 本物のエージェント体験（Claude Code 風） ----------
const tool = (name, description, properties) => ({ name, description, strict: true, input_schema: obj(properties) });
export const AGENT_TOOLS = [
  tool('list_files', 'プロジェクト内のファイル一覧（パスと行数）を返す。', {}),
  tool('read_file', 'ファイルの内容を行番号付きで読む。', { path: { type: 'string', description: 'プロジェクトルートからの相対パス' } }),
  tool('search', 'すべてのファイルから正規表現で検索し、該当行を「パス:行番号: 内容」で返す。', { pattern: { type: 'string' } }),
  tool('write_file', '新しいファイルを作る、またはファイル全体を書き換える（ユーザーの承認が必要）。', { path: str, content: str }),
  tool('edit_file', 'ファイル内の old_str（ファイル中で1回だけ出現する文字列）を new_str に置換する（ユーザーの承認が必要）。小さな変更はこちらを使う。', { path: str, old_str: str, new_str: str }),
  tool('run_python', 'Python ファイルを実行して標準出力を返す（ユーザーの承認が必要）。input() を使うプログラムは stdin に改行区切りで入力を与える。', { path: str, stdin: { type: 'string', description: 'input() に与える行（改行区切り）。不要なら空文字' } }),
  tool('run_tests', 'tests/ や test_*.py のテスト（test_ で始まる関数）をすべて実行し、pytest 風の結果を返す。', {}),
];

export function agentSystem(mode) {
  return `あなたは Claude Code のようなコーディングエージェントです。ユーザーはスマホから、ブラウザ内の仮想 Python プロジェクトで「AI エージェントとの開発」を体験しています。
- 日本語で、短く要点だけ話す。ツールを使う前に何をするか一言添える。
- まず list_files / read_file / search で調べてから変更する。推測で書き換えない。
- 変更は edit_file を優先（小さな差分）。新規ファイルや全面書き換えのみ write_file。
- 変更後は run_tests や run_python で必ず検証し、結果を報告する。
- 実行環境はブラウザ内の Python（Pyodide）。ネットワーク・pip install・tkinter は使えない。
- ユーザーが変更を拒否したら、理由を考えて別の方法を提案する。
- 最後に「何をしたか」を2〜4行でまとめる。
- CLAUDE.md があればプロジェクトのルールとして従う。
${mode === 'plan' ? '' : ''}`;
}

// 1ターン分のエージェントループ。hooks でツールの実行・承認・表示をアプリ側に委ねる
export async function agentTurn(messages, { execTool, onText, onToolUse, signal, mode, maxSteps = 25 }) {
  const model = currentModel();
  let steps = 0;
  while (steps++ < maxSteps) {
    let resp;
    try {
      resp = await create({
        model, max_tokens: 16000, output_config: { effort: 'medium' },
        system: agentSystem(mode), tools: AGENT_TOOLS, messages,
      }, { signal });
    } catch (e) {
      if (signal?.aborted) return { stopped: true };
      throw new Error(friendlyError(e));
    }
    messages.push({ role: 'assistant', content: resp.content });
    for (const b of resp.content) {
      if (b.type === 'text' && b.text.trim()) onText(b.text);
    }
    if (resp.stop_reason === 'refusal') { onText('（この依頼には対応できませんでした）'); return { done: true }; }
    if (resp.stop_reason === 'max_tokens') { onText('（出力が上限に達しました。「続けて」と送ると再開します）'); return { done: true }; }
    if (resp.stop_reason !== 'tool_use') return { done: true };
    const results = [];
    for (const b of resp.content.filter(b => b.type === 'tool_use')) {
      if (signal?.aborted) {
        results.push({ type: 'tool_result', tool_use_id: b.id, content: 'ユーザーが中断しました。', is_error: true });
        continue;
      }
      onToolUse && onToolUse(b);
      const r = await execTool(b.name, b.input || {});
      results.push({ type: 'tool_result', tool_use_id: b.id, content: String(r.content).slice(0, 20000), ...(r.isError ? { is_error: true } : {}) });
    }
    messages.push({ role: 'user', content: results });
    if (signal?.aborted) return { stopped: true };
  }
  onText('（ステップ数の上限に達したため一旦止めました。「続けて」と送ると再開します）');
  return { done: true };
}
