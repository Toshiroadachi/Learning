// （任意機能）AI による問題生成・ニュース解説
// Claude（Anthropic）または OpenAI を設定画面で選択。APIキーはこの端末の localStorage にのみ保存され、
// 各社の API へ直接送信されます。
import { getState } from './storage.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.2.0/+esm';

export const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5（高品質・推奨）' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5（約半額）' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5（最安・高速）' },
];
// OpenAI の候補（設定画面の「一覧を取得」でキーに応じた実際のモデル一覧に置き換え可能）
export const OPENAI_SUGGESTED = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini'];

export function aiProvider(settings = getState().settings) {
  if (settings.aiProvider === 'none') return null;
  if (settings.aiProvider === 'openai') return settings.openaiKey ? 'openai' : null;
  if (settings.aiProvider === 'anthropic' || (!settings.aiProvider && settings.apiKey)) return settings.apiKey ? 'anthropic' : null;
  return null;
}

let clientPromise = null;
async function client() {
  const key = getState().settings.apiKey;
  if (!key) throw new Error('設定画面で Anthropic API キーを入力してください。');
  if (!clientPromise || clientPromise.key !== key) {
    const p = import(SDK_URL).then(mod => {
      const Anthropic = mod.default || mod.Anthropic;
      // ブラウザから直接呼び出す（個人利用のアプリのため。キーは自分の端末内のみに保存）
      return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    });
    p.key = key;
    clientPromise = p;
  }
  return clientPromise;
}

const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const str = { type: 'string' };
const int = { type: 'integer' };
const arr = (items) => ({ type: 'array', items });

const qSchema = obj({ q: str, options: arr(str), answer: int, expl: str });

function schemaFor(part) {
  if (part === 1) return obj({ items: arr(obj({ scene: obj({ emoji: str, desc: str }), options: arr(str), answer: int, expl: str, tag: str })) });
  if (part === 2 || part === 5) return obj({ items: arr(obj({ q: str, options: arr(str), answer: int, expl: str, tag: str })) });
  if (part === 3) return obj({ items: arr(obj({ tag: str, script: arr(obj({ sp: { type: 'string', enum: ['M', 'W', 'M2', 'W2'] }, t: str })), questions: arr(qSchema) })) });
  if (part === 4) return obj({ items: arr(obj({ tag: str, voice: { type: 'string', enum: ['M', 'W'] }, script: str, questions: arr(qSchema) })) });
  if (part === 6) return obj({ items: arr(obj({ tag: str, title: str, passage: str, questions: arr(obj({ q: str, options: arr(str), answer: int, expl: str, tag: str })) })) });
  return obj({ items: arr(obj({ tag: str, passages: arr(obj({ title: str, text: str })), questions: arr(qSchema) })) });
}

const PART_SPEC = {
  1: 'Part 1（写真描写）。写真の代わりに scene.emoji（場面を表す絵文字3〜5個）と scene.desc（日本語で写真の内容を具体的に説明）を作る。options は英文4つ、写真を正しく描写するのは1つだけ。is being p.p. / have been p.p. の区別など本番の引っかけを入れる。',
  2: 'Part 2（応答問題）。q は英語の質問または発言、options は応答3つ。間接応答・音のひっかけ（似た発音や同じ単語の繰り返し）を本番同様に含める。tag は WH疑問文/Yes/No疑問文/否定疑問文/付加疑問文/選択疑問文/提案・依頼/平叙文/間接応答 のいずれか。',
  3: 'Part 3（会話問題）。script は2〜3人の会話（sp は M/W/M2/W2）。6〜8発話、ビジネス場面。questions は3問、各4択。意図問題（"What does the man mean when he says ..."）を含めてもよい。',
  4: 'Part 4（説明文問題）。script は1人のトーク（アナウンス・電話メッセージ・会議・ラジオ・広告など、120〜170語）。questions は3問、各4択。',
  5: 'Part 5（短文穴埋め）。q は空所を "-------" で示した1文。options は4つ。tag は 品詞/動詞の形/前置詞/接続詞/関係詞/代名詞/比較/語彙 のいずれか。',
  6: 'Part 6（長文穴埋め）。passage はメール・告知・記事など（130〜180語）で、空所を [1] [2] [3] [4] と表記。questions は4問で、q は "[1]" のように空所番号。うち1問は文挿入問題（選択肢が英文）。各問に tag（品詞/語彙/接続副詞/文挿入 など）。',
  7: 'Part 7（読解）。passages は1〜3文書（メール・記事・広告・チャットなど）。questions は3〜5問、各4択。NOT問題・推測問題・同義語問題・複数文書の照合問題を適宜含める。',
};

const SYSTEM = `あなたはTOEIC L&Rの問題作成の専門家です。本番と同じ形式・難易度・トピック（ビジネス、日常生活）で、オリジナルの新作問題を作成します。
- 英文は自然で正確なアメリカ/イギリス英語。固有名詞は架空のもの。
- answer は options の0始まりのインデックス。正解は必ず1つだけになるようにし、他の選択肢が誤りである理由を明確にする。
- expl は日本語で、正解の根拠・ひっかけのポイント・覚えるべき語彙や文法を簡潔に（80〜200字）。
- 既存の公式問題集の問題を複製しない。`;

async function callClaude({ system, prompt, schema, effort }) {
  const c = await client();
  const model = getState().settings.claudeModel || 'claude-opus-5-5';
  const params = {
    model,
    max_tokens: 16000,
    output_config: { effort, format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content: prompt }],
  };
  // 安全性判定で断られた場合に別モデルで自動再試行（Haiku は非対応）
  const resp = model.includes('haiku')
    ? await c.messages.create(params)
    : await c.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  if (resp.stop_reason === 'refusal') throw new Error('リクエストが拒否されました。条件を変えて再試行してください。');
  if (resp.stop_reason === 'max_tokens') throw new Error('出力が長すぎて途中で切れました。数を減らして再試行してください。');
  const text = resp.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return JSON.parse(text);
}

async function callOpenAI({ system, prompt, schema }) {
  const st = getState().settings;
  const model = (st.openaiModel || 'gpt-5-mini').trim();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${st.openaiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema } },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI API エラー (${res.status}): ${data.error?.message || res.statusText}`);
  const msg = data.choices?.[0]?.message;
  if (msg?.refusal) throw new Error('リクエストが拒否されました: ' + msg.refusal);
  if (data.choices?.[0]?.finish_reason === 'length') throw new Error('出力が長すぎて途中で切れました。数を減らして再試行してください。');
  return JSON.parse(msg?.content || '{}');
}

async function call({ system, prompt, schema, effort = 'medium' }) {
  const p = aiProvider();
  if (!p) throw new Error('設定画面で AI の種類と API キーを設定してください。');
  return p === 'openai' ? callOpenAI({ system, prompt, schema }) : callClaude({ system, prompt, schema, effort });
}

// OpenAI: このキーで使えるモデル一覧を取得（テキスト生成向けのものだけ）
export async function listOpenAIModels(key) {
  const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`取得に失敗しました (${res.status}): ${data.error?.message || ''}`);
  return (data.data || []).map(m => m.id)
    .filter(id => /^(gpt|o\d|chatgpt)/.test(id) && !/(audio|realtime|tts|transcribe|image|search|embedding|instruct)/.test(id))
    .sort();
}

// 弱点・レベルに合わせた問題を生成し、アプリ内部の形式に変換して返す
export async function generateQuestions(part, { count = 3, level = 4, focus = '' } = {}) {
  const target = getState().settings.targetScore;
  const prompt = `${PART_SPEC[part]}
目標スコア: ${target}点。難易度: 5段階中 ${level}（5 = 900点以上でも迷う難問）。
${focus ? `重点的に鍛えたい弱点: ${focus}` : ''}
${part === 1 || part === 2 || part === 5 ? `${count}問` : `${Math.max(1, Math.min(count, 3))}セット`}作成してください。`;
  const data = await call({ system: SYSTEM, prompt, schema: schemaFor(part) });
  const stamp = Date.now().toString(36);
  return (data.items || []).map((it, i) => ({ ...it, id: `ai-p${part}-${stamp}-${i}`, part, diff: level, ai: true, tag: it.tag || focus || 'AI' }));
}

// ニュース記事の日本語解説＋理解度クイズ
export async function explainNews(article) {
  const schema = obj({
    summary_ja: str,
    vocab: arr(obj({ word: str, meaning: str })),
    questions: arr(qSchema),
  });
  const prompt = `次の英語ニュースの見出しと要約を読み、TOEIC 900点を目指す学習者向けに
1) summary_ja: 日本語で背景も含めた解説（150〜250字）
2) vocab: 記事中の重要語彙5〜8個（word は英語、meaning は日本語の意味）
3) questions: 英語の4択読解問題2問（answer は0始まり、expl は日本語）
を作成してください。記事に書かれていない事実を断定しないでください。

Source: ${article.source}
Title: ${article.title}
Summary: ${article.summary}`;
  return call({ system: 'あなたは英語ニュースを使って英語を教える講師です。', prompt, schema, effort: 'low' });
}
