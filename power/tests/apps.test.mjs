import { APPS_LESSONS } from '../data/apps-lessons.js';
import { grade, makeApp, evalTarget, setInputs } from '../js/fxgrade.js';
import { show, delegationWarnings } from '../js/fx.js';
import { APPS } from '../data/apps-screens.js';
let fail = 0, n = 0;
for (const l of APPS_LESSONS) for (const ex of l.ex) {
  n++;
  const ok = grade(ex, ex.solution);
  if (!ok.ok) { console.log('✗', ex.id, 'solution fails:', ok.msg, ok.test); fail++; continue; }
  const st = grade(ex, ex.starter ?? '');
  if (st.ok) { console.log('✗', ex.id, 'starter passes'); fail++; }
  const app = makeApp(ex); app.setFormula(ex.target.control, ex.target.prop, ex.solution); setInputs(app, ex.tests?.[0]?.inputs);
  const v = evalTarget(app, ex);
  const w = delegationWarnings(ex.solution, APPS[ex.app].delegable);
  console.log('✓', ex.id, '→', Array.isArray(v) ? `[${v.length}] ` + v.slice(0, 3).map(show).join(' | ').slice(0, 90) : /^On/.test(ex.target.prop) ? JSON.stringify({ g: v.globals, c: Object.keys(v.collections), s: v.screen, n: v.notes }).slice(0, 120) : show(v), w.length ? '⚠委任' : '', '| starter:', (st.msg || '').slice(0, 40));
}
console.log(`${n} exercises, ${fail} failures`);
process.exit(fail ? 1 : 0);
