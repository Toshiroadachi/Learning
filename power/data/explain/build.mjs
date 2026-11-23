// 解説の原稿（explain/*.md）から data/explain.js を作る
// 使い方: node power/data/explain/build.mjs
// 書式: @@lesson レッスンID / @image / @detail / @pitfalls / @steps 演習ID（以降の行が Markdown）
import fs from 'fs';
import path from 'path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const out = {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
  let id = null, sec = null, key = null, buf = [];
  const flush = () => {
    if (!id || !sec) return;
    const text = buf.join('\n').replace(/^\n+|\n+$/g, '');
    const d = (out[id] ||= { steps: {} });
    if (sec === 'steps') d.steps[key] = text; else d[sec] = text;
    buf = [];
  };
  for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    let m;
    if ((m = /^@@lesson (\S+)\s*$/.exec(line))) { flush(); id = m[1]; sec = null; continue; }
    if ((m = /^@(image|detail|pitfalls)\s*$/.exec(line))) { flush(); sec = m[1]; continue; }
    if ((m = /^@steps (\S+)\s*$/.exec(line))) { flush(); sec = 'steps'; key = m[1]; continue; }
    buf.push(line);
  }
  flush();
}
fs.writeFileSync(path.join(dir, '..', 'explain.js'), `// explain/*.md から自動生成（node power/data/explain/build.mjs）。直接編集しないでください。\nexport const EXPLAIN = ${JSON.stringify(out, null, 1)};\n`);
console.log('lessons:', Object.keys(out).length, '| steps:', Object.values(out).reduce((a, d) => a + Object.keys(d.steps).length, 0));
