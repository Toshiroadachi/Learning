// （任意機能）AI を使う機能：AI 先生（ヒント・エラー解説・添削・質問）、演習問題の自動作成、実務相談・数式の解説
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


// ---------- 共通：文章で答える / JSON で答える ----------
async function chatText(system, msgs, { effort = 'low', maxTokens = 4000 } = {}) {
  const p = need();
  if (p === 'anthropic') {
    const resp = await claudeCreate({ max_tokens: maxTokens, output_config: { effort }, system, messages: msgs });
    if (resp.stop_reason === 'refusal') throw new Error('回答できない内容でした。質問を変えてみてください。');
    return clText(resp);
  }
  const data = await openaiRespond({ instructions: system, input: msgs });
  const r = oaRefusal(data);
  if (r) throw new Error('回答できない内容でした: ' + r.refusal);
  return oaText(data);
}
async function chatJSON(system, prompt, schema, { effort = 'medium', maxTokens = 12000 } = {}) {
  const p = need();
  let text;
  if (p === 'anthropic') {
    const resp = await claudeCreate({ max_tokens: maxTokens, output_config: { effort, format: { type: 'json_schema', schema } }, system, messages: [{ role: 'user', content: prompt }] });
    if (resp.stop_reason === 'refusal') throw new Error('作成できませんでした。もう一度お試しください。');
    if (resp.stop_reason === 'max_tokens') throw new Error('出力が長すぎて途中で切れました。再試行してください。');
    text = clText(resp);
  } else {
    const data = await openaiRespond({ instructions: system, input: prompt, text: { format: { type: 'json_schema', name: 'result', strict: true, schema } } });
    if (data.status === 'incomplete') throw new Error('出力が途中で切れました。再試行してください。');
    const r = oaRefusal(data);
    if (r) throw new Error('作成できませんでした: ' + r.refusal);
    text = oaText(data);
  }
  return JSON.parse(text || '{}');
}
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const str = { type: 'string' };
const arr = items => ({ type: 'array', items });

export const TRACK_NAME = { pq: 'Excel パワークエリ（M 言語）', bi: 'Power BI（DAX・データモデル）', apps: 'Power Apps（Power Fx）' };
const LANG = { pq: 'powerquery', bi: 'dax', apps: 'powerfx' };

// ---------- AI 先生 ----------
const TUTOR_SYSTEM = `あなたは日本語で教える、やさしく的確な Microsoft Power Platform / Excel の先生です。
受講者は会社員で、スマホで学習し、実際の業務では Windows PC の Excel（パワークエリ）・Power BI Desktop・Power Apps を使います。
- 説明は短く具体的に。専門用語には一言説明を添える。
- 数式・コードは \`\`\`言語名 のコードブロックで示す。スマホで読むので1行を短めに。
- 可能なら「PC ではこう操作する（リボンのどこを押すか）」も一言添える。日本語版の画面表記を使う（例: ホーム → 詳細エディター）。
- このアプリの実行環境は学習用のサブセットです。受講者の書いた式が実際の製品では動くのにアプリで動かない可能性がある場合は、そう伝えてください。`;

export async function tutor(kind, { track, exercise, code, result, question, history = [] }) {
  const task = {
    hint: '受講者は行き詰まっています。**答えの式は書かずに**、次の一歩が分かるヒントを2〜3段階で出してください（最初は軽いヒント、最後はかなり具体的に）。',
    error: '結果のエラー・不一致を、「何が起きたか」「どこを直すか」の順で説明してください。修正した式は該当部分だけ示す。',
    review: '受講者の式は正解しました。良い点を1つ褒め、実務でより読みやすく・保守しやすく・速くする改善点を1〜3個、短い例つきで提案してください。実務での落とし穴（パフォーマンス、委任、型、更新時の注意など）があれば1つ添える。',
    ask: '受講者の質問に答えてください。',
  }[kind];
  const ctx = [
    `## 分野: ${TRACK_NAME[track]}`,
    exercise ? `## 課題: ${exercise.title}\n${exercise.prompt}` : '',
    exercise?.context ? `## 課題の前提\n${exercise.context}` : '',
    code != null ? `## 受講者の式\n\`\`\`${LANG[track]}\n${code}\n\`\`\`` : '',
    result ? `## 実行結果・採点結果\n\`\`\`\n${String(result).slice(0, 3000)}\n\`\`\`` : '',
  ].filter(Boolean).join('\n\n');
  const msgs = [...history, { role: 'user', content: `${task}\n\n${ctx}${question ? `\n\n## 質問\n${question}` : ''}` }];
  const text = await chatText(TUTOR_SYSTEM, msgs);
  return { text, messages: [...msgs, { role: 'assistant', content: text }] };
}

// ---------- 実務相談・数式の解説 ----------
const CONSULT_SYSTEM = `あなたは日本企業の業務改善に詳しい、Excel パワークエリ・Power BI・Power Apps（と Power Automate）のコンサルタント兼講師です。日本語で答えます。
相談者は会社員で、Windows PC の日本語版 Excel / Power BI Desktop / Power Apps を使います。
- まず結論（どのツールのどの機能で解決するか）を1〜2行で。
- 次に PC での具体的な手順を番号付きで（日本語版の画面表記: 例「データ」タブ →「データの取得」→「ファイルから」→「テキストまたは CSV から」）。
- 必要なら M 言語 / DAX / Power Fx の式をコードブロックで示し、各行の意味を短く説明する。
- 実務の注意点（データ量、更新、共有、権限、委任、ライセンスなど）を最後に箇条書きで。
- 個人情報や社外秘のデータを貼り付けないよう、必要なら一言注意する。
- スマホで読むので、長すぎないように。`;
export async function consult(messages) {
  return chatText(CONSULT_SYSTEM, messages, { effort: 'medium', maxTokens: 8000 });
}
const EXPLAIN_SYSTEM = `あなたは Excel パワークエリ（M 言語）・Power BI（DAX）・Power Apps（Power Fx）の講師です。貼り付けられた式が何をしているかを、日本語で初心者にも分かるように解説します。
1. まず「この式は何をするか」を1〜2行で。
2. 次にステップ（行・関数）ごとに、何をしているかを箇条書きで。
3. 改善できる点・間違いや危険な点があれば最後に（なければ省略）。
言語が不明なら推定して最初に「（M 言語と判断しました）」のように書く。`;
export async function explainFormula(code, lang) {
  return chatText(EXPLAIN_SYSTEM, [{ role: 'user', content: `言語: ${lang || '自動判定'}\n\n\`\`\`\n${code}\n\`\`\`` }], { effort: 'low' });
}

// ---------- 演習問題の自動作成 ----------
const GEN_COMMON = `あなたは日本語の業務向けデータ分析講座の教材作成者です。オリジナルの演習問題を1問作ります（市販教材の複製はしない）。
受講者はスマホのブラウザで、学習用の実行エンジン（製品の機能のサブセット）を使って解きます。模範解答はアプリで実行して検証されます。
- prompt: 受講者への指示。業務の場面設定を1文入れ、何を作ればよいかを明確に（列名・メジャー名・並び順など、採点に関わる条件はすべて書く）。
- hint: 使う関数や考え方のヒントを1〜2文（答えそのものは書かない）。
- explain: 模範解答の解説（3〜6行）。PC で同じことをする操作も1行添える。`;

const PQ_GEN_SCHEMA = obj({ title: str, prompt: str, source: str, solution: str, hint: str, explain: str });
const DAX_GEN_SCHEMA = obj({ title: str, prompt: str, kind: { type: 'string', enum: ['measure', 'column'] }, name: str, table: str, rows: str, cols: str, solution: str, hint: str, explain: str });
const FX_GEN_SCHEMA = obj({ title: str, prompt: str, screen: str, control: str, prop: str, solution: str, tests: arr(obj({ name: str, inputs: str })), hint: str, explain: str });

export async function generateExercise(track, { topic, level, catalog }) {
  if (track === 'pq') {
    const sys = `${GEN_COMMON}
分野: Excel パワークエリ（M 言語）。
使えるソース（Excel.CurrentWorkbook(){[Name="名前"]}[Content] で読み込む。列の型は最初すべて「任意」で、数値や日付も文字列のことがある）:
${catalog}
- source: 使うソースの名前（上の一覧から1つ）。
- solution: let … in で書いた完全な M のクエリ。最初のステップは必ず ソース = Excel.CurrentWorkbook(){[Name="…"]}[Content]。ステップ名は Excel の日本語版が自動で付ける名前（#"変更された型"、#"フィルターされた行" など）にする。
- 使える関数: Table.TransformColumnTypes / SelectRows / RemoveColumns / SelectColumns / RenameColumns / Sort / AddColumn / Group / UnpivotOtherColumns / Pivot / NestedJoin / ExpandTableColumn / Distinct / PromoteHeaders / FillDown / ReplaceValue / SplitColumn / TransformColumns / Combine / Skip / FirstN / AddIndexColumn、Text.* / Number.* / Date.* / List.*、Splitter.SplitTextByDelimiter、Replacer.ReplaceText。
- 結果の列名・列の順序・行の順序が一意に決まるように prompt に明記する（並べ替えが必要なら指示する）。`;
    return chatJSON(sys, `テーマ: ${topic}\n難易度: ${level}`, PQ_GEN_SCHEMA);
  }
  if (track === 'bi') {
    const sys = `${GEN_COMMON}
分野: Power BI の DAX。モデル（スター スキーマ、リレーションシップは多対一・単方向）:
${catalog}
- kind: "measure"（メジャー）か "column"（計算列）。
- name: 作るメジャー名／列名（日本語可）。
- table: 計算列のときは追加先のテーブル名、メジャーのときは "売上"。
- rows: マトリックスの行に置く列（"テーブル|列" の形、例 "商品|カテゴリ"）。計算列のときは空文字。
- cols: マトリックスの列に置く列（不要なら空文字）。例 "カレンダー|年"。
- solution: 式の右辺だけ（"名前 =" は書かない）。既存のメジャー [売上金額] = SUM(売上[金額]) は使ってよい。
- 使える関数: SUM, AVERAGE, MIN, MAX, COUNT, COUNTROWS, DISTINCTCOUNT, SUMX, AVERAGEX, MAXX, MINX, COUNTX, RANKX, DIVIDE, IF, SWITCH, AND, OR, CALCULATE, FILTER, ALL, ALLEXCEPT, ALLSELECTED, REMOVEFILTERS, VALUES, RELATED, RELATEDTABLE, TOPN, SELECTEDVALUE, HASONEVALUE, ISINSCOPE, TOTALYTD, DATESYTD, SAMEPERIODLASTYEAR, DATEADD, PREVIOUSMONTH, DATESINPERIOD, YEAR, MONTH, FORMAT, ROUND, VAR/RETURN。`;
    return chatJSON(sys, `テーマ: ${topic}\n難易度: ${level}`, DAX_GEN_SCHEMA);
  }
  const sys = `${GEN_COMMON}
分野: Power Apps キャンバスアプリの Power Fx（日本語環境と同じく引数の区切りは「,」、動作の連結は「;」）。
使える画面（screen に名前を指定。コントロール名とデータソースは下記のとおり）:
${catalog}
- control / prop: 受講者が数式を書くコントロールとプロパティ（例: Gallery1 / Items、Label1 / Text、Button1 / OnSelect）。
- solution: そのプロパティの数式。
- tests: 採点で試す入力状態を1〜3個。inputs は JSON 文字列で {"TextInput1":"東京","Dropdown1":"承認待ち","Toggle1":true,"Gallery1":2} の形（Dropdown は表示される値、Gallery は選択行の番号（1始まり））。入力がなければ "{}"。
- 使える関数: Filter, Search, LookUp, Sort, SortByColumns, First, Last, FirstN, CountRows, CountIf, Sum, Average, Max, Min, AddColumns, Distinct, Concat, ForAll, If, Switch, IsBlank, Coalesce, Len, Left, Mid, Upper, Lower, Text, Value, StartsWith, Today, DateAdd, DateDiff, Year, Month, Set, UpdateContext, Collect, ClearCollect, Remove, Patch, Defaults, Navigate, Notify, Reset, With。`;
  return chatJSON(sys, `テーマ: ${topic}\n難易度: ${level}`, FX_GEN_SCHEMA);
}
