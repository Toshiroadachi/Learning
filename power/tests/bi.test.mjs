import { BI_LESSONS } from '../data/bi-lessons.js';
import { grade, engineFor } from '../js/daxgrade.js';
import { displayVal } from '../js/dax.js';
let fail = 0, n = 0;
for (const l of BI_LESSONS) for (const ex of l.ex) {
  n++;
  const ok = grade(ex, ex.solution);
  if (!ok.ok) { console.log('✗', ex.id, 'solution fails:', ok.msg); fail++; continue; }
  // 空の式・よくある誤答は不正解になること
  const wrongs = ['0', ex.kind === 'column' ? 'BLANK()' : 'SUM(売上[数量])'];
  for (const w of wrongs.filter(w => w !== ex.solution)) { const r = grade(ex, w); if (r.ok) { console.log('✗', ex.id, 'wrong answer passes:', w); fail++; } }
  let sample = '';
  if (ex.kind === 'column') sample = ok.got.slice(0, 4).map(v => displayVal(v)).join(', ');
  else { const mi = ok.mu.measures.indexOf(ex.name); sample = ok.mu.rows.slice(0, 3).map(r => displayVal(r.label) + ':' + r.cells.map(c => displayVal(c[mi], ex.fmt)).join('/')).join('  ') + ' | 計 ' + ok.mu.total.map(c => displayVal(c[mi], ex.fmt)).join('/'); }
  console.log('✓', ex.id, ex.name, '→', sample);
}
console.log(`${n} exercises, ${fail} failures`);
process.exit(fail ? 1 : 0);
