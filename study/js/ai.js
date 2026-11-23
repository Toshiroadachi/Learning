// （任意機能）AI 先生：問題のヒント・解説・質問、写真の問題の解説、教材と問題の自動作成
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


// ---------- メッセージ（文字＋画像）を各社の形式に ----------
// msg.content は文字列、または { text, image: { media, data(base64) } }
function toClaude(msgs) {
  return msgs.map(m => typeof m.content === 'string' ? m : { role: m.role, content: [
    ...(m.content.image ? [{ type: 'image', source: { type: 'base64', media_type: m.content.image.media, data: m.content.image.data } }] : []),
    { type: 'text', text: m.content.text || '（画像の問題を解説してください）' },
  ] });
}
function toOpenAI(msgs) {
  return msgs.map(m => typeof m.content === 'string' ? m : { role: m.role, content: [
    ...(m.content.image ? [{ type: 'input_image', image_url: `data:${m.content.image.media};base64,${m.content.image.data}` }] : []),
    { type: 'input_text', text: m.content.text || '（画像の問題を解説してください）' },
  ] });
}
async function chatText(system, msgs, { effort = 'low', maxTokens = 6000 } = {}) {
  const p = need();
  if (p === 'anthropic') {
    const resp = await claudeCreate({ max_tokens: maxTokens, output_config: { effort }, system, messages: toClaude(msgs) });
    if (resp.stop_reason === 'refusal') throw new Error('回答できない内容でした。質問を変えてみてください。');
    return clText(resp);
  }
  const data = await openaiRespond({ instructions: system, input: toOpenAI(msgs) });
  const r = oaRefusal(data);
  if (r) throw new Error('回答できない内容でした: ' + r.refusal);
  return oaText(data);
}
async function chatJSON(system, prompt, schema, { effort = 'medium', maxTokens = 16000 } = {}) {
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

// ---------- AI 先生 ----------
const TEACHER = `あなたは、高校2年生に物理・化学・数学を教える、やさしくて楽しい先生です。日本語で話します。
いちばん大切なルール：**中学生でも分かる言葉で**説明すること。
- 専門用語は、使うたびに一言で言いかえる（例：「加速度（1秒ごとにどれだけ速くなるか）」）
- 身近なたとえ（自転車、お金、料理、スポーツ、ゲームなど）を1つ入れる
- 解き方は「① 何が分かっていて何を求めるか → ② 使う公式とその理由 → ③ 計算（途中式を省かない） → ④ 答えと単位 → ⑤ 答えが妥当かの確認」の順に、番号付きで1ステップずつ
- 数式は $…$（1行の中）と $$…$$（独立した行）の LaTeX で書く。表は | 区切り
- スマホで読むので、1つの段落は短く。長くても 600 字程度を目安に
- 間違えた生徒を責めず、どこまで合っていたかを先にほめる
- 最後に「確認ミニ問題」を1問だけ出してもよい（答えは折りたたまず最後の行に「（答え：…）」と書く）`;

export async function tutor(kind, { subject, unitTitle, problem, studentAnswer, question, history = [] }) {
  const task = {
    hint: '生徒は解き方が分からず困っています。**答えは言わずに**、次の一歩が分かるヒントを3段階で出してください（①方針 ②使う公式 ③最初の式）。',
    explain: 'この問題の解き方を、中学生でも分かるように最初からていねいに解説してください。',
    wrong: '生徒の答えは不正解でした。どこで間違えた可能性が高いかを推理して、正しい考え方を説明してください。',
    ask: '生徒の質問に答えてください。',
  }[kind];
  const ctx = [`教科: ${subject}　単元: ${unitTitle}`, problem ? `## 問題\n${problem.q}${problem.choices ? '\n選択肢:\n' + problem.choices.map((c, i) => `${i + 1}. ${c}`).join('\n') : ''}` : '',
    problem && kind !== 'hint' ? `## 正しい答え\n${problem.type === 'choice' ? problem.ans + ' 番' : problem.ans + ' ' + (problem.unit || '')}\n## 模範解答（参考）\n${problem.solution || ''}` : '',
    studentAnswer != null && studentAnswer !== '' ? `## 生徒の答え\n${studentAnswer}` : ''].filter(Boolean).join('\n\n');
  const msgs = [...history, { role: 'user', content: `${task}\n\n${ctx}${question ? `\n\n## 生徒の質問\n${question}` : ''}` }];
  const text = await chatText(TEACHER, msgs);
  return { text, messages: [...msgs, { role: 'assistant', content: text }] };
}
export async function askUnit({ subject, unitTitle, text, question, history = [] }) {
  const msgs = [...history, { role: 'user', content: `${history.length ? '' : `教科: ${subject}　単元: ${unitTitle}\n## 生徒が読んでいる解説\n${String(text).slice(0, 7000)}\n\n`}## 生徒の質問\n${question}` }];
  const out = await chatText(TEACHER, msgs);
  return { text: out, messages: [...msgs, { role: 'assistant', content: out }] };
}
// 写真の問題を解説（問題集の問題を撮影して送る）
export async function photo({ image, note, history = [] }) {
  const first = { role: 'user', content: { image, text: `写真の問題を解説してください。${note ? '\n生徒からのメモ: ' + note : ''}\n- まず問題文を読み取って短く書き写し（読めない部分は「読み取れません」と書く）、何を求める問題かを1行で\n- 問題がいくつかある場合は、メモで指定された問題（指定がなければ最初の問題）を解説` } };
  const msgs = history.length ? history : [first];
  const text = await chatText(TEACHER, msgs, { effort: 'medium', maxTokens: 8000 });
  return { text, messages: [...msgs, { role: 'assistant', content: text }] };
}
export async function followUp(history, question) {
  const msgs = [...history, { role: 'user', content: question }];
  const text = await chatText(TEACHER, msgs, { effort: 'low' });
  return { text, messages: [...msgs, { role: 'assistant', content: text }] };
}

// ---------- 教材・問題の自動作成 ----------
const PROBLEM = obj({ q: str, type: { type: 'string', enum: ['num', 'choice'] }, ans: str, unit: str, lv: { type: 'integer' }, choices: arr(str), hint: str, solution: str, calc: str });
const UNIT_SCHEMA = obj({ image: str, detail: str, formulas: str, pitfalls: str, example: str, problems: arr(PROBLEM) });
const GEN_SYSTEM = `あなたは高校の物理・化学・数学のオリジナル教材を作る先生です。対象は高校2年生ですが、**中学生でも分かる説明** にします。
市販の問題集や教科書の問題・文章をそのまま使わず、オリジナルの文章と問題を作ってください。
数式は LaTeX（$…$、$$…$$）、本文は簡易マークダウン（### 見出し、- 箇条書き、表は | 区切り、**太字**）。表のセルの中に | を書かない。
問題の仕様:
- type は "num"（数値で答える）か "choice"（選択肢から選ぶ）
- num のとき：ans は答えの数値（分数や √ を使う場合は 1/3、√2、(√6+√2)/4 のような式でもよい）、unit は単位（なければ "-"）、calc は答えを計算する式（例 "0.5*9.8*2.0^2"）。ans と calc は同じ値になること。使える記号は + - * / ^ ( ) sqrt sin cos tan log10 ln π e と数値のみ
- choice のとき：choices に4つの選択肢、ans は正解の番号（1始まり）を文字列で、unit と calc は "-"
- lv は 1（基本）2（標準）3（発展・ボス問題）
- hint は答えを言わずに方針を1〜2文で
- solution は中学生でも分かるように、① 分かっていること → ② 使う公式 → ③ 途中式を省かない計算 → ④ 答え の番号付きで
- 物理・化学の数値は有効数字に気をつけ、g = 9.8 m/s²、原子量 H=1.0 C=12 N=14 O=16 Na=23 Cl=35.5 など標準的な値を使い、問題文に明記する`;

export async function generateUnit(unit, subjectName) {
  const prompt = `教科: ${subjectName}（${unit.book}）\n章: ${unit.ch}\n単元: ${unit.title}\n扱う内容: ${unit.topics}\n
次を作ってください。
- image: この単元で学ぶことを、身近なたとえで 4〜7 行で（なぜ大事か、何ができるようになるか）
- detail: くわしい解説 2000〜3500 字。5〜7 個の小さなステップ（### 見出し）に分け、1ステップに新しいことは1つ。公式は意味（各記号が何か）と、なぜそうなるかを説明。数値の具体例と表を使う
- formulas: 公式の一覧（- 箇条書き、4〜8個）
- pitfalls: つまずきやすい点・よくある間違いを 4〜6 個の箇条書き
- example: 例題1問と、ていねいな解き方
- problems: 5問（lv 1 を2問、lv 2 を2問、lv 3 のボス問題を1問）。num を中心に、choice は1〜2問まで`;
  return chatJSON(GEN_SYSTEM, prompt, UNIT_SCHEMA);
}
export async function generateProblems(unit, subjectName, level, n = 3) {
  const prompt = `教科: ${subjectName}（${unit.book}）\n単元: ${unit.title}\n扱う内容: ${unit.topics}\n\n練習問題を ${n} 問作ってください。難しさは ${['', '基本（lv 1）', '標準（lv 2）', '発展（lv 3）'][level]}。これまでと違う設定・数値にすること。`;
  const r = await chatJSON(GEN_SYSTEM, prompt, obj({ problems: arr(PROBLEM) }));
  return r.problems || [];
}
