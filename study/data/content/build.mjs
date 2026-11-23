// 教材の原稿（content/*.md）から data/content.js を作る。答えの検算もする
// 使い方: node study/data/content/build.mjs
// 書式:
//   @@unit 単元ID
//   @image / @detail / @formulas / @pitfalls / @example … 以降の行が Markdown（数式は $…$ / $$…$$）
//   @problem n=1 type=num ans=9.8 unit=m/s tol=0.02 lv=1 calc=式   （type: num | expr | choice）
//     その後の行が問題文。@choices（1行1つ、choice のとき）/ @hint / @solution が続く
import fs from 'fs';
import path from 'path';
import { calc, check, parse } from '../../js/mathx.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const out = {}; let errors = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
  let unit = null, sec = null, prob = null, buf = [];
  const flush = () => {
    const text = buf.join('\n').replace(/^\n+|\n+$/g, '');
    buf = [];
    if (!unit || !sec) return;
    if (['image', 'detail', 'formulas', 'pitfalls', 'example'].includes(sec)) { unit[sec] = text; return; }
    if (sec === 'q') prob.q = text;
    if (sec === 'choices') prob.choices = text.split('\n').map(s => s.replace(/^- /, '').trim()).filter(Boolean);
    if (sec === 'hint') prob.hint = text;
    if (sec === 'solution') prob.solution = text;
  };
  for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    let m;
    if ((m = /^@@unit (\S+)\s*$/.exec(line))) { flush(); unit = out[m[1]] = { problems: [] }; sec = null; continue; }
    if ((m = /^@(image|detail|formulas|pitfalls|example|choices|hint|solution)\s*$/.exec(line))) { flush(); sec = m[1]; continue; }
    if ((m = /^@problem (.+)$/.exec(line))) {
      flush();
      const kv = Object.fromEntries([...m[1].matchAll(/(\w+)=(\S+)/g)].map(x => [x[1], x[2]]));
      prob = { n: +kv.n, type: kv.type, ans: kv.ans, unit: kv.unit && kv.unit !== '-' ? kv.unit : '', tol: kv.tol ? +kv.tol : undefined, lv: +(kv.lv || 1), calc: kv.calc };
      unit.problems.push(prob); sec = 'q'; continue;
    }
    buf.push(line);
  }
  flush();
}
// 検証
for (const [id, u] of Object.entries(out)) {
  for (const k of ['image', 'detail', 'formulas', 'pitfalls']) if (!u[k]) { console.log(`✗ ${id}: ${k} がありません`); errors++; }
  u.problems.forEach(p => {
    const where = `${id} 問${p.n}`;
    if (!p.q || !p.solution || !p.hint) { console.log(`✗ ${where}: 問題文・ヒント・解説のどれかがありません`); errors++; }
    if (p.type === 'choice') { if (!p.choices || +p.ans < 1 || +p.ans > p.choices.length) { console.log(`✗ ${where}: 選択肢か正解番号が不正`); errors++; } }
    else {
      try { if (p.type === 'expr') parse(p.ans); else calc(p.ans); } catch (e) { console.log(`✗ ${where}: 答え ${p.ans} を計算できません (${e.message})`); errors++; }
      if (p.calc) {
        const r = check({ type: p.type, ans: p.ans, tol: p.type === 'num' ? 0.005 : undefined }, p.calc);
        if (!r.ok) { console.log(`✗ ${where}: 検算が合いません ans=${p.ans} calc=${p.calc} → ${p.type === 'num' ? calc(p.calc) : ''}`); errors++; }
      } else if (p.type === 'num') { console.log(`△ ${where}: calc（検算式）がありません`); }
    }
  });
}
fs.writeFileSync(path.join(dir, '..', 'content.js'), `// content/*.md から自動生成（node study/data/content/build.mjs）。直接編集しないでください。\nexport const CONTENT = ${JSON.stringify(out, null, 1)};\n`);
console.log('units:', Object.keys(out).length, '| problems:', Object.values(out).reduce((a, u) => a + u.problems.length, 0), '| errors:', errors);
process.exit(errors ? 1 : 0);
