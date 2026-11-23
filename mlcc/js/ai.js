// （任意機能）AI を使う機能：AI 先生（レッスンへの質問・深掘り）、技術相談、問題の自動作成、説明チェック、資料の要約、用語解説
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

const num = { type: 'integer' };

export const TRACK_NAME = {
  mat: '材料技術（誘電体・電極材料）',
  proc: 'プロセス技術（製造工程）',
  meas: '電気特性と測定',
  rel: '信頼性・故障解析',
  mkt: '市場・アプリケーション',
};

const BASE = `あなたは積層セラミックコンデンサ（MLCC）と受動電子部品に精通した、日本語で教える技術講師です。
材料科学（誘電体・BaTiO3系セラミックス・電極材料）、製造プロセス、電気測定、信頼性工学、回路での使われ方、電子部品市場のすべてに詳しく、大学の講義と現場の実務の両方の視点で説明できます。
受講者は電子部品メーカーの技術者で、知見を広げて業務に生かしたいと考えています。
- 説明は正確・具体的に。物理的なメカニズム（なぜそうなるか）と、実務での意味（設計・評価・顧客対応でどう効くか）をセットで説明する。
- 数値は代表的な範囲・目安として示し、製品・メーカー・条件で異なる場合はそう明記する。不確かな情報は断定しない。最新の市場数値は「公開情報の目安」とし、確認方法（各社 IR、業界レポート、規格書）を添える。
- 規格（JIS C 5101 / IEC 60384、EIA-198、AEC-Q200、JEITA など）に触れる場合は、規格名を示し、細部は原典を確認するよう添える。
- 数式は必要なら書く（例: C = ε0·εr·S·n / t）。単位を必ず付ける。
- スマホで読むので、見出し・箇条書き・短い段落で。長くなりすぎない。
- 特定企業の社外秘情報を推測で語らない。`;

// ---------- AI 先生（レッスン内） ----------
export async function tutor(kind, { lesson, track, question, history = [] }) {
  const task = {
    deeper: 'このレッスンの内容を、一段深いレベル（大学院・専門書レベル）で解説してください。メカニズムを中心に、レッスン本文に書いていないことを補ってください。',
    example: 'このレッスンの内容について、具体的な数値例・計算例・事例を2〜3個示してください（代表的な値で。計算は途中式も）。',
    work: '電子部品メーカーの技術者が、このレッスンの知識を業務（材料開発・プロセス開発・品質保証・評価・営業技術・顧客対応など）でどう生かせるか、具体的な場面を3〜5個挙げてください。顧客から聞かれやすい質問と答え方の例も1つ添える。',
    easy: 'このレッスンの要点を、専門外の人（営業や新入社員）にも説明できるように、たとえ話を使って平易に説明してください。最後に「3行まとめ」を。',
    ask: '受講者の質問に答えてください。',
  }[kind] || '受講者の質問に答えてください。';
  const ctx = lesson ? `## 分野: ${TRACK_NAME[track] || ''}\n## レッスン: ${lesson.title}\n目標: ${lesson.goal}\n\n### レッスン本文（要約の材料）\n${String(lesson.body).slice(0, 5000)}` : '';
  const msgs = [...history, { role: 'user', content: `${task}\n\n${ctx}${question ? `\n\n## 質問\n${question}` : ''}` }];
  const text = await chatText(BASE, msgs, { effort: 'medium', maxTokens: 6000 });
  return { text, messages: [...msgs, { role: 'assistant', content: text }] };
}

// ---------- 技術相談 ----------
const CONSULT_SYSTEM = `${BASE}
今は「技術相談」モードです。受講者の疑問や業務上の課題に答えます。
- 最初に結論を1〜3行で。続けて根拠（メカニズム）、確認・評価の方法、注意点の順に。
- 実験・評価の提案をするときは、条件（温度・電圧・周波数・時間・サンプル数）の目安も示す。
- 受講者が社外秘のデータや顧客名を書きそうなときは、一般化して相談するよう一言添える。`;
export async function consult(messages) {
  return chatText(CONSULT_SYSTEM, messages, { effort: 'medium', maxTokens: 8000 });
}

// ---------- 用語の解説 ----------
export async function explainTerm(term, hint = '') {
  const sys = `${BASE}
用語を解説します。次の構成で：
1. **ひとことで**（1〜2行）
2. **くわしく**（メカニズム・定義式・代表値）
3. **MLCC との関係**（設計・製造・評価・用途のどこで効くか）
4. **関連用語**（3〜5個、カンマ区切り）
5. **英語表記**`;
  return chatText(sys, [{ role: 'user', content: `用語: ${term}${hint ? `\n（参考: ${hint}）` : ''}` }], { effort: 'low', maxTokens: 3000 });
}

// ---------- 資料の要約・読解 ----------
export async function summarize(text, purpose) {
  const sys = `${BASE}
貼り付けられた技術資料（論文の要旨、データシート、アプリケーションノート、ニュース、英語の文章など）を読み解きます。
1. **要約**（日本語で3〜6行）
2. **技術的なポイント**（重要な数値・条件・メカニズムを箇条書き）
3. **MLCC 技術者としての読みどころ**（業務への示唆、気を付ける点、疑問点）
4. **専門用語**（出てきた用語の短い説明、英語なら英語→日本語）
5. **理解度チェック**（3問、答えは最後にまとめて）`;
  return chatText(sys, [{ role: 'user', content: `${purpose ? `目的: ${purpose}\n\n` : ''}## 資料\n${text.slice(0, 30000)}` }], { effort: 'medium', maxTokens: 8000 });
}

// ---------- 説明チェック（ファインマン・テクニック） ----------
const FEYN_SCHEMA = obj({ score: num, good: arr(str), missing: arr(str), wrong: arr(str), model: str, next: str });
export async function checkExplanation(topic, answer) {
  const sys = `${BASE}
受講者が、あるテーマを自分の言葉で説明しました。専門家として採点し、フィードバックします。
- score: 0〜100 の整数（正確さ・網羅性・メカニズムの理解・具体性）。
- good: よく書けている点（1〜3個）。
- missing: 抜けている重要ポイント（0〜4個）。
- wrong: 誤り・不正確な点と正しい内容（なければ空配列）。
- model: 模範的な説明（Markdown、10行程度）。
- next: 次に学ぶとよいこと（1〜2文）。`;
  return chatJSON(sys, `## テーマ\n${topic}\n\n## 受講者の説明\n${answer}`, FEYN_SCHEMA, { effort: 'medium', maxTokens: 6000 });
}

// ---------- 問題の自動作成 ----------
const QUIZ_SCHEMA = obj({ questions: arr(obj({ q: str, choices: arr(str), a: num, exp: str })) });
export async function generateQuiz({ track, topic, level, n = 5, avoid = [] }) {
  const sys = `${BASE}
オリジナルの4択問題を作ります（市販問題集の複製はしない）。
- 各問: q（問題文）、choices（選択肢ちょうど4つ）、a（正解の番号 0〜3）、exp（解説 2〜4行。なぜ正解か、他の選択肢がなぜ違うか）。
- 単なる暗記ではなく、メカニズムの理解・数値感覚・計算・現場の判断を問う問題を混ぜる。
- 計算問題は答えが一意に決まる数値で（有効数字に注意）。
- 正解の位置は偏らせない。紛らわしいが明確に誤りの選択肢にする。
- 事実が議論の分かれる内容や、年によって変わる市場数値の細かい暗記は避ける。`;
  const prompt = `分野: ${TRACK_NAME[track] || track}\nテーマ: ${topic}\n難易度: ${level}\n問題数: ${n}${avoid.length ? `\n\n次の問題とは重複させない:\n${avoid.slice(-15).map(x => '- ' + x).join('\n')}` : ''}`;
  const r = await chatJSON(sys, prompt, QUIZ_SCHEMA, { effort: 'medium', maxTokens: 10000 });
  return (r.questions || []).filter(q => Array.isArray(q.choices) && q.choices.length === 4 && q.a >= 0 && q.a < 4 && q.q);
}

// ---------- 苦手分析・学習アドバイス ----------
export async function advise(summary) {
  const sys = `${BASE}
受講者の学習記録から、次に何をどう学ぶとよいかを助言します。
- 2〜4個の具体的な提案（どのコースのどのテーマを、なぜ）。
- 業務に結びつく「今週の小さな実践」を1つ（例: 手元の部品のデータシートで DC バイアス特性を読み、実効容量を計算する）。
- 短く、励ます調子で。`;
  return chatText(sys, [{ role: 'user', content: summary }], { effort: 'low', maxTokens: 3000 });
}
