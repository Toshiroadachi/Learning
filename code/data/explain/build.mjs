// 解説の原稿（explain/*.md）から data/py-explain.js を作る
// 使い方: node code/data/explain/build.mjs
// 書式:
//   @@day N
//   @image / @detail / @pitfalls … 以降の行が Markdown
//   @check … Q: 問題（複数行可）→ "- 選択肢" / "* 正解の選択肢" → "E: 解説"
//   @steps 演習ID … 考え方の手順（Markdown）
import fs from 'fs';
import path from 'path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const out = {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
  let day = null, sec = null, key = null, buf = [];
  const flush = () => {
    if (!day || !sec) return;
    const text = buf.join('\n').replace(/^\n+|\n+$/g, '');
    const d = (out[day] ||= { steps: {} });
    if (sec === 'steps') d.steps[key] = text;
    else if (sec === 'check') d.check = parseCheck(text, `${f} Day ${day}`);
    else d[sec] = text;
    buf = [];
  };
  for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    let m;
    if ((m = /^@@day (\d+)\s*$/.exec(line))) { flush(); day = +m[1]; sec = null; continue; }
    if ((m = /^@(image|detail|pitfalls|check)\s*$/.exec(line))) { flush(); sec = m[1]; continue; }
    if ((m = /^@steps (\S+)\s*$/.exec(line))) { flush(); sec = 'steps'; key = m[1]; continue; }
    buf.push(line);
  }
  flush();
}
function parseCheck(text, where) {
  const qs = []; let cur = null, mode = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('Q: ')) { cur = { q: line.slice(3), choices: [], a: -1, exp: '' }; qs.push(cur); mode = 'q'; continue; }
    if (!cur) continue;
    if (/^[-*] /.test(line) && mode !== 'e') { if (line[0] === '*') cur.a = cur.choices.length; cur.choices.push(line.slice(2)); mode = 'c'; continue; }
    if (line.startsWith('E: ')) { cur.exp = line.slice(3); mode = 'e'; continue; }
    if (mode === 'q') cur.q += '\n' + line;
    else if (mode === 'e') cur.exp += '\n' + line;
  }
  for (const q of qs) if (q.a < 0 || q.choices.length < 2) throw new Error(`${where}: 正解または選択肢がない問題 → ${q.q.slice(0, 30)}`);
  return qs;
}
const js = `// このファイルは explain/*.md から自動生成（node code/data/explain/build.mjs）。直接編集しないでください。\n// Day 1〜30 の「くわしい解説」「理解度チェック」「演習の考え方」\nexport const EXPLAIN = ${JSON.stringify(out, null, 1)};\n`;
fs.writeFileSync(path.join(dir, '..', 'py-explain.js'), js);
console.log('days:', Object.keys(out).join(','), '| checks:', Object.values(out).reduce((a, d) => a + (d.check?.length || 0), 0), '| steps:', Object.values(out).reduce((a, d) => a + Object.keys(d.steps).length, 0));
