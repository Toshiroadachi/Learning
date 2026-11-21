import * as M from '../js/mlang.js';
import { PQ_SOURCES, PQ_FILES, helperQuery, sourceStep } from '../data/pq-sources.js';
import { PQ_LESSONS } from '../data/pq-lessons.js';
const sources = Object.fromEntries(Object.entries(PQ_SOURCES).map(([k, d]) => [k, M.toTable(d)]));
let fail = 0, n = 0;
for (const l of PQ_LESSONS) for (const ex of l.ex) {
  n++;
  const queries = {};
  for (const h of ex.helpers || []) queries[h] = M.run(helperQuery(h), sources, PQ_FILES);
  let sol;
  try { sol = M.run(ex.solution, sources, PQ_FILES, queries); } catch (e) { console.log('✗', ex.id, 'solution error:', e.message); fail++; continue; }
  if (!(sol instanceof M.MTable)) { console.log('✗', ex.id, 'not table'); fail++; continue; }
  const errs = sol.rows.flat().filter(v => v instanceof M.MError).length;
  const start = `let\n    ソース = ${sourceStep(ex.file || ex.query)}\nin\n    ソース`;
  const st = M.run(start, sources, PQ_FILES, queries);
  let d = M.tableDiff(st, sol, { loose: ex.loose !== false });
  if (!d && ex.checkTypes) d = M.typeDiff(st, sol);
  if (!d) { console.log('✗', ex.id, 'starter passes!'); fail++; }
  console.log('✓', ex.id, sol.cols.join(','), sol.rows.length + '行', errs ? `(Error ${errs})` : '', '| start→', d?.slice(0, 40));
}
// 補助クエリと round trip（splitSteps → joinSteps）
for (const l of PQ_LESSONS) for (const ex of l.ex) {
  const { steps } = M.splitSteps(ex.solution);
  const again = M.joinSteps(steps);
  const a = M.run(again, sources, PQ_FILES, Object.fromEntries((ex.helpers || []).map(h => [h, M.run(helperQuery(h), sources, PQ_FILES)])));
  const b = M.run(ex.solution, sources, PQ_FILES, Object.fromEntries((ex.helpers || []).map(h => [h, M.run(helperQuery(h), sources, PQ_FILES)])));
  if (M.tableDiff(a, b)) { console.log('✗ roundtrip', ex.id); fail++; }
}
console.log(`${n} exercises, ${fail} failures`);
process.exit(fail ? 1 : 0);
